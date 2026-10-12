import { combineQueries, executeAccess, validateQueryPaths, type CollectionSlug, type FlattenedField, type Where } from 'payload'
import type { Amount, AnySource, Calc, Context, Selection } from './types'

// Where the numbers come from. A measure that is no more than a field is added up by the database, where that is
// Postgres: the query is built by Payload as it builds one to count, with the access of whoever asks, so it comes
// to what reading every record would. Anything else is read record by record, at most MANY of them: a measure
// worked out by a function, a field the database does not hold as it is shown, a collection with drafts, any other
// database. Either way what comes back is the same: what the records under each heading come to.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

/** How many records a sum or a chart reads at most, where they are read one by one. */
export const MANY = 5000

/** What the records under one heading come to: enough to make one number of several headings, whichever way the measure has it. */
export interface Cell { keys: string[]; currency: string; count: number; sum: number; min: number; max: number }

/** What records are told apart by: what they have in a field, or the day or the month a date of theirs falls in. */
export type Dim = { field: string } | { date: string; daily: boolean }

/** The records of a selection added up, told apart by any of the ways asked for: `over(0)` by the first of them alone, `over()` by none. */
export interface Tally {
  over: (...dims: number[]) => Cell[]
  /** There were more records than are read at once. */
  cut: boolean
}

/** Many numbers as one: added up unless said otherwise. Nothing counts as nought. */
export const combined = (how: Calc | undefined, values: number[]) => {
  if (!values.length) return 0
  if (how === 'min') return values.reduce((least, value) => Math.min(least, value))
  if (how === 'max') return values.reduce((most, value) => Math.max(most, value))
  const total = values.reduce((sum, value) => sum + value, 0)
  return how === 'avg' ? total / values.length : total
}

