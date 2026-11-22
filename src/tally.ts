import { combineQueries, executeAccess, validateQueryPaths, type CollectionSlug, type FlattenedField, type Where } from 'payload'
import type { Problem } from './check'
import { at, found, pieces, valuesAt, type Compared, type Formula, type Test } from './formula'
import { once } from './memo'
import { accessArgs } from './versions'
import type { Amount, AnySource, Calc, Context, Selection } from './types'

// Where the numbers come from. A measure that is no more than a field is added up by the database, where that is
// Postgres: the query is built by Payload as it builds one to count, with the access of whoever asks, so it comes
// to what reading every record would. So is one worked out by a formula (see ./formula). Anything else is read
// record by record, at most MANY of them: a measure worked out by a function, a number in the rows of an array, a
// field the database does not hold as it is shown, a collection with drafts, any other database. Either way what
// comes back is the same: what the records under each heading come to.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

/** How many records a sum or a chart reads at most, where they are read one by one, unless `limits.records` says otherwise. */
export const MANY = 5000

/**
 * How many of the values of a field a tally tells apart at most, unless `limits.groups` says otherwise: the rest,
 * those that come to least, are counted together (see `REST`).
 */
export const GROUPS = 1000

/** How many records are read at once, as the widgets were told. */
export const recordsOf = (context: Pick<Context, 'limits'>) => context.limits?.records ?? MANY
const groupsOf = (context: Pick<Context, 'limits'>) => context.limits?.groups ?? GROUPS

/** What the records under one heading come to: enough to make one number of several headings, whichever way the measure has it. */
export interface Cell { keys: string[]; currency: string; count: number; sum: number; min: number; max: number }

/**
 * The heading of everything a tally does not tell apart: the values of a field beyond the most it keeps apart, all
 * of them as one. No value a record has is this.
 */
export const REST = '\u0000rest'

/** What records are told apart by: what they have in a field, or the day or the month a date of theirs falls in. */
export type Dim = { field: string } | { date: string; daily: boolean }

/** The records of a selection added up, told apart by any of the ways asked for: `over(0)` by the first of them alone, `over()` by none. */
export interface Tally {
  over: (...dims: number[]) => Cell[]
  /** There were more records than are read at once: more than `limits.records`, not as many. */
  cut: boolean
}

/**
 * Thrown where a widget took longer to read than `limits.timeoutMs`: its tile says so to whoever looks, and the others
 * are drawn as ever. Neither a `Misconfigured` nor an `Unavailable`; `problemsOf` (see ./check) gives its one problem.
 */
export class TimedOut extends Error {
  // told apart by name, as the others are: the config, and with it this class, may be loaded apart from the page that catches it
  override name = 'TimedOut'
  readonly timedOut = true
  readonly problems: Problem[]
  constructor(readonly ms: number) {
    const problems = [{ code: 'timed-out' as const, text: 'This took longer to read than the {seconds} s it is given', vars: { seconds: Number((ms / 1000).toFixed(2)) } }]
    super(`This took longer to read than the ${ms / 1000} s it is given`)
    this.problems = problems
  }
}

/** Whether what went wrong is the database giving up on a statement that ran out of time. */
const ranOut = (error: unknown) => {
  for (let at: Loose = error, depth = 0; at && depth < 5; at = at.cause, depth += 1) if (at.code === '57014') return true
  return false
}

/**
 * The values of the first heading, the most first, as a chart ranks them: by what the measure makes of each, in one
 * currency where one is given, and of two that come to the same the one that is first by name. What a tally does not
 * tell apart is none of them.
 */
export const ranking = (how: Calc | undefined, cells: Cell[], currency?: string) => {
  const each = new Map<string, Cell[]>()
  for (const cell of cells) {
    const [key] = cell.keys
    if (key === REST) continue
    const mine = each.get(key) ?? []
    each.set(key, mine)
    if (currency === undefined || cell.currency === currency) mine.push(cell)
  }
  // what has nothing in that currency comes after all that has, by name
  const byName = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)
  return [...each].map(([key, mine]) => [key, mine.length ? made(how, mine) : undefined] as const)
    .sort((a, b) => (a[1] === undefined || b[1] === undefined ? (a[1] === undefined ? 1 : 0) - (b[1] === undefined ? 1 : 0) : b[1] - a[1]) || byName(a[0], b[0]))
    .map(([key, value]) => [key, value ?? 0] as const)
}

