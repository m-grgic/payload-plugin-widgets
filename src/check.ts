import type { FlattenedField, Where } from 'payload'
import { calcOf, VIEWS, type AnySource, type Kind, type Vars, type View } from './types'

// What is wrong with how a widget is set up, said so that it can be put right: the name that is not there and the
// one that was probably meant. The same is said when the config is built, for the widgets a project declares, and
// on the tile, for the ones somebody set up in a drawer.
// Nothing here may import a component: this is read by the Payload config.

/** One thing that is wrong, in English with `{name}` filled from `vars`, and the name that comes closest. */
export interface Problem { text: string; vars: Vars; hint?: string }

/** Thrown where a widget is for somebody else. */
export class Unavailable extends Error {
  // told apart by name: the config, and with it this class, may be loaded apart from the page that catches it
  override name = 'Unavailable'
}

/** Thrown where a widget is set up with something that is not there. */
export class Misconfigured extends Unavailable {
  override name = 'Misconfigured'
  constructor(readonly problems: Problem[]) {
    super(problems.map(problem => inWords(problem)).join(' '))
  }
}

export const problemsOf = (error: unknown): Problem[] | undefined =>
  error instanceof Error && error.name === 'Misconfigured' ? (error as Misconfigured).problems : undefined

const fill = (text: string, vars: Vars) => text.replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? String(vars[key]) : whole))

/** A problem as one sentence; `t` says it in another language. */
export const inWords = ({ text, vars, hint }: Problem, t: (text: string, vars?: Vars) => string = fill as never) =>
  `${t(text, vars)}.${hint ? ` ${t('Did you mean "{name}"?', { name: hint })}` : ''}`

/** How many letters have to change to make one word of another. */
const apart = (a: string, b: string) => {
  let row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    row = next
  }
  return row[b.length]
}

/** The name that was probably meant: the closest one, as long as it is close. */
export const closest = (name: string, among: string[]) => {
  const lower = name.toLowerCase()
  const [best] = among.map(other => [other, apart(lower, other.toLowerCase())] as const).sort((a, b) => a[1] - b[1])
  return best && best[1] <= Math.max(2, Math.floor(name.length / 3)) ? best[0] : undefined
}

const missing = (text: string, vars: Vars, among: string[]): Problem => {
  const hint = closest(String(vars.name), among)
  return { text, vars, ...(hint ? { hint } : {}) }
}

export const noSource = (name: string, sources: Record<string, AnySource>) =>
  missing('There is no source called "{name}"', { name }, [...Object.keys(sources), ...Object.values(sources).map(source => source.slug as string)])

/** The ways a widget of one kind can be drawn: the plugin's own, and the project's. */
export const viewsOf = (kind: Kind, views: Record<string, View>) =>
  [...Object.keys(VIEWS[kind]), ...Object.keys(views).filter(name => views[name].kind === kind)]

/** A widget asked to be drawn a way there is none of for its kind. */
export const viewProblems = (kind: Kind, as: unknown, views: Record<string, View>): Problem[] =>
  typeof as !== 'string' || !as || viewsOf(kind, views).includes(as) ? [] : [missing('A {kind} cannot be drawn as "{name}"', { kind, name: as }, viewsOf(kind, views))]

/** What a figure is asked for that it cannot give as it is set up. */
export const figureProblems = (pick: { as?: unknown; goal?: unknown; compare?: unknown; period?: unknown; from?: unknown }): Problem[] => [
  ...(pick.as === 'progress' && !(Number(pick.goal) > 0) ? [{ text: 'Progress is towards a goal: give it one', vars: {} }] : []),
  ...(pick.compare && (!pick.period || ['all', 'past', 'upcoming'].includes(String(pick.period)) || (pick.period === 'custom' && !pick.from))
    ? [{ text: 'There is nothing before this to compare it with: give it a period that has a beginning', vars: {} }] : []),
]

/** What a widget read with the server's access leaves open: who it is for, and rows nobody could open. */
export const elevatedProblems = (kind: Kind, widget: { access?: unknown; overrideAccess?: unknown }, source: { access?: unknown }): Problem[] => [
  ...(widget.overrideAccess && kind === 'list' ? [{ text: 'A list is read as whoever looks at it: only a figure or a chart takes overrideAccess', vars: {} }] : []),
  ...(widget.overrideAccess && kind !== 'list' && !widget.access && !source.access
    ? [{ text: 'What is read with overrideAccess has to say who it is for: give it or its source an access', vars: {} }] : []),
]

/** What a chart is asked to tell apart that it cannot: one thing at a time, and not what its bars already are. */
export const seriesProblems = (pick: { measure?: unknown; by?: string; series?: string }): Problem[] => [
  ...(pick.series && Array.isArray(pick.measure) && pick.measure.length > 1 ? [{ text: 'A chart tells apart its measures or what is in a field, not both', vars: {} }] : []),
  ...(pick.series && pick.series === pick.by ? [{ text: 'A chart cannot be split by "{name}" twice', vars: { name: pick.series } }] : []),
]

/** What a widget picks from its source by name. */
export interface Names { filter?: string; measure?: string | object | (string | object | undefined)[]; list?: string; by?: string; series?: string }