/** The same of what was already added up: the average of all the records, not of the averages. */
export const made = (how: Calc | undefined, cells: Cell[]) => {
  const count = cells.reduce((sum, cell) => sum + cell.count, 0)
  if (!count) return 0
  if (how === 'min') return Math.min(...cells.filter(cell => cell.count).map(cell => cell.min))
  if (how === 'max') return Math.max(...cells.filter(cell => cell.count).map(cell => cell.max))
  const total = cells.reduce((sum, cell) => sum + cell.sum, 0)
  return how === 'avg' ? total / count : total
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
// shows the same does not ask the database again. One store for every copy of this file a bundler makes.
const KEPT = Symbol.for('payload-plugin-widgets.kept')
const kept = (): Map<string, { until: number; value: Promise<unknown> }> => ((globalThis as Loose)[KEPT] ??= new Map())
const MOST = 500

const remembered = <T>(context: Context, from: AnySource, what: unknown[], read: () => Promise<T>): Promise<T> => {
  if (!context.cache) return read()
  const store = kept()
  const { user } = context.as as { user?: { collection?: string; id?: unknown } }
  // read with the server's access it is the same for everybody; otherwise it is what this one person may see
  const who = context.as.overrideAccess ? '' : `${user?.collection}:${user?.id}`
  const name = JSON.stringify([from.slug, who, context.req?.locale ?? '', ...what])
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

/** Every record of a selection with only the fields asked for, whatever the source. */
export const fetched = async <D>(context: Context, from: AnySource, selection: Selection, select: string[], more: { limit?: number; sort?: string } = {}): Promise<D[]> => {
  const read = async (): Promise<D[]> => {
    // generic over the collection, which the typed local API cannot follow
    const { docs } = await (context.payload.find as Loose)({
      ...context.as, collection: from.slug, where: selection.where, pagination: false, limit: more.limit ?? MANY,
      ...(more.sort ? { sort: more.sort } : {}),
      ...(from.draft ? { draft: true } : {}),
      ...(select.length ? { select: Object.fromEntries(select.map(field => [field, true])) } : {}),
    })
    return docs
  }
  // the first few of a list are read as they are now: somebody may just have added one
  return more.limit || more.sort ? read() : remembered(context, from, ['records', selection.where, [...select].sort()], read)
}

export const counted = (context: Context, from: AnySource, selection: Selection): Promise<number> =>
  from.draft
    // counting does not know about drafts, so the latest versions are read and counted
    ? fetched(context, from, selection, []).then(docs => docs.length)
    : remembered(context, from, ['count', selection.where], async () => (await (context.payload.count as Loose)({ ...context.as, collection: from.slug, where: selection.where })).totalDocs)

/** The values a record has in a field, as text: what it points at by its id, and one of nothing where it has none. */
export const valuesOf = (doc: Record<string, unknown>, field: string): string[] => {
  const value = doc[field]
  const keys = (Array.isArray(value) ? value : [value]).filter(key => key !== null && key !== undefined && key !== '')
  return keys.length ? keys.map(key => (typeof key === 'object' ? String((key as { id: unknown }).id) : String(key))) : ['']
}

const keysOf = (context: Context, dim: Dim, doc: Record<string, unknown>) =>
  'field' in dim ? valuesOf(doc, dim.field) : [typeof doc[dim.date] === 'string' ? context.date(doc[dim.date] as string).slice(0, dim.daily ? 10 : 7) : '']

/** Every way of taking one of each. */
const crossed = (lists: string[][]): string[][] => lists.reduce<string[][]>((before, list) => before.flatMap(keys => list.map(key => [...keys, key])), [[]])

/** Records added up one by one. One that has several of what it is told apart by counts under each. */
const fromRecords = <D>(context: Context, docs: D[], amount: Amount<D>, dims: Dim[]): Tally => ({
  cut: docs.length >= MANY,
  over: (...which) => merged(docs.flatMap(doc => {
    const value = amount.of(doc)
    const currency = amount.format === 'money' ? currencyOf(context, amount, doc) : ''
    return crossed(which.map(index => keysOf(context, dims[index], doc as Record<string, unknown>))).map(keys => ({ keys, currency, count: 1, sum: value, min: value, max: value }))
  })),
})

/** A column the database holds just as a record shows it: not worked out on the way, and not kept from anybody. */
const columnOf = (fields: FlattenedField[], table: Loose, name: string, types: string[]) => {
  const field = fields.find(candidate => candidate.name === name) as Loose
  if (!field || !types.includes(field.type) || field.localized || field.virtual || field.hasMany || field.access?.read || field.hooks?.afterRead?.length) return undefined
  if ((field.type === 'relationship' || field.type === 'upload') && typeof field.relationTo !== 'string') return undefined
  return table[name]
}

// the tag raw SQL is written with comes from the adapter's own package, which the project has and this one does not
const tags = new Map<string, Promise<Loose>>()
const tagOf = (name: string): Promise<Loose> => {
  if (!tags.has(name)) tags.set(name, import(/* webpackIgnore: true */ /* turbopackIgnore: true */ name).then(module => module.sql, () => undefined))
  return tags.get(name) as Promise<Loose>
}

const told = new Set<string>()

/** Added up by the database, or nothing where that would not come to what reading the records does. */
const inDatabase = async <D>(context: Context, from: AnySource, selection: Selection, amount: Amount<D>, dims: Dim[]): Promise<Cell[] | undefined> => {
  const { payload, req } = context
  const adapter = payload.db as Loose
  const plain = amount.plain
  if (!plain || context.sums === 'records' || from.draft || adapter?.name !== 'postgres' || !adapter.tables || !req) return undefined
  const config = payload.collections[from.slug as CollectionSlug]?.config
  // what a hook makes of a record on the way out, only reading it tells
  if (!config || config.hooks?.afterRead?.length) return undefined
  const table = adapter.tables[adapter.tableNameMap?.get(snake(config.slug))]
  if (!table?.id) return undefined
  const fields = config.flattenedFields
  const number = plain.field ? columnOf(fields, table, plain.field, ['number']) : undefined
  const currency = plain.currency && amount.format === 'money' ? columnOf(fields, table, plain.currency, ['text', 'select', 'radio']) : undefined
  const columns = dims.map(dim => ('field' in dim ? columnOf(fields, table, dim.field, ['select', 'radio', 'checkbox', 'relationship', 'upload', 'text']) : columnOf(fields, table, dim.date, ['date'])))
  if ((plain.field && !number) || (plain.currency && amount.format === 'money' && !currency) || columns.some(column => !column)) return undefined
  const sql = await tagOf(adapter.packageName)
  if (!sql) {
    if (!told.has('')) payload.logger.warn(`widgets: ${adapter.packageName} could not be loaded to add up in the database, so records are read instead`)
    told.add('')
    return undefined
  }

  // refused as a read is refused, and narrowed to what whoever asks may read
  let where: Where = selection.where
  if (!context.as.overrideAccess) where = combineQueries(where, await executeAccess({ req }, config.access.read))
  if (config.trash) where = combineQueries(where, { deletedAt: { exists: false } })
  await validateQueryPaths({ collectionConfig: config, overrideAccess: context.as.overrideAccess, req, where: selection.where })

  const zone = context.zone ?? 'UTC'
  const picked: Record<string, unknown> = {}
  dims.forEach((dim, index) => {
    picked[`key${index}`] = 'field' in dim ? columns[index] : sql`to_char(${columns[index]} at time zone ${zone}, ${dim.daily ? 'YYYY-MM-DD' : 'YYYY-MM'})`
  })
  if (currency) picked.currency = currency
  const headings = Object.keys(picked).length
  // a record without the number counts as nought, as it does when it is read
  const value = number ? sql`coalesce(${number}, 0)` : sql`1`
  Object.assign(picked, { count: sql`count(*)`, sum: sql`sum(${value})`, min: sql`min(${value})`, max: sql`max(${value})` })

  try {
    // Payload builds the query it would count with, and is handed this to run in place of the count
    const twin = Object.create(adapter, {
      countDistinct: {
        value: async ({ db, joins, where: built }: Loose) => {
          let within = built
          if (joins.length) {
            // narrowed by what a record points at: each record once, however many of those it has
            let ids = db.select({ id: table.id }).from(table).where(built).$dynamic()
            for (const join of joins) ids = ids[join.type ?? 'leftJoin'](join.table, join.condition)
            within = adapter.operators.in(table.id, ids)
          }
          const query = db.select(picked).from(table).where(within)
          return headings ? query.groupBy(...Array.from({ length: headings }, (_, index) => sql.raw(String(index + 1)))) : query
        },
      },
    })
    const { totalDocs: rows } = await adapter.count.call(twin, { collection: config.slug, locale: req.locale || undefined, req, where })
    return merged((rows as Record<string, unknown>[]).filter(row => Number(row.count)).map(row => ({
      keys: dims.map((_, index) => (row[`key${index}`] === null || row[`key${index}`] === undefined ? '' : String(row[`key${index}`]))),
      currency: amount.format === 'money' ? String(row.currency || context.currency).toUpperCase() : '',
      count: Number(row.count), sum: Number(row.sum) || 0, min: Number(row.min) || 0, max: Number(row.max) || 0,
    })))
  } catch (error) {
    // said once, and read the long way: a figure is worth more than the way it was come by
    if (!told.has(from.slug)) payload.logger.warn({ err: error, msg: `widgets: ${from.slug} could not be added up in the database, so its records are read instead` })
    told.add(from.slug)
    return undefined
  }
}

const snake = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[-\s]+/g, '_').toLowerCase()

/** What the records of a selection come to, told apart by any of `dims`. */
export const tallied = async <D>(context: Context, from: AnySource, selection: Selection, amount: Amount<D>, dims: Dim[] = []): Promise<Tally> => {
  const spec = amount.plain ? [selection.where, amount.plain, amount.format, dims, context.zone ?? '', context.as.overrideAccess] : undefined
  const cells = spec ? await remembered(context, from, ['sums', ...spec], () => inDatabase(context, from, selection, amount, dims)) : undefined
  if (cells) return { cut: false, over: (...which) => merged(cells.map(cell => ({ ...cell, keys: which.map(index => cell.keys[index]) }))) }
  const select = [...new Set([...amount.select, ...dims.map(dim => ('field' in dim ? dim.field : dim.date))])]
  return fromRecords(context, await fetched<D>(context, from, selection, select), amount, dims)
}