/**
 * What of a heading a tally tells apart: everything (nothing said), the values that come to most up to so many, or
 * just these values. Records with nothing in the field are always told apart: they are at most one more.
 */
export type Keep = number | string[] | undefined

/**
 * A tally that tells apart only what `keep` says of each heading: the values that come to most as `ranking` has
 * them, or those named. The rest are one, under `REST`, and come to what they all do, so that what is left over and
 * what all of it comes to are as they were.
 */
const folded = (tally: Tally, keep: Keep[], how: Calc | undefined, currency?: string): Tally => {
  const kept = keep.map((most, index) => {
    if (most === undefined) return undefined
    // those that come to most of what has something in the field, as the database keeps them; and what has nothing
    const set = new Set(Array.isArray(most) ? most : ranking(how, tally.over(index), currency).filter(([key]) => key !== '').slice(0, most).map(([key]) => key))
    set.add('')
    // nothing to fold where every value is kept
    return tally.over(index).every(cell => set.has(cell.keys[0])) ? undefined : set
  })
  if (kept.every(set => !set)) return tally
  const done = new Map<string, Cell[]>()
  return {
    cut: tally.cut,
    over: (...which) => {
      const name = which.join(',')
      const cells = done.get(name) ?? merged(tally.over(...which).map(cell => ({
        ...cell, keys: cell.keys.map((key, index) => (kept[which[index]] && !kept[which[index]]?.has(key) ? REST : key)),
      })))
      done.set(name, cells)
      return cells
    },
  }
}

/** What adding fractions up leaves behind is taken off: 2445.6299999999997 is 2445.63. */
export const even = (value: number) => (Number.isFinite(value) && Math.abs(value) < 1e11 ? Number(value.toFixed(10)) : value)

/** Many numbers as one: added up unless said otherwise. Nothing counts as nought. */
export const combined = (how: Calc | undefined, values: number[]) => {
  if (!values.length) return 0
  if (how === 'min') return values.reduce((least, value) => Math.min(least, value))
  if (how === 'max') return values.reduce((most, value) => Math.max(most, value))
  const total = values.reduce((sum, value) => sum + value, 0)
  return even(how === 'avg' ? total / values.length : total)
}

/** The same of what was already added up: the average of all the records, not of the averages. */
export const made = (how: Calc | undefined, cells: Cell[]) => {
  const count = cells.reduce((sum, cell) => sum + cell.count, 0)
  if (!count) return 0
  if (how === 'min') return Math.min(...cells.filter(cell => cell.count).map(cell => cell.min))
  if (how === 'max') return Math.max(...cells.filter(cell => cell.count).map(cell => cell.max))
  const total = cells.reduce((sum, cell) => sum + cell.sum, 0)
  return even(how === 'avg' ? total / count : total)
}

/** How many records there are in them. */
export const countOf = (cells: Cell[]) => cells.reduce((sum, cell) => sum + cell.count, 0)

/** Cells under the same heading and in the same currency as one. */
const merged = (cells: Cell[]) => {
  const each = new Map<string, Cell>()
  for (const cell of cells) {
    const name = JSON.stringify([cell.keys, cell.currency])
    const kept = each.get(name)
    if (!kept) each.set(name, { ...cell })
    else Object.assign(kept, { count: kept.count + cell.count, sum: kept.sum + cell.sum, min: Math.min(kept.min, cell.min), max: Math.max(kept.max, cell.max) })
  }
  return [...each.values()]
}

/** The currency a record's amount is in. */
export const currencyOf = <D>(context: Context, amount: Amount<D>, doc: D) => (amount.currency?.(doc) || context.currency).toUpperCase()

