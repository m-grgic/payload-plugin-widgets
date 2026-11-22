import { flattenAllFields, type Config, type FlattenedField, type Where } from 'payload'
import { COMPARISONS, fieldsIn, found as located, pathsOf, wayOf, type Formula } from './formula'
import { calcOf, VIEWS, type AnySource, type Kind, type Vars, type View } from './types'
import type { Settings } from './options'
import { STRINGS } from './strings'
import { ANCHORS, isDateText, isMoment } from './when'

// What is wrong with how a widget is set up, said so that it can be put right: the name that is not there and the
// one that was probably meant. The same is said when the config is built, for the widgets a project declares, and
// on the tile, for the ones somebody set up in a drawer.
// Nothing here may import a component: this is read by the Payload config.

/** What is wrong, by a name that stays as the words change: to tell problems apart by. */
export type ProblemCode =
  | 'no-source' | 'no-filter' | 'no-measure' | 'no-drawable-measure' | 'no-number' | 'no-list' | 'no-group' | 'no-scope' | 'no-field'
  | 'no-operator' | 'no-choice' | 'no-view' | 'not-a-date' | 'not-a-number' | 'not-a-moment' | 'date-in-rows'
  | 'bad-measure' | 'bad-formula' | 'formula-rows' | 'list-elevated' | 'elevated-without-access' | 'series-and-measures' | 'series-twice'
  | 'no-goal' | 'nothing-before' | 'no-comparable-figure' | 'duplicate-slug' | 'reserved-slug' | 'timed-out' | 'misconfigured'

/** One thing that is wrong, in English with `{name}` filled from `vars`, and the name that comes closest. */
export interface Problem {
  code: ProblemCode
  text: string
  vars: Vars
  hint?: string
  /** Where in what was set up it is: `where.and.0.dueDate.less_than`, `groups.custmer`. */
  path?: string
}

/** A problem as it may be said without its code, which is then known by its words. */
export type Said = Omit<Problem, 'code'> & { code?: ProblemCode }

const CODES: Record<string, ProblemCode> = {
  'There is no source called "{name}"': 'no-source',
  '{source} has no filter called "{name}"': 'no-filter',
  '{source} has no measure called "{name}"': 'no-measure',
  '{source} has no measure called "{name}" that can be drawn': 'no-drawable-measure',
  '{source} has no number called "{name}"': 'no-number',
  'A measure said in place is the sum, avg, min or max of a number': 'bad-measure',
  'A formula is a number, a number field, or one of add, subtract, multiply, divide, first and when': 'bad-formula',
  'In the formula, at "{at}": {way} takes two parts, not {count}': 'bad-formula',
  'In the formula, at "{at}": {way} takes at least one part': 'bad-formula',
  'In the formula, at "{at}": when takes what a record has to have, and a then': 'bad-formula',
  'In the formula, at "{at}": a part is a number, a number field, or one of add, subtract, multiply, divide, first and when': 'bad-formula',
  'A formula reads the rows of one array, not of "{name}" and of "{other}"': 'formula-rows',
  '{source} has no list called "{name}"': 'no-list',
  '{source} has no list to show': 'no-list',
  '{source} cannot be split by "{name}"': 'no-group',
  '{source} cannot be narrowed to a "{name}"': 'no-scope',
  '{source} has no field called "{name}"': 'no-field',
  '"{name}" is not a way to compare {field}': 'no-operator',
  '{field} has no choice called "{name}": it is one of {choices}': 'no-choice',
  '"{name}" of {source} is not a date': 'not-a-date',
  '"{name}" of {source} is not a number': 'not-a-number',
  '{field} is a date: "{name}" is neither a date (YYYY-MM-DD) nor a moment such as "today" or "startOfMonth-1m"': 'not-a-moment',
  '"{name}" of {source} is in the rows of an array: a period goes by a date of the record itself': 'date-in-rows',
  'A {kind} cannot be drawn as "{name}"': 'no-view',
  'A list is read as whoever looks at it: only a figure or a chart takes overrideAccess': 'list-elevated',
  'What is read with overrideAccess has to say who it is for: give it or its source an access': 'elevated-without-access',
  'A chart tells apart its measures or what is in a field, not both': 'series-and-measures',
  'A chart cannot be split by "{name}" twice': 'series-twice',
  'Progress is towards a goal: give it one': 'no-goal',
  'There is nothing before this to compare it with: give it a period that has a beginning': 'nothing-before',
  '"{name}" of {source} gives no number to compare or to set against a goal': 'no-comparable-figure',
  'There are two widgets called "{name}"': 'duplicate-slug',
  'A widget cannot be called "{name}": {owner} has one called that': 'reserved-slug',
  'This took longer to read than the {seconds} s it is given': 'timed-out',
}

