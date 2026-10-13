import type { FlattenedField } from 'payload'

// A record's number where it is more than what is in one field, said so that the database can work it out as well as
// the plugin can from a record: a little arithmetic over fields, and a choice between two by what the record has.
//
//   { multiply: ['estimatedTime', 60] }
//   { when: { documentType: { equals: 'creditNote' } }, then: { multiply: ['totalAmount', -1] }, else: 'totalAmount' }
//   { when: { isBillable: { equals: true } }, then: { first: ['billableTime', 'workDuration'] } }
//
// A field is named by its path: `totals.net` inside a group, `items.price` inside the rows of an array. A field with
// nothing in it counts as nought, except in `first`, which takes the first of several that has something.
// Nothing here may import a component: this is read by the Payload config.

/** What a field is compared with in `when`: a few of the ways Payload compares in a filter. */
export interface Compared {
  equals?: boolean | number | string
  not_equals?: boolean | number | string
  in?: (number | string)[]
  not_in?: (number | string)[]
  exists?: boolean
  greater_than?: number
  greater_than_equal?: number
  less_than?: number
  less_than_equal?: number
}

/** What a record has to have, as a filter says it: fields that all hold, or `and` and `or` of those. */
export type Test<F extends string = string> = { and: Test<F>[] } | { or: Test<F>[] } | { [P in F]?: Compared }

/** A number, a number field by its path, or something worked out of those. */
export type Formula<F extends string = string> =
  | number
  | F
  | { add: Formula<F>[] }
  | { subtract: [Formula<F>, Formula<F>] }
  | { multiply: Formula<F>[] }
  | { divide: [Formula<F>, Formula<F>] }
  /** The first that has something in it: `{ first: ['billableTime', 'workDuration'] }`. */
  | { first: Formula<F>[] }
  /** One or the other, by what the record has; nought where there is no `else`. */
  | { when: Test; then: Formula<F>; else?: Formula<F> }

export const COMPARISONS = ['equals', 'not_equals', 'in', 'not_in', 'exists', 'greater_than', 'greater_than_equal', 'less_than', 'less_than_equal'] as const
const WAYS = ['add', 'subtract', 'multiply', 'divide', 'first', 'when'] as const

type Loose = Record<string, unknown>

/** The way a formula is worked out, where it is worked out at all. */
export const wayOf = (formula: unknown): (typeof WAYS)[number] | undefined =>
  formula && typeof formula === 'object' ? WAYS.find(way => way in (formula as object)) : undefined

/** Whether something is a formula rather than the name of a field or of a measure. */
export const isFormula = (value: unknown): value is Exclude<Formula, string> => typeof value === 'number' || !!wayOf(value)

/** The conditions of a test, each with the field it is of. */
const conditions = (test: Test): [string, Compared][] => {
  if (!test || typeof test !== 'object') return []
  return Object.entries(test).flatMap(([key, value]): [string, Compared][] =>
    key === 'and' || key === 'or' ? (Array.isArray(value) ? value.flatMap(conditions) : []) : [[key, (value ?? {}) as Compared]])
}

/** The fields a formula reads: the numbers it works with, and what it chooses by. */
export const fieldsIn = (formula: Formula): { numbers: string[]; tested: [string, Compared][] } => {
  if (typeof formula === 'string') return { numbers: [formula], tested: [] }
  const way = wayOf(formula)
  if (!way) return { numbers: [], tested: [] }
  const parts = way === 'when'
    ? [(formula as { then: Formula }).then, ...('else' in (formula as object) ? [(formula as { else: Formula }).else] : [])]
    : ((formula as Loose)[way] as Formula[])
  const inner = (Array.isArray(parts) ? parts : []).map(fieldsIn)
  return {
    numbers: [...new Set(inner.flatMap(one => one.numbers))],
    tested: [...(way === 'when' ? conditions((formula as { when: Test }).when) : []), ...inner.flatMap(one => one.tested)],
  }
}

/** Every field a formula reads, by its path. */
export const pathsIn = (formula: Formula): string[] => {
  const { numbers, tested } = fieldsIn(formula)
  return [...new Set([...numbers, ...tested.map(([path]) => path)])]
}

/** What a record has at a path. Through the rows of an array and through a field that holds several it is all of them. */
export const valuesAt = (doc: unknown, path: string): unknown[] => {
  let found: unknown[] = [doc]
  for (const segment of path.split('.')) {
    found = found.flatMap(value => {
      const inner = value && typeof value === 'object' ? (value as Loose)[segment] : undefined
      return Array.isArray(inner) ? inner : [inner]
    })
  }
  return found
}

/** What a record has at a path where that is one thing: nothing where it is several. */
export const at = (doc: unknown, path: string): unknown => {
  let value = doc
  for (const segment of path.split('.')) value = value && typeof value === 'object' && !Array.isArray(value) ? (value as Loose)[segment] : undefined
  return value
}

const nothing = (value: unknown) => value === null || value === undefined
/** What is pointed at is compared by its id. */
const plain = (value: unknown) => (value && typeof value === 'object' ? (value as { id?: unknown }).id : value)
const same = (a: unknown, b: unknown) => !nothing(a) && (typeof a === 'number' || typeof b === 'number' ? Number(a) === Number(b) : String(a) === String(b))