// What was read is kept for as long as the widgets were told to (`cache`), for whoever asked: the next page that
// shows the same does not ask the database again. What is kept is what the records came to, a count or the cells
// of a tally, never the records themselves. One store for every copy of this file a bundler makes.
const KEPT = Symbol.for('payload-plugin-widgets.kept')
const kept = (): Map<string, { until: number; value: Promise<unknown> }> => ((globalThis as Loose)[KEPT] ??= new Map())
const MOST = 500

const remembered = <T>(context: Context, from: AnySource, what: unknown[], read: () => Promise<T>): Promise<T> => {
  const { user } = context.as as { user?: { collection?: string; id?: unknown } }
  // read with the server's access it is the same for everybody; otherwise it is what this one person may see
  const who = context.as.overrideAccess ? '' : `${user?.collection}:${user?.id}`
  // and the same whether the database adds up or the records are read, but kept apart, so that each can be checked
  // against the other
  const name = JSON.stringify([from.slug, who, context.req?.locale ?? '', context.sums ?? '', ...what])
  // what one request asks twice, a figure and the chart beside it, is read once for it, kept or not
  if (!context.cache) return once(context.req, ['tally', name], read)
  const store = kept()
  const hit = store.get(name)
  if (hit && hit.until > Date.now()) return hit.value as Promise<T>
  const value = read()
  store.delete(name)
  store.set(name, { until: Date.now() + context.cache * 1000, value })
  // what failed is asked again
  value.catch(() => store.delete(name))
  for (const oldest of store.keys()) {
    if (store.size <= MOST) break
    store.delete(oldest)
  }
  return value
}

/** Nothing kept of a collection is good any longer: one of its records changed. */
export const forgotten = (slug: string) => {
  const store = kept()
  const mine = `[${JSON.stringify(slug)},`
  for (const name of store.keys()) if (name.startsWith(mine)) store.delete(name)
}

/** Fields by their paths as Payload is asked for them: `items.price` as `{ items: { price: true } }`. */
const asked = (paths: string[]) => {
  const all: Record<string, unknown> = {}
  for (const path of paths) {
    let within = all
    const segments = path.split('.')
    for (const [index, segment] of segments.entries()) {
      if (within[segment] === true) break
      if (index === segments.length - 1) within[segment] = true
      else within = (within[segment] ??= {}) as Record<string, unknown>
    }
  }
  return all
}

/** Records of a selection with only the fields asked for, whatever the source: at most `limit` of them. */
const query = async <D>(context: Context, from: AnySource, selection: Selection, select: string[], limit: number, sort?: string): Promise<D[]> => {
  // generic over the collection, which the typed local API cannot follow
  const { docs } = await (context.payload.find as Loose)({
    ...context.as, collection: from.slug, where: selection.where, pagination: false, limit,
    ...(sort ? { sort } : {}),
    ...(from.draft ? { draft: true } : {}),
    ...(select.length ? { select: asked(select) } : {}),
  })
  return docs
}

/**
 * Every record of a selection with only the fields asked for, whatever the source: at most `limits.records` of them
 * (5000 unless the widgets were told otherwise). Records are not kept (see `cache`): what is kept is what they come to.
 */
export const fetched = <D>(context: Context, from: AnySource, selection: Selection, select: string[], more: { limit?: number; sort?: string } = {}): Promise<D[]> =>
  query<D>(context, from, selection, select, more.limit ?? recordsOf(context), more.sort)

/** Every record of a selection up to `limits.records`, and whether there were more: one more is asked for to tell. */
const upTo = async <D>(context: Context, from: AnySource, selection: Selection, select: string[]) => {
  const most = recordsOf(context)
  const docs = await query<D>(context, from, selection, select, most + 1)
  return { docs: docs.slice(0, most), cut: docs.length > most }
}