/** A problem with its code, where it was said without one. */
export const coded = (problem: Said): Problem => ({ ...problem, code: problem.code ?? CODES[problem.text] ?? 'misconfigured' })

const said = (text: string, vars: Vars = {}, more: { hint?: string; path?: string } = {}): Problem =>
  coded({ text, vars, ...(more.hint ? { hint: more.hint } : {}), ...(more.path ? { path: more.path } : {}) })

/** Thrown where a widget is for somebody else. */
export class Unavailable extends Error {
  // told apart by name: the config, and with it this class, may be loaded apart from the page that catches it
  override name = 'Unavailable'
}

/** Thrown where a widget is set up with something that is not there: as the config is built, or on its tile. */
export class Misconfigured extends Error {
  override name = 'Misconfigured'
  readonly problems: Problem[]
  constructor(problems: Said[], message?: string) {
    const all = problems.map(coded)
    super(message ?? all.map(problem => inWords(problem)).join(' '))
    this.problems = all
  }
}

/** What is wrong, by name of the error: a `Misconfigured`'s problems, and the one of a `TimedOut` (`timed-out`); nothing for any other. */
export const problemsOf = (error: unknown): Problem[] | undefined =>
  error instanceof Error && (error.name === 'Misconfigured' || error.name === 'TimedOut') ? ((error as { problems?: Said[] }).problems ?? []).map(coded) : undefined

/** Whether it is a read that took longer than `limits.timeoutMs`: a `TimedOut`, by name. */
export const timedOut = (error: unknown) => error instanceof Error && error.name === 'TimedOut'

const fill = (text: string, vars: Vars) => text.replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? String(vars[key]) : whole))

/** A problem as one sentence; `t` says it in another language. */
export const inWords = ({ text, vars, hint }: Said, t: (text: string, vars?: Vars) => string = fill as never) =>
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

const missing = (text: string, vars: Vars, among: string[], path?: string): Problem =>
  said(text, vars, { hint: closest(String(vars.name), among), path })

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
  ...(pick.as === 'progress' && !(Number(pick.goal) > 0) ? [said('Progress is towards a goal: give it one')] : []),
  ...(pick.compare && (!pick.period || ['all', 'past', 'upcoming'].includes(String(pick.period)) || (pick.period === 'custom' && !pick.from))
    ? [said('There is nothing before this to compare it with: give it a period that has a beginning')] : []),
]

/** What a widget read with the server's access leaves open: who it is for, and rows nobody could open. */
export const elevatedProblems = (kind: Kind, widget: { access?: unknown; overrideAccess?: unknown }, source: { access?: unknown }): Problem[] => [
  ...(widget.overrideAccess && kind === 'list' ? [said('A list is read as whoever looks at it: only a figure or a chart takes overrideAccess')] : []),
  ...(widget.overrideAccess && kind !== 'list' && !widget.access && !source.access
    ? [said('What is read with overrideAccess has to say who it is for: give it or its source an access')] : []),
]

/** What a chart is asked to tell apart that it cannot: one thing at a time, and not what its bars already are. */
export const seriesProblems = (pick: { measure?: unknown; by?: string; series?: string }): Problem[] => [
  ...(pick.series && Array.isArray(pick.measure) && pick.measure.length > 1 ? [said('A chart tells apart its measures or what is in a field, not both')] : []),
  ...(pick.series && pick.series === pick.by ? [said('A chart cannot be split by "{name}" twice', { name: pick.series })] : []),
]