/** Whether a record has what a test asks: what has nothing in a field is equal to nothing and greater than nothing. */
export const holds = (test: Test, get: (path: string) => unknown): boolean => {
  if (!test || typeof test !== 'object') return false
  return Object.entries(test).every(([key, asked]) => {
    if (key === 'and') return (asked as Test[]).every(one => holds(one, get))
    if (key === 'or') return (asked as Test[]).some(one => holds(one, get))
    const value = plain(get(key))
    return Object.entries((asked ?? {}) as Compared).every(([how, with_]) => {
      if (how === 'equals') return same(value, with_)
      if (how === 'not_equals') return !same(value, with_)
      if (how === 'in') return (with_ as unknown[]).some(one => same(value, one))
      if (how === 'not_in') return !(with_ as unknown[]).some(one => same(value, one))
      if (how === 'exists') return nothing(value) !== !!with_
      if (nothing(value)) return false
      if (how === 'greater_than') return Number(value) > Number(with_)
      if (how === 'greater_than_equal') return Number(value) >= Number(with_)
      if (how === 'less_than') return Number(value) < Number(with_)
      if (how === 'less_than_equal') return Number(value) <= Number(with_)
      return false
    })
  })
}

/** What a formula comes to for a record, read through `get`. */
export const worked = (formula: Formula, get: (path: string) => unknown): number => {
  if (typeof formula === 'number') return formula
  if (typeof formula === 'string') return Number(get(formula)) || 0
  const of = (part: Formula) => worked(part, get)
  if ('add' in formula) return formula.add.reduce<number>((sum, part) => sum + of(part), 0)
  if ('multiply' in formula) return formula.multiply.reduce<number>((product, part) => product * of(part), 1)
  if ('subtract' in formula) return of(formula.subtract[0]) - of(formula.subtract[1])
  if ('divide' in formula) {
    const by = of(formula.divide[1])
    // by nothing there is nothing to say
    return by ? of(formula.divide[0]) / by : 0
  }
  if ('first' in formula) {
    const found = formula.first.find(part => typeof part !== 'string' || !nothing(get(part)))
    return found === undefined ? 0 : of(found)
  }
  if ('when' in formula) return holds(formula.when, get) ? of(formula.then) : formula.else === undefined ? 0 : of(formula.else)
  return 0
}

/** The array a path leads through in a record: the rows a number of it is in. Nothing where the record has one of it, or no rows. */
export const rowsIn = (doc: unknown, path: string): string | undefined => {
  let value = doc
  const segments = path.split('.')
  for (const [index, segment] of segments.slice(0, -1).entries()) {
    value = value && typeof value === 'object' ? (value as Loose)[segment] : undefined
    if (Array.isArray(value)) return value.some(row => row && typeof row === 'object') ? segments.slice(0, index + 1).join('.') : undefined
  }
  return undefined
}

/**
 * What a formula comes to in a record, piece by piece: once for the record, or once for each of its rows where the
 * formula reads from the rows of an array. `get` reads a field of the piece, and of the record around it.
 */
export const pieces = (formula: Formula, doc: unknown): { rows?: string; list: { value: number; row?: unknown }[] } => {
  const rows = pathsIn(formula).map(path => rowsIn(doc, path)).find(Boolean)
  if (!rows) return { list: [{ value: worked(formula, path => at(doc, path)) }] }
  const inside = `${rows}.`
  return {
    rows,
    list: valuesAt(doc, rows).filter(row => row && typeof row === 'object')
      .map(row => ({ row, value: worked(formula, path => (path.startsWith(inside) ? at(row, path.slice(inside.length)) : at(doc, path))) })),
  }
}

/** What a formula comes to for a record: its rows added up where it reads from rows. */
export const numberOf = (formula: Formula, doc: unknown) => pieces(formula, doc).list.reduce((sum, piece) => sum + piece.value, 0)

// Where a field is in a collection, as Payload has its fields once the config is settled.

type Inner = FlattenedField & { flattenedFields?: FlattenedField[] }

export interface Found {
  field: FlattenedField
  /** The array it is in the rows of, by its path; nothing where a record has one of it. */
  rows?: string
  /** Every field on the way to it, itself last. */
  way: FlattenedField[]
}

/** The field a path leads to through groups, named tabs and the rows of arrays: nothing where it leads elsewhere. */
export const found = (fields: FlattenedField[], path: string): Found | undefined => {
  let among: FlattenedField[] | undefined = fields
  let rows: string | undefined
  const way: FlattenedField[] = []
  const segments = path.split('.')
  for (const [index, segment] of segments.entries()) {
    const field = among?.find(candidate => candidate.name === segment) as Inner | undefined
    if (!field) return undefined
    way.push(field)
    if (index === segments.length - 1) return { field, way, ...(rows ? { rows } : {}) }
    if (field.type !== 'group' && field.type !== 'tab' && field.type !== 'array') return undefined
    if (field.type === 'array') rows = segments.slice(0, index + 1).join('.')
    among = field.flattenedFields
  }
  return undefined
}

/** Every field of a kind a collection has, by its path, the ones inside groups and rows included. */
export const pathsOf = (fields: FlattenedField[], keep: (field: FlattenedField) => boolean, prefix = ''): string[] => fields.flatMap(field => {
  const inner = (field as Inner).flattenedFields
  if (inner && (field.type === 'group' || field.type === 'tab' || field.type === 'array')) return pathsOf(inner, keep, `${prefix}${field.name}.`)
  return keep(field) ? [`${prefix}${field.name}`] : []
})