/** How many records there are in a selection, with the access of whoever asks. */
export const counted = (context: Context, from: AnySource, selection: Selection): Promise<number> =>
  remembered(context, from, ['count', !!from.draft, selection.where], async () => {
    const asked = { ...context.as, collection: from.slug, where: selection.where }
    // counting does not know about drafts: the latest versions are found as the admin lists them, one of them read,
    // and how many there are is what comes with it
    if (from.draft) return (await (context.payload.find as Loose)({ ...asked, draft: true, limit: 1 })).totalDocs
    return (await (context.payload.count as Loose)(asked)).totalDocs
  })

/** The values a record has in a field, as text and each once: what it points at by its id, and one of nothing where it has none. */
export const valuesOf = (doc: unknown, field: string): string[] => {
  const keys = valuesAt(doc, field).filter(key => key !== null && key !== undefined && key !== '')
  return keys.length ? [...new Set(keys.map(key => (typeof key === 'object' ? String((key as { id: unknown }).id) : String(key))))] : ['']
}

const keysOf = (context: Context, dim: Dim, doc: unknown, path = 'field' in dim ? dim.field : dim.date) => {
  if ('field' in dim) return valuesOf(doc, path)
  const value = at(doc, path)
  return [typeof value === 'string' ? context.date(value).slice(0, dim.daily ? 10 : 7) : '']
}

/** Every way of taking one of each. */
const crossed = (lists: string[][]): string[][] => lists.reduce<string[][]>((before, list) => before.flatMap(keys => list.map(key => [...keys, key])), [[]])

/** Whether what a record has is a number at all: one that has nothing, or what is not a number, has none. */
const numeric = (value: unknown) => (typeof value === 'number' ? Number.isFinite(value) : value !== null && value !== undefined && value !== '' && typeof value !== 'object' && Number.isFinite(Number(value)))

/**
 * Whether records with nothing in the field are passed over rather than counted as nought: so they are for an
 * average, a lowest and a highest of a field, as the database has them. A sum counts them as nought, which adds
 * nothing; and so does a formula, where nought is what an empty field stands for.
 */
const skips = (amount: Amount<unknown>) => !!amount.plain?.field && amount.plain.formula === undefined && (amount.how === 'avg' || amount.how === 'min' || amount.how === 'max')

/** Every way of choosing some of so many, each in order: `[]`, `[0]`, `[1]`, `[0, 1]` of two. */
const choices = (many: number) => Array.from({ length: 2 ** many }, (_, mask) => Array.from({ length: many }, (_, index) => index).filter(index => mask & (2 ** index)))

/**
 * Records added up one by one. One that has several of what it is told apart by counts under each. One whose number
 * is in the rows of an array counts as what its rows come to; told apart by what the rows themselves have, as what
 * the rows under each come to. All of it is worked out at once, for every way it can be asked, so that what is kept
 * is what the records come to and not the records.
 */
const fromRecords = <D>(context: Context, docs: D[], cut: boolean, amount: Amount<D>, dims: Dim[]): Tally => {
  const formula = amount.plain?.formula ?? amount.plain?.field
  const passed = skips(amount as Amount<unknown>) ? amount.plain?.field : undefined
  const of = (which: number[]) => merged(docs.flatMap(doc => {
    const currency = amount.format === 'money' ? currencyOf(context, amount, doc) : ''
    const cell = (keys: string[], value: number): Cell => ({ keys, currency, count: 1, sum: value, min: value, max: value })
    const { rows, list } = formula === undefined ? { rows: undefined, list: [{ value: amount.of(doc), row: undefined }] } : pieces(formula, doc)
    if (!rows) {
      if (passed && !numeric(at(doc, passed))) return []
      return crossed(which.map(index => keysOf(context, dims[index], doc))).map(keys => cell(keys, list.reduce((sum, piece) => sum + piece.value, 0)))
    }
    const inside = `${rows}.`
    const each = new Map<string, Cell>()
    for (const { row, value } of list) {
      if (passed && !numeric(passed.startsWith(inside) ? at(row, passed.slice(inside.length)) : at(doc, passed))) continue
      const lists = which.map(index => {
        const dim = dims[index]
        const path = 'field' in dim ? dim.field : dim.date
        return path.startsWith(inside) ? keysOf(context, dim, row, path.slice(inside.length)) : keysOf(context, dim, doc)
      })
      for (const keys of crossed(lists)) {
        const name = JSON.stringify(keys)
        each.set(name, cell(keys, (each.get(name)?.sum ?? 0) + value))
      }
    }
    return [...each.values()]
  }))
  // the widgets tell records apart by two things at most, so this is four ways of asking
  const worked = new Map(choices(dims.length).map(which => [which.join(','), of(which)]))
  return {
    cut,
    over: (...which) => {
      const sorted = [...new Set(which)].sort((a, b) => a - b)
      const cells = worked.get(sorted.join(',')) ?? []
      return cells.map(one => ({ ...one, keys: which.map(index => one.keys[sorted.indexOf(index)]) }))
    },
  }
}