/** What a widget picks from its source by name. */
export interface Names { filter?: string; measure?: string | object | (string | object | undefined)[]; list?: string; by?: string; series?: string }

/** Where a widget's measure is in what it was set up with: `measure`, or `measure.1` of several. */
export const measureAt = (measure: unknown, index: number) => (Array.isArray(measure) ? `measure.${index}` : 'measure')

/** The names a widget picks that its source does not have. */
export const nameProblems = (source: AnySource, pick: Names, kind: 'figure' | 'list' | 'chart'): Problem[] => {
  const vars = (name: string) => ({ source: source.slug, name })
  const found: Problem[] = []
  if (pick.filter && !source.filters[pick.filter]) found.push(missing('{source} has no filter called "{name}"', vars(pick.filter), Object.keys(source.filters)))
  // one said in place is checked against the collection's fields, once those are known: see `measureProblems`
  for (const [index, measure] of (kind === 'list' ? [] : [pick.measure].flat()).entries()) {
    if (typeof measure !== 'string') continue
    // a chart draws only what is a number in each record
    const measures = Object.keys(source.measures).filter(name => kind === 'figure' || !!source.measures[name].amount)
    if (!measures.includes(measure)) {
      found.push(missing(kind === 'chart' ? '{source} has no measure called "{name}" that can be drawn' : '{source} has no measure called "{name}"', vars(measure), measures, measureAt(pick.measure, index)))
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

const MOMENTS_COMPARED = ['equals', 'not_equals', 'in', 'not_in', 'greater_than', 'greater_than_equal', 'less_than', 'less_than_equal']

/**
 * What a filter asks that the collection cannot answer: a field it does not have, a comparison there is none of, a
 * choice a select does not offer, a date that is neither one nor a moment. Each is told where in the filter it is.
 */
export const whereProblems = (slug: string, fields: FlattenedField[], where: Where | undefined, at = ''): Problem[] => {
  if (!where || typeof where !== 'object') return []
  return Object.entries(where).flatMap(([key, condition]): Problem[] => {
    if (key === 'and' || key === 'or') {
      return Array.isArray(condition) ? condition.flatMap((inner, index) => whereProblems(slug, fields, inner, `${at}${key}.${index}.`)) : []
    }
    const field = fieldAt(fields, key)
    if (!field) return [missing('{source} has no field called "{name}"', { source: slug, name: key }, ['id', ...paths(fields)], `${at}${key}`)]
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return []
    return Object.entries(condition).flatMap(([operator, value]): Problem[] => {
      const path = `${at}${key}.${operator}`
      if (!OPERATORS.includes(operator)) return [missing('"{name}" is not a way to compare {field}', { field: key, name: operator }, OPERATORS, path)]
      if (typeof field !== 'object') return []
      if (field.type === 'date' && MOMENTS_COMPARED.includes(operator)) {
        return [value].flat().filter((one): one is string => typeof one === 'string' && one !== '' && !isMoment(one) && !isDateText(one))
          .map(one => missing('{field} is a date: "{name}" is neither a date (YYYY-MM-DD) nor a moment such as "today" or "startOfMonth-1m"',
            { field: key, name: one }, [...ANCHORS], path))
      }
      if ((field.type !== 'select' && field.type !== 'radio') || !['equals', 'not_equals', 'in', 'not_in', 'all'].includes(operator)) return []
      const offered = field.options.map(option => (typeof option === 'string' ? option : option.value))
      const asked = (Array.isArray(value) ? value : typeof value === 'string' && operator !== 'equals' && operator !== 'not_equals' ? value.split(',') : [value])
        .filter((one): one is string => typeof one === 'string' && one !== '')
      return asked.filter(one => !offered.includes(one))
        .map(one => missing('{field} has no choice called "{name}": it is one of {choices}', { field: key, name: one, choices: offered.join(', ') }, offered, path))
    })
  })
}

const isNumber = (field: FlattenedField) => field.type === 'number' && !(field as { hasMany?: boolean }).hasMany

/** The first part of a formula that is not one, with where it is: a number, a field, or one of the ways there are with what each takes. */
const malformed = (formula: unknown, at = ''): Problem[] => {
  if (typeof formula === 'number') return Number.isFinite(formula) ? [] : [said('In the formula, at "{at}": a part is a number, a number field, or one of add, subtract, multiply, divide, first and when', { at: at || 'the top' }, { path: at })]
  if (typeof formula === 'string' && formula) return []
  const way = wayOf(formula)
  if (!way) {
    return at
      ? [said('In the formula, at "{at}": a part is a number, a number field, or one of add, subtract, multiply, divide, first and when', { at }, { path: at })]
      : [said('A formula is a number, a number field, or one of add, subtract, multiply, divide, first and when')]
  }
  const here = `${at}${at ? '.' : ''}${way}`
  const parts = (formula as Record<string, unknown>)[way]
  if (way === 'when') {
    const { then, else: otherwise } = formula as { then?: unknown; else?: unknown }
    if (!parts || typeof parts !== 'object' || then === undefined) return [said('In the formula, at "{at}": when takes what a record has to have, and a then', { at: here }, { path: here })]
    return [...malformed(then, `${at}${at ? '.' : ''}then`), ...(otherwise === undefined ? [] : malformed(otherwise, `${at}${at ? '.' : ''}else`))].slice(0, 1)
  }
  if (!Array.isArray(parts)) return [said('In the formula, at "{at}": {way} takes at least one part', { at: here, way }, { path: here })]
  if ((way === 'subtract' || way === 'divide') && parts.length !== 2) return [said('In the formula, at "{at}": {way} takes two parts, not {count}', { at: here, way, count: parts.length }, { path: here })]
  if (!parts.length) return [said('In the formula, at "{at}": {way} takes at least one part', { at: here, way }, { path: here })]
  return parts.flatMap((part, index) => malformed(part, `${here}.${index}`)).slice(0, 1)
}

/** What a formula reads that the collection does not have as it needs it: a number that is none, a choice by a field that is not there. */
export const formulaProblems = (slug: string, fields: FlattenedField[], formula: Formula): Problem[] => {
  const wrong = malformed(formula)
  if (wrong.length) return wrong
  const { numbers, tested } = fieldsIn(formula)
  const offered = pathsOf(fields, isNumber)
  const every = pathsOf(fields, () => true)
  const rows = [...new Set([...numbers, ...tested.map(([path]) => path)].map(path => located(fields, path)?.rows).filter((path): path is string => !!path))]
  return [
    ...numbers.filter(path => !offered.includes(path)).map(path => missing('{source} has no number called "{name}"', { source: slug, name: path }, offered)),
    ...tested.flatMap(([path, asked]): Problem[] => {
      const field = located(fields, path)?.field
      if (!field) return [missing('{source} has no field called "{name}"', { source: slug, name: path }, every)]
      return Object.entries(asked ?? {}).flatMap(([how, value]): Problem[] => {
        if (!(COMPARISONS as readonly string[]).includes(how)) return [missing('"{name}" is not a way to compare {field}', { field: path, name: how }, [...COMPARISONS])]
        if ((field.type !== 'select' && field.type !== 'radio') || !['equals', 'not_equals', 'in', 'not_in'].includes(how)) return []
        const choices = field.options.map(option => (typeof option === 'string' ? option : option.value))
        return [value].flat().filter((one): one is string => typeof one === 'string' && !choices.includes(one))
          .map(one => missing('{field} has no choice called "{name}": it is one of {choices}', { field: path, name: one, choices: choices.join(', ') }, choices))
      })
    }),
    ...(rows.length > 1 ? [said('A formula reads the rows of one array, not of "{name}" and of "{other}"', { name: rows[0], other: rows[1] })] : []),
  ]
}

/**
 * A measure said in place that is of nothing the source can make a figure of: neither a number of the collection nor
 * a measure that adds one up. Each is told where it is, `at` the measure: `measure.avg`, `measure.sum.multiply.0`.
 */
export const measureProblems = (source: AnySource, fields: FlattenedField[], measure: unknown, at = 'measure'): Problem[] => {
  if (!measure || typeof measure !== 'object') return []
  const found = calcOf(measure)
  if (!found) return [said('A measure said in place is the sum, avg, min or max of a number', {}, { path: at })]
  const [how, name] = found
  const here = `${at}.${how}`
  if (typeof name !== 'string') return formulaProblems(source.slug, fields, name).map(problem => ({ ...problem, path: problem.path ? `${here}.${problem.path}` : here }))
  if (source.measures[name]?.amount) return []
  const numbers = pathsOf(fields, isNumber)
  if (numbers.includes(name)) return []
  const measures = Object.keys(source.measures).filter(other => !!source.measures[other].amount)
  return [missing('{source} has no number called "{name}"', { source: source.slug, name }, [...new Set([...numbers, ...measures])], here)]
}

/** A date a widget is asked to go by that is not one, or that a record has several of. */
export const dateProblems = (slug: string, fields: FlattenedField[], date: string | undefined, path?: string): Problem[] => {
  if (!date) return []
  const field = fieldAt(fields, date)
  if (!field) return [missing('{source} has no field called "{name}"', { source: slug, name: date }, paths(fields), path)]
  if (located(fields, date)?.rows) return [said('"{name}" of {source} is in the rows of an array: a period goes by a date of the record itself', { source: slug, name: date }, { path })]
  return typeof field === 'object' && field.type !== 'date' ? [said('"{name}" of {source} is not a date', { source: slug, name: date }, { path })] : []
}

/**
 * What a declared source says of its collection that the collection does not have: a date that is none, a group by
 * a field that is not there, a filter or a scope on what is not there, a measure of a number there is none of.
 * Each is told where in the source it is: `groups.custmer`, `filters.unpaid.where.status.equals`.
 */
export const sourceProblems = (source: AnySource, fields: FlattenedField[]): Problem[] => {
  const { slug } = source
  const under = (prefix: string) => (problem: Problem): Problem => ({ ...problem, path: problem.path ? `${prefix}.${problem.path}` : prefix })
  const numbers = pathsOf(fields, isNumber)
  return [
    ...dateProblems(slug, fields, source.date, 'date'),
    ...Object.keys(source.dates ?? {}).flatMap(date => dateProblems(slug, fields, date, `dates.${date}`)),
    ...Object.keys(source.groups ?? {}).flatMap(group => (fieldAt(fields, group)
      ? [] : [missing('{source} has no field called "{name}"', { source: slug, name: group }, paths(fields), `groups.${group}`)])),
    ...Object.entries(source.filters).flatMap(([name, { where }]) =>
      (typeof where === 'function' ? [] : whereProblems(slug, fields, where as Where)).map(under(`filters.${name}.where`))),
    ...Object.entries(source.scopes ?? {}).flatMap(([name, scope]) => {
      let where: Where | undefined
      // a scope is asked with an id that says nothing, to see what it narrows by: the id itself is not checked
      try { where = (scope as (id: number | string) => Where)(0) } catch { return [] }
      return whereProblems(slug, fields, where).map(under(`scopes.${name}`))
    }),
    ...Object.entries(source.measures).flatMap(([name, { amount }]): Problem[] => {
      const plain = amount?.plain
      if (!plain) return []
      if (plain.formula !== undefined) return formulaProblems(slug, fields, plain.formula).map(under(`measures.${name}`))
      return [
        ...(plain.field && !numbers.includes(plain.field)
          ? [located(fields, plain.field)
            ? said('"{name}" of {source} is not a number', { source: slug, name: plain.field }, { path: `measures.${name}` })
            : missing('{source} has no number called "{name}"', { source: slug, name: plain.field }, numbers, `measures.${name}`)]
          : []),
        ...(plain.currency && !fieldAt(fields, plain.currency)
          ? [missing('{source} has no field called "{name}"', { source: slug, name: plain.currency }, paths(fields), `measures.${name}.currency`)] : []),
      ]
    }),
  ]
}

/** Where the plugin's own widgets in a drawer, and Payload's, are called. */
export const RESERVED: Record<string, string> = { figure: 'the plugin', records: 'the plugin', chart: 'the plugin', collections: 'Payload' }

/** Widgets called as another is: by the project, by the plugin, by Payload, or by what the dashboard already had. */
export const slugProblems = (slugs: string[], taken: Record<string, string> = {}): [string, Problem][] => {
  const seen = new Set<string>()
  return slugs.flatMap((slug): [string, Problem][] => {
    const owner = RESERVED[slug] ?? taken[slug]
    if (owner) return [[slug, said('A widget cannot be called "{name}": {owner} has one called that', { name: slug, owner })]]
    if (seen.has(slug)) return [[slug, said('There are two widgets called "{name}"', { name: slug })]]
    seen.add(slug)
    return []
  })
}

/**
 * The keys of a dictionary that are not the widgets' words but come close to one: misspelt, most likely, and so never
 * said. A project's own words are left alone unless they come as close. By language, key, and what was meant.
 */
export const misspelt = (translations: Record<string, Record<string, string>>): [string, string, string][] => {
  const words = STRINGS as readonly string[]
  return Object.entries(translations).flatMap(([language, dictionary]) => Object.keys(dictionary).flatMap((key): [string, string, string][] => {
    if (words.includes(key)) return []
    const meant = closest(key, [...words])
    return meant ? [[language, key, meant]] : []
  }))
}

// What the fields of the collections say of the widgets and the sources: as the config is built, and once Payload has settled it.

/** A collection's fields, by its slug; nothing where they are not all known yet. */
export type FieldsOf = (slug: string) => FlattenedField[] | undefined

/**
 * What a widget or a source asks of the fields of a collection that it does not have: a filter on a field there is
 * none of, a date that is none, a group, a scope or a measure of what is not there. Only of the collections whose
 * fields are known.
 */
export const fieldProblems = (settings: Pick<Settings, 'sources' | 'widgets'>, fieldsOf: FieldsOf): [string, Problem][] => [
  ...Object.entries(settings.sources).flatMap(([name, source]) => {
    const fields = fieldsOf(source.slug)
    return fields ? sourceProblems(source, fields).map((problem): [string, Problem] => [`sources.${name}`, problem]) : []
  }),
  ...settings.widgets.flatMap((widget): [string, Problem][] => {
    if (widget.kind === 'own') return []
    const source = typeof widget.source === 'string'
      ? settings.sources[widget.source] ?? Object.values(settings.sources).find(one => one.slug === widget.source) : widget.source
    const fields = source && fieldsOf(source.slug)
    if (!source || !fields) return []
    return [
      ...whereProblems(source.slug, fields, widget.show.where, 'where.'), ...dateProblems(source.slug, fields, widget.show.date, 'date'),
      ...(widget.kind === 'list' ? [] : [widget.show.measure].flat().flatMap((measure, index) => measureProblems(source, fields, measure, measureAt(widget.show.measure, index)))),
    ].map(problem => [`widgets.${widget.slug}`, problem])
  }),
]

const date = (name: string) => ({ name, type: 'date' }) as FlattenedField

/**
 * The fields of the collections as the config has them, and as Payload will: with when a record was made and changed.
 * What else Payload adds as it settles them (to log in, to upload, to keep in folders) is not known yet, so such a
 * collection is checked only once Payload has started; so is one that a plugin running later adds.
 */
export const fieldsInConfig = (config: Config): FieldsOf => {
  const known = new Map((config.collections ?? []).filter(collection => !collection.auth && !collection.upload && !collection.folders)
    .map(collection => [collection.slug as string, stamped(collection, flattenAllFields({ fields: collection.fields }))]))
  return slug => known.get(slug)
}

/** With when a record was made and changed, where the collection keeps that and the fields do not already say so. */
export const stamped = (collection: { timestamps?: boolean }, fields: FlattenedField[]) =>
  (collection.timestamps === false ? fields : [...fields, ...['createdAt', 'updatedAt'].filter(name => !fields.some(field => field.name === name)).map(date)])