/** The names a widget picks that its source does not have. */
export const nameProblems = (source: AnySource, pick: Names, kind: 'figure' | 'list' | 'chart'): Problem[] => {
  const vars = (name: string) => ({ source: source.slug, name })
  const found: Problem[] = []
  if (pick.filter && !source.filters[pick.filter]) found.push(missing('{source} has no filter called "{name}"', vars(pick.filter), Object.keys(source.filters)))
  // one said in place is checked against the collection's fields, once those are known: see `measureProblems`
  for (const measure of kind === 'list' ? [] : [pick.measure].flat()) {
    if (typeof measure !== 'string') continue
    // a chart draws only what is a number in each record
    const measures = Object.keys(source.measures).filter(name => kind === 'figure' || !!source.measures[name].amount)
    if (!measures.includes(measure)) {
      found.push(missing(kind === 'chart' ? '{source} has no measure called "{name}" that can be drawn' : '{source} has no measure called "{name}"', vars(measure), measures))
    }
  }
  if (kind === 'list' && pick.list && !source.lists?.[pick.list]) found.push(missing('{source} has no list called "{name}"', vars(pick.list), Object.keys(source.lists ?? {})))
  if (kind === 'chart' && pick.by && pick.by !== 'time' && !(source.groups as Record<string, unknown> | undefined)?.[pick.by]) {
    found.push(missing('{source} cannot be split by "{name}"', vars(pick.by), Object.keys(source.groups ?? {})))
  }
  if (kind === 'chart' && pick.series && !(source.groups as Record<string, unknown> | undefined)?.[pick.series]) {
    found.push(missing('{source} cannot be split by "{name}"', vars(pick.series), Object.keys(source.groups ?? {})))
  }
  return found
}

const OPERATORS = [
  'equals', 'not_equals', 'in', 'not_in', 'exists', 'greater_than', 'greater_than_equal', 'less_than', 'less_than_equal',
  'like', 'not_like', 'contains', 'all', 'near', 'within', 'intersects',
]

/** What is beyond a field that points elsewhere or keeps anything: not ours to know. */
const BEYOND = Symbol('beyond')

/** The field a path leads to, as a collection has them once Payload has settled its config. */
export const fieldAt = (fields: FlattenedField[], path: string): FlattenedField | typeof BEYOND | undefined => {
  let among = fields
  const segments = path.split('.')
  for (const [index, segment] of segments.entries()) {
    const field = among.find(candidate => candidate.name === segment)
    if (!field) return index === 0 && (segment === 'id' || segment.startsWith('_')) ? BEYOND : undefined
    if (index === segments.length - 1) return field
    const inner = (field as { flattenedFields?: FlattenedField[] }).flattenedFields
    // into what it points at, into one of its languages, into whatever it keeps
    if (!inner || field.type === 'blocks') return BEYOND
    among = inner
  }
  return undefined
}

export const isDate = (fields: FlattenedField[], path: string) => {
  const field = fieldAt(fields, path)
  return typeof field === 'object' && field.type === 'date'
}

const paths = (fields: FlattenedField[], prefix = ''): string[] => fields.flatMap(field => {
  const inner = (field as { flattenedFields?: FlattenedField[] }).flattenedFields
  return inner && field.type !== 'blocks' && field.type !== 'array' ? paths(inner, `${prefix}${field.name}.`) : [`${prefix}${field.name}`]
})

/** What a filter asks that the collection cannot answer: a field it does not have, a comparison there is none of, a choice a select does not offer. */
export const whereProblems = (slug: string, fields: FlattenedField[], where: Where | undefined): Problem[] => {
  if (!where || typeof where !== 'object') return []
  return Object.entries(where).flatMap(([key, condition]): Problem[] => {
    if (key === 'and' || key === 'or') return Array.isArray(condition) ? condition.flatMap(inner => whereProblems(slug, fields, inner)) : []
    const field = fieldAt(fields, key)
    if (!field) return [missing('{source} has no field called "{name}"', { source: slug, name: key }, ['id', ...paths(fields)])]
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return []
    return Object.entries(condition).flatMap(([operator, value]): Problem[] => {
      if (!OPERATORS.includes(operator)) return [missing('"{name}" is not a way to compare {field}', { field: key, name: operator }, OPERATORS)]
      if (typeof field !== 'object' || (field.type !== 'select' && field.type !== 'radio') || !['equals', 'not_equals', 'in', 'not_in', 'all'].includes(operator)) return []
      const offered = field.options.map(option => (typeof option === 'string' ? option : option.value))
      const asked = (Array.isArray(value) ? value : typeof value === 'string' && operator !== 'equals' && operator !== 'not_equals' ? value.split(',') : [value])
        .filter((one): one is string => typeof one === 'string' && one !== '')
      return asked.filter(one => !offered.includes(one))
        .map(one => missing('{field} has no choice called "{name}": it is one of {choices}', { field: key, name: one, choices: offered.join(', ') }, offered))
    })
  })
}

/** A measure said in place that is of nothing the source can make a figure of: neither a number of the collection nor a measure that adds one up. */
export const measureProblems = (source: AnySource, fields: FlattenedField[], measure: unknown): Problem[] => {
  if (!measure || typeof measure !== 'object') return []
  const found = calcOf(measure)
  if (!found) return [{ text: 'A measure said in place is the sum, avg, min or max of a number', vars: {} }]
  const [, name] = found
  if (source.measures[name]?.amount) return []
  const numbers = fields.filter(field => field.type === 'number' && !field.hasMany).map(field => field.name)
  if (numbers.includes(name)) return []
  const measures = Object.keys(source.measures).filter(other => !!source.measures[other].amount)
  return [missing('{source} has no number called "{name}"', { source: source.slug, name }, [...new Set([...numbers, ...measures])])]
}

/** A date a widget is asked to go by that is not one. */
export const dateProblems = (slug: string, fields: FlattenedField[], date: string | undefined): Problem[] => {
  if (!date) return []
  const field = fieldAt(fields, date)
  if (!field) return [missing('{source} has no field called "{name}"', { source: slug, name: date }, paths(fields))]
  return typeof field === 'object' && field.type !== 'date' ? [{ text: '"{name}" of {source} is not a date', vars: { source: slug, name: date } }] : []
}