/** Not something the database can be asked. */
class Unplain extends Error {}

const NUMBERS = ['number']
const TESTED = ['select', 'radio', 'checkbox', 'text', 'number', 'relationship', 'upload']

/** A formula as the database works it out, to the same as `worked` in ./formula does of a record. */
const written = (sql: Loose, formula: Formula, column: (path: string, types: string[]) => Loose): Loose => {
  const need = (path: string, types: string[]) => {
    const found = column(path, types)
    if (!found) throw new Unplain()
    return found
  }
  const listed = (values: unknown) => {
    if (!Array.isArray(values)) throw new Unplain()
    return sql.join(values.map(value => sql`${value}`), sql`, `)
  }
  const compared = (path: string, asked: Compared): Loose[] => {
    const held = need(path, TESTED)
    return Object.entries(asked ?? {}).map(([how, value]) => {
      if (how === 'equals') return sql`${held} = ${value}`
      if (how === 'not_equals') return sql`${held} is distinct from ${value}`
      if (how === 'in') return (value as unknown[]).length ? sql`${held} in (${listed(value)})` : sql.raw('false')
      if (how === 'not_in') return (value as unknown[]).length ? sql`(${held} is null or ${held} not in (${listed(value)}))` : sql.raw('true')
      if (how === 'exists') return value ? sql`${held} is not null` : sql`${held} is null`
      if (how === 'greater_than') return sql`${held} > ${value}`
      if (how === 'greater_than_equal') return sql`${held} >= ${value}`
      if (how === 'less_than') return sql`${held} < ${value}`
      if (how === 'less_than_equal') return sql`${held} <= ${value}`
      throw new Unplain()
    })
  }
  const all = (parts: Loose[], word: 'and' | 'or') => (parts.length ? sql`(${sql.join(parts, sql.raw(` ${word} `))})` : sql.raw(word === 'and' ? 'true' : 'false'))
  const tested = (test: Test): Loose => all(Object.entries(test ?? {}).flatMap(([key, value]): Loose[] => {
    if (key === 'and' || key === 'or') return [all((value as Test[]).map(tested), key)]
    return compared(key, value as Compared)
  }), 'and')
  const literal = (value: number) => {
    if (!Number.isFinite(value)) throw new Unplain()
    return sql.raw(`(${value})::numeric`)
  }
  const of = (part: Formula): Loose => {
    if (typeof part === 'number') return literal(part)
    if (typeof part === 'string') return sql`coalesce(${need(part, NUMBERS)}, 0)`
    if ('add' in part) return part.add.length ? sql`(${sql.join(part.add.map(of), sql.raw(' + '))})` : literal(0)
    if ('multiply' in part) return part.multiply.length ? sql`(${sql.join(part.multiply.map(of), sql.raw(' * '))})` : literal(1)
    if ('subtract' in part) return sql`(${of(part.subtract[0])} - ${of(part.subtract[1])})`
    if ('divide' in part) return sql`(case when ${of(part.divide[1])} = 0 then 0 else ${of(part.divide[0])} / ${of(part.divide[1])} end)`
    // a field as it is, so that one with nothing in it is passed over
    if ('first' in part) return sql`coalesce(${sql.join([...part.first.map(one => (typeof one === 'string' ? need(one, NUMBERS) : of(one))), literal(0)], sql.raw(', '))})`
    if ('when' in part) return sql`(case when ${tested(part.when)} then ${of(part.then)} else ${part.else === undefined ? literal(0) : of(part.else)} end)`
    throw new Unplain()
  }
  return of(formula)
}

/** A column the database holds just as a record shows it: not worked out on the way, and not kept from anybody. */
const columnOf = (fields: FlattenedField[], table: Loose, path: string, types: string[]) => {
  const where = found(fields, path)
  const field = where?.field as Loose
  // what is in the rows of an array is in a table of its own
  if (!where || where.rows || !types.includes(field.type) || field.hasMany) return undefined
  // neither the field nor a group it is in
  if (where.way.some((one: Loose) => one.localized || one.virtual || one.access?.read || one.hooks?.afterRead?.length)) return undefined
  if ((field.type === 'relationship' || field.type === 'upload') && typeof field.relationTo !== 'string') return undefined
  // a field in a group is a column named after both
  return table[path.split('.').join('_')]
}

// the tag raw SQL is written with comes from the adapter's own package, which the project has and this one does not
const tags = new Map<string, Promise<Loose>>()
const tagOf = (name: string): Promise<Loose> => {
  if (!tags.has(name)) tags.set(name, import(/* webpackIgnore: true */ /* turbopackIgnore: true */ name).then(module => module.sql, () => undefined))
  return tags.get(name) as Promise<Loose>
}

const told = new Set<string>()

/** Added up by the database, or nothing where that would not come to what reading the records does. */
const inDatabase = async <D>(context: Context, from: AnySource, selection: Selection, amount: Amount<D>, dims: Dim[], keep: Keep[] = []): Promise<Cell[] | undefined> => {
  const { payload, req } = context
  const adapter = payload.db as Loose
  const plain = amount.plain
  if (!plain || context.sums === 'records' || from.draft || adapter?.name !== 'postgres' || !adapter.tables || !req) return undefined
  const config = payload.collections[from.slug as CollectionSlug]?.config
  // what a hook makes of the query or of a record on the way, only reading the records tells: the database is
  // asked here without them, as a find runs them all
  if (!config || HOOKED.some(hook => (config.hooks as Loose)?.[hook]?.length)) return undefined
  const table = adapter.tables[adapter.tableNameMap?.get(snake(config.slug))]
  if (!table?.id) return undefined
  const fields = config.flattenedFields
  const formula = plain.formula ?? plain.field
  const currency = plain.currency && amount.format === 'money' ? columnOf(fields, table, plain.currency, ['text', 'select', 'radio']) : undefined
  const columns = dims.map(dim => ('field' in dim ? columnOf(fields, table, dim.field, ['select', 'radio', 'checkbox', 'relationship', 'upload', 'text']) : columnOf(fields, table, dim.date, ['date'])))
  if ((plain.currency && amount.format === 'money' && !currency) || columns.some(column => !column)) return undefined
  const sql = await tagOf(adapter.packageName)
  if (!sql) {
    if (!told.has('')) payload.logger.warn(`widgets: ${adapter.packageName} could not be loaded to add up in the database, so records are read instead`)
    told.add('')
    return undefined
  }

  // refused as a read is refused, and narrowed to what whoever asks may read
  let where: Where = selection.where
  // with the slug, as Payload 4 asks it (see `accessArgs`)
  if (!context.as.overrideAccess) where = combineQueries(where, await executeAccess(accessArgs(req, config.slug), config.access.read))
  if (config.trash) where = combineQueries(where, { deletedAt: { exists: false } })
  await validateQueryPaths({ collectionConfig: config, overrideAccess: context.as.overrideAccess, req, where: selection.where })

  const zone = context.zone ?? 'UTC'
  // a record without the number counts as nought, as it does when it is read; for an average, a lowest and a
  // highest of a field it is passed over, as it is when it is read
  let value: Loose
  const passed = skips(amount as Amount<unknown>) ? columnOf(fields, table, plain.field as string, NUMBERS) : undefined
  if (skips(amount as Amount<unknown>) && !passed) return undefined
  try {
    value = passed ?? (formula === undefined ? sql`1` : written(sql, formula, (path, types) => columnOf(fields, table, path, types)))
  } catch (error) {
    if (error instanceof Unplain) return undefined
    throw error
  }
  const count = passed ? sql`count(${passed})` : sql`count(*)`
  // what a value of a field comes to as a chart ranks it (see `ranking`): in the one currency a chart draws
  const how = amount.how
  const rank = how === 'avg' ? sql`(sum(${value})::numeric / nullif(${count}, 0))` : how === 'min' ? sql`min(${value})` : how === 'max' ? sql`max(${value})` : sql`sum(${value})`
  const main = context.currency.toUpperCase()
  const drawn = currency ? sql` and upper(coalesce(nullif(${currency}::text, ''), ${main})) = ${main}` : sql``
  /**
   * What a field is told apart by: everything, or only the values `keep` says, the rest as `REST`. Those that come to
   * most are found by the database itself, ranked as a chart ranks them: so it hands back no more than those, and
   * what the rest come to, however many values the field has.
   */
  const keyOf = (index: number, within: Loose) => {
    const dim = dims[index]
    const column = columns[index]
    if (!('field' in dim)) return sql`to_char(${column} at time zone ${zone}, ${dim.daily ? 'YYYY-MM-DD' : 'YYYY-MM'})`
    const most = keep[index]
    if (most === undefined) return column
    const named = Array.isArray(most) ? most.filter(Boolean) : []
    const kept = Array.isArray(most)
      ? (named.length ? sql`${column}::text in (${sql.join(named.map(key => sql`${key}`), sql`, `)})` : sql.raw('false'))
      : sql`${column} in (select ${column} from ${table} where ${within ?? sql.raw('true')}${drawn} and ${column} is not null group by ${column} having ${count} > 0 order by ${rank} desc nulls last, ${column}::text collate "C" limit ${most})`
    // Postgres holds no NUL, so what is kept is marked as kept, and the rest is only a mark (see `keyIn`)
    folds.add(index)
    return sql`(case when ${column} is null then null when ${kept} then '+' || ${column}::text else '-' end)`
  }
  const folds = new Set<number>()
  const keyIn = (row: Record<string, unknown>, index: number) => {
    const key = row[`key${index}`]
    if (key === null || key === undefined) return ''
    if (!folds.has(index)) return String(key)
    return String(key).startsWith('+') ? String(key).slice(1) : REST
  }
  const pickedOf = (within: Loose) => {
    const picked: Record<string, unknown> = {}
    dims.forEach((_, index) => {
      picked[`key${index}`] = keyOf(index, within)
    })
    if (currency) picked.currency = currency
    return Object.assign(picked, { count, sum: sql`sum(${value})`, min: sql`min(${value})`, max: sql`max(${value})` })
  }
  const headings = dims.length + (currency ? 1 : 0)
  const ms = context.limits?.timeoutMs

  try {
    // Payload builds the query it would count with, and is handed this to run in place of the count
    const twin = Object.create(adapter, {
      countDistinct: {
        value: async ({ db, joins, where: built }: Loose) => {
          const run = (on: Loose) => {
            let within = built
            if (joins.length) {
              // narrowed by what a record points at: each record once, however many of those it has
              let ids = on.select({ id: table.id }).from(table).where(built).$dynamic()
              for (const join of joins) ids = ids[join.type ?? 'leftJoin'](join.table, join.condition)
              within = adapter.operators.in(table.id, ids)
            }
            const query = on.select(pickedOf(within)).from(table).where(within)
            return headings ? query.groupBy(...Array.from({ length: headings }, (_, index) => sql.raw(String(index + 1)))) : query
          }
          if (!ms) return run(db)
          // the database gives up on it too, in a transaction of its own (or a savepoint in the request's), so that
          // the limit goes no further than this: undone where it fails, set back where it does not
          return db.transaction(async (tx: Loose) => {
            const rowsOf = (result: Loose) => result?.rows ?? result
            const [{ was }] = rowsOf(await tx.execute(sql`select current_setting('statement_timeout') as was`))
            await tx.execute(sql`select set_config('statement_timeout', ${String(Math.max(1, Math.ceil(ms)))}, true)`)
            const rows = await run(tx)
            await tx.execute(sql`select set_config('statement_timeout', ${String(was)}, true)`)
            return rows
          })
        },
      },
    })
    const { totalDocs: rows } = await adapter.count.call(twin, { collection: config.slug, locale: req.locale || undefined, req, where })
    return merged((rows as Record<string, unknown>[]).filter(row => Number(row.count)).map(row => ({
      keys: dims.map((_, index) => keyIn(row, index)),
      currency: amount.format === 'money' ? String(row.currency || context.currency).toUpperCase() : '',
      count: Number(row.count), sum: Number(row.sum) || 0, min: Number(row.min) || 0, max: Number(row.max) || 0,
    })))
  } catch (error) {
    // out of time is out of time: reading every record instead would take longer still
    if (ms && ranOut(error)) throw new TimedOut(ms)
    // said once, and read the long way: a figure is worth more than the way it was come by
    if (!told.has(from.slug)) payload.logger.warn({ err: error, msg: `widgets: ${from.slug} could not be added up in the database, so its records are read instead` })
    told.add(from.slug)
    return undefined
  }
}

/** The hooks of a collection that make a find come to something else than the database holds. */
const HOOKED = ['beforeOperation', 'beforeRead', 'afterRead', 'afterOperation'] as const

const snake = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[-\s]+/g, '_').toLowerCase()

// what a measure worked out by a function is, where nothing else says: the same object is the same measure. One for
// every copy of this file a bundler makes, as the store is.
const NAMED = Symbol.for('payload-plugin-widgets.named')
const names = (): { next: number; of: WeakMap<object, number> } => ((globalThis as Loose)[NAMED] ??= { next: 0, of: new WeakMap() })
const nameOfAmount = (amount: object) => {
  const all = names()
  if (!all.of.has(amount)) all.of.set(amount, (all.next += 1))
  return all.of.get(amount) as number
}

/**
 * What the records of a selection come to, told apart by any of `dims`. Kept as that (see `cache`), never as the
 * records. Of a field, as many values are told apart as `keep` says for it, and at most `limits.groups` (1000 unless
 * the widgets were told otherwise); the rest are one, under `REST`. A date tells every day or month apart.
 */
export const tallied = async <D>(context: Context, from: AnySource, selection: Selection, amount: Amount<D>, dims: Dim[] = [], keep: Keep[] = []): Promise<Tally> => {
  const groups = groupsOf(context)
  const kept: Keep[] = dims.map((dim, index) => {
    if (!('field' in dim)) return undefined
    const most = keep[index]
    return Array.isArray(most) ? most : Math.min(groups, most ?? groups)
  })
  const spec = [
    selection.where, amount.plain ?? `own:${nameOfAmount(amount)}`, amount.format, skips(amount as Amount<unknown>), dims,
    context.zone ?? '', context.currency, !!from.draft, context.as.overrideAccess, kept, recordsOf(context),
  ]
  const currency = amount.format === 'money' ? context.currency.toUpperCase() : undefined
  return remembered(context, from, ['tally', ...spec], async (): Promise<Tally> => {
    const cells = amount.plain ? await inDatabase(context, from, selection, amount, dims, kept) : undefined
    if (cells) return folded({ cut: false, over: (...which) => merged(cells.map(cell => ({ ...cell, keys: which.map(index => cell.keys[index]) }))) }, kept, amount.how, currency)
    const select = [...new Set([...amount.select, ...dims.map(dim => ('field' in dim ? dim.field : dim.date))])]
    const { docs, cut } = await upTo<D>(context, from, selection, select)
    return folded(fromRecords(context, docs, cut, amount, dims), kept, amount.how, currency)
  })
}
