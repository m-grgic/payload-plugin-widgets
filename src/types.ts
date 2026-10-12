import type { Access, CollectionSlug, DataFromCollectionSlug, Payload, PayloadRequest, Where, WhereField } from 'payload'

// What a collection offers to the widgets: the sets of its records worth looking at (filters), what can be told about
// a set (measures: a count, a sum, or a figure worked out by a function), short lists, and what it can be split by.
// A widget only picks from this, on the dashboard or on any other page of the admin.
// Nothing here may import a component: the sources are also read by the Payload config.

export type Tone = 'calm' | 'warn' | 'bad'
export type Kind = 'figure' | 'list' | 'chart'

/** How a widget of each kind is drawn without anything of the project's own, each with what to call it: the first unless said otherwise. */
export const VIEWS = {
  figure: { number: 'A number', progress: 'Progress towards a goal', sparkline: 'A number over a line' },
  list: { rows: 'Rows' },
  chart: { bars: 'Bars', columns: 'Columns', line: 'A line' },
} as const satisfies Record<Kind, Record<string, string>>

/**
 * A way of the project's own to draw a widget of one kind: a component by its path, as Payload takes them. It is
 * handed what the tile would be made of (see `FigureViewProps`, `ListViewProps` and `ChartViewProps` in ./components).
 */
export interface View { kind: Kind; label: Label; Component: string }
/** How a number is written: as it is, as an amount in a currency, or as hours, which are kept in minutes. */
export type Format = 'number' | 'money' | 'hours'
/** How the numbers of many records are made one: added up, their average, the lowest or the highest of them. */
export type Calc = 'sum' | 'avg' | 'min' | 'max'
export const CALCS: readonly Calc[] = ['sum', 'avg', 'min', 'max']
export type Doc<S extends CollectionSlug> = DataFromCollectionSlug<S>
export type Vars = Record<string, number | string>
/** What something is called: in English, for `translate` in the options to say otherwise, or in several languages by their codes, as Payload's own labels are. */
export type Label = string | Record<string, string>
export type Viewer = NonNullable<PayloadRequest['user']>

/**
 * Who something is for, asked the way Payload asks it of a collection, with the same functions: nobody (`false`),
 * everybody (`true`), or only some of the records, as a filter.
 *
 *   access: ({ req }) => req.user?.role === 'admin'
 *   access: ({ req }) => ({ owner: { equals: req.user?.id } })
 */
export type { Access }

export const PERIODS = [
  { label: 'Any time', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'Before today', value: 'past' },
  { label: 'From today on', value: 'upcoming' },
  { label: 'This month', value: 'month' },
  { label: 'This year', value: 'year' },
  { label: 'The last 30 days', value: 'last30' },
  { label: 'The last 12 months', value: 'last12' },
  // between two dates the widget is given; either may be left open
  { label: 'Between two dates', value: 'custom' },
] as const

export type Period = (typeof PERIODS)[number]['value']

export interface Context {
  payload: Payload
  /** The request of whoever is looking. */
  req: PayloadRequest
  /** Options for a read made as the signed-in user; with the server's access where the widget asks for that (`overrideAccess`). */
  as: { depth: 0; overrideAccess: boolean; user: Viewer }
  /** Every source the widgets were given, by name, and whether one is for the person looking. */
  sources: Record<string, AnySource>
  /** Asked of what the collection lets them read, and of the source's own `access` where it has one. */
  mayRead: (source: AnySource) => Promise<boolean>
  /** Today in the time zone the widgets were given, as YYYY-MM-DD. */
  today: string
  /** The start of today, of this month and of this year there, as instants. */
  dayStart: string
  monthStart: string
  yearStart: string
  /** The day an instant falls on there, and the instant a day starts at. */
  date: (value: Date | string) => string
  instant: (date: string) => string
  /** The currency amounts are in where a record does not say, and the only one a chart draws. */
  currency: string
  /** What the widget was set up with. */
  data: Record<string, unknown>
  /** The list view of a collection, filtered. */
  list: (slug: CollectionSlug, where?: Where) => string
  edit: (slug: CollectionSlug, id: number | string) => string
  // in the language of the request
  t: (text: Label, vars?: Vars) => string
  plural: (count: number, one: string, many: string) => string
  number: (value: number) => string
  hours: (minutes: number) => string
  money: (amount: number, currency: string) => string
  /** Amounts per currency as one text. */
  total: (totals: Map<string, number>) => string
  day: (date: string) => string
  /** The month a day is in, with its year: "Oct 26". */
  month: (date: string) => string
  /** The day a week starts on: 0 for Sunday to 6 for Saturday. */
  weekStartsOn: number
}

/**
 * The records a widget is about. The admin's list view reads filters as alternatives of conditions that all hold,
 * so that is how they are kept: the same object then serves the query and the link to the list.
 */
export class Selection {
  constructor(readonly alternatives: Where[][] = [[]]) {}

  /** The same records, narrowed by more conditions. */
  and(...more: Where[]): Selection {
    return new Selection(this.alternatives.map(conditions => [...conditions, ...more]))
  }

  /** Narrowed by something that has alternatives of its own. */
  within(other: Selection): Selection {
    return new Selection(this.alternatives.flatMap(mine => other.alternatives.map(theirs => [...mine, ...theirs])))
  }

  get where(): Where {
    return this.alternatives.every(conditions => !conditions.length) ? {} : { or: this.alternatives.map(conditions => ({ and: conditions })) }
  }

  /** For a link: nothing where there is nothing to filter by. */
  get filter(): Where | undefined {
    return this.alternatives.every(conditions => !conditions.length) ? undefined : this.where
  }
}

export const any = (...alternatives: Where[][]) => new Selection(alternatives)

/** A field's or a collection's name as words: `estimatedTime` and `time-tracking` as "Estimated time" and "Time tracking". */
export const worded = (name: string) => {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_.]+/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** A label as Payload's config has them, as one of ours: one that is worked out by a function is replaced by the name in words. */
export const labelled = (label: unknown, name: string): Label =>
  typeof label === 'string' && label ? label
    : label && typeof label === 'object' && Object.values(label).every(value => typeof value === 'string') ? label as Record<string, string>
      : worded(name)

/** What a source is called: what it was given, or what its collection is. */
export const nameOf = (payload: Payload, from: AnySource): Label =>
  from.label ?? labelled(payload.collections[from.slug as CollectionSlug]?.config.labels?.plural, from.slug)

const leaf = (where: Where) => !('or' in where) && !('and' in where)

/**
 * A filter as Payload takes them anywhere, `and` and `or` included, as a selection. What the admin's filter builder
 * writes, alternatives of conditions, stays in that shape, so the list behind a widget can show it; anything nested
 * deeper is kept whole as one condition.
 */
export const selected = (where: Where | undefined | null): Selection => {
  if (!where || typeof where !== 'object' || !Object.keys(where).length) return new Selection()
  const split = (one: Where): Where[] => (leaf(one) ? Object.entries(one).map(([field, condition]) => ({ [field]: condition }) as Where) : [one])
  const keys = Object.keys(where)
  if (keys.length === 1 && Array.isArray(where.or)) {
    return new Selection(where.or.map(alternative =>
      Object.keys(alternative).length === 1 && Array.isArray(alternative.and) && alternative.and.every(leaf) ? alternative.and.flatMap(split) : split(alternative)))
  }
  if (keys.length === 1 && Array.isArray(where.and) && where.and.every(leaf)) return new Selection([where.and.flatMap(split)])
  return new Selection([split(where)])
}

/** The fields of a collection that hold a number. */
export type Numbers<S extends CollectionSlug> = { [P in keyof Doc<S> & string]: NonNullable<Doc<S>[P]> extends number ? P : never }[keyof Doc<S> & string]

/**
 * A measure said in place, without declaring it: one of a collection's numbers, or of a source's measures that add
 * one up, made one figure in one of four ways.
 *
 *   measure: { avg: 'total' }
 *   measure: { max: 'estimatedTime', format: 'hours' }
 *
 * How it is written is the field's own (see `FieldHint`) or the measure's where nothing is said here.
 */
export type Reckoned<N extends string = string> = { [C in Calc]: { [K in C]: N } & { [K in Exclude<Calc, C>]?: never } }[Calc] & {
  format?: Format
  /** Where it is money: the field that holds the currency of a record. */
  currency?: string
}

export interface Reading {
  value: string; note?: string; tone?: Tone; href?: string
  /** The figure as a number: what is compared with the period before and set against a goal. A measure of the project's own gives it to take part in those. */
  amount?: number
}

/** One point of what a figure was over time. */
export interface Point { label: string; amount: number; shown: string }

/** What a figure is asked for besides its number: all of it is read, none of it says how the tile looks. */
export interface More {
  /** The same measure over the period before: needs a period that has a beginning. */
  previous?: { value: string; amount: number }
  /** Whether it is more or less than then. */
  trend?: 'up' | 'down' | 'flat'
  /** What it is set against, and how much of that it is: 1 is all of it. */
  goal?: { value: string; amount: number; share: number }
  /** What it was over time. */
  series?: Point[]
}
export interface Row { title: string; detail: string; href: string; late?: boolean }
export interface ListReading {
  note: string; tone: Tone; rows: Row[]; empty: string; href?: string
  /** The form for a new one, where the person looking may add one. */
  add?: { href: string; label: string }
  /** A box that adds one by a single field, its title unless said otherwise. */
  quick?: { slug: string; field?: string; data?: Record<string, unknown>; placeholder: string }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

/**
 * One condition of a filter: on a field of the collection, which the editor offers, or on a path into what a field
 * points at (`task.project`), which it cannot know.
 */
export type Condition<S extends CollectionSlug = Loose> = { [P in keyof Doc<S> & string]?: WhereField } | Where | Record<string, WhereField | undefined>

/** A filter as Payload takes them anywhere, with the collection's fields offered by the editor at every level of `and` and `or`. */
export type Narrowing<S extends CollectionSlug = Loose> = ({ [P in keyof Doc<S> & string]?: WhereField } & { and?: Narrowing<S>[]; or?: Narrowing<S>[] }) | Where

/** What records are sorted by: a field, with `-` before it for the other way round. */
export type Sort<S extends CollectionSlug = Loose> = (keyof Doc<S> & string) | `-${keyof Doc<S> & string}` | (string & {})

export interface Filter<S extends CollectionSlug = Loose> {
  label: Label
  /**
   * Which records, as Payload filters them anywhere, moments by name included: `{ dueDate: { less_than: 'today' } }`.
   * Or worked out for whoever is looking: a function that gives the same, conditions that all hold, or a selection
   * where there are alternatives (`any([…], […])`).
   */
  where: Narrowing<S> | ((context: Context) => Selection | Condition<S>[] | Narrowing<S>)
  /** What is worth saying under the number of them. */
  remark?: (context: Context, found: number, selection: Selection, source: AnySource) => Promise<Pick<Reading, 'note' | 'tone'>> | Pick<Reading, 'note' | 'tone'>
}

/** The number in a record that a sum adds up and a chart draws. */
export interface Amount<D> {
  select: (keyof D & string)[]
  of: (doc: D) => number
  format: Format
  /** Where it is money: the currency of a record. One that has none counts in the currency the widgets were given. */
  currency?: (doc: D) => string | null | undefined
  /** How the records' numbers are made one; added up where it is left out. */
  how?: Calc
  /** What the records it is made of are called, for one and for more of them; "record" where it is left out. */
  unit?: [string, string]
  /** Declared without saying how it is written: the field says, where the plugin finds it in the collection. */
  loose?: true
}

/** A measure as a source can declare it in place: `{ avg: 'total', format: 'money', currency: 'currency' }`. */
export type MeasureSpec<S extends CollectionSlug = Loose, F extends string = string> = Reckoned<Numbers<S> | (string & {})> & {
  /** Named after the field and how it is worked out where it is left out. */
  label?: Label
  filter?: F
}

/** What a measure or a list is handed to read from: the source it is declared in. */
export type From<S extends CollectionSlug> = Source<S, Loose, Loose, Loose, Loose, Loose>

export interface Measure<S extends CollectionSlug = Loose, F extends string = string> {
  label: Label
  /** Kept to one filter where it only makes sense there; the widget's own filter is then left aside. */
  filter?: F
  read: (context: Context, selection: Selection, source: From<S>) => Promise<Reading>
  /** A plain count, which lets the filter say what is worth saying about what it found. */
  counts?: true
  /** With it the measure can also be drawn over time or by group. */
  amount?: Amount<Doc<S>>
}

export interface List<S extends CollectionSlug = Loose, F extends string = string> {
  label: Label
  filter?: F
  read: (context: Context, selection: Selection, source: From<S>, limit: number) => Promise<ListReading>
}

/**
 * A collection as the widgets see it. The names of its filters, measures, lists, groups and scopes are part of its
 * type, so a widget that picks one that is not there does not compile.
 */
export interface Source<
  S extends CollectionSlug = CollectionSlug,
  F extends string = string, M extends string = string, L extends string = string, G extends string = string, K extends string = string,
> {
  slug: S
  /** The collection's own where it is left out. */
  label?: Label
  /**
   * Who it is for, on top of what the collection lets them read: asked as Payload asks a collection, so the same
   * functions serve. A filter in place of `true` leaves its widgets only those records.
   */
  access?: Access
  /** Left as it is declared: nothing the plugin finds in the collection by itself is added to it. */
  discover?: boolean
  /** The collection keeps drafts: the admin lists the latest version of each, and so do the widgets. */
  draft?: boolean
  /** The date a period and a chart over time go by; `createdAt` where it is left out. */
  date?: keyof Doc<S> & string
  /** The other dates a widget can go by instead, each with what to call it. */
  dates?: Record<string, Label>
  filters: Record<F, Filter<S>>
  measures: Record<M, Measure<S, F>>
  lists?: Record<L, List<S, F>>
  /**
   * The fields it can be split by, each with what to call it. A select field gives the labels of its options,
   * a relationship the titles of what it points at.
   */
  groups?: Record<G, Label>
  /** How to narrow it to one of something, by what that is called: a widget on the page of a project is given `{ project: id }`. */
  scopes?: Record<K, (id: number | string) => Where>
}

/** A source whatever it is of: what is kept, and what the widgets somebody sets up themselves read by name. */
export type AnySource = Source<Loose, Loose, Loose, Loose, Loose, Loose>

/**
 * Declares a source. The collection's generated type checks the field names and types the records its measures and
 * lists are handed; the names of what is declared are checked wherever a widget picks from it.
 *
 *   export const tasks = source('tasks', {
 *     label: 'Tasks', access: ({ req }) => req.user?.role === 'admin', date: 'dueDate',
 *     filters: { open: { where: { status: { not_equals: 'done' } } }, late: { label: 'Overdue', where: { dueDate: { less_than: 'today' } } } },
 *     measures: { estimated: { sum: 'estimatedTime', format: 'hours' } },
 *     groups: { status: 'Status' },
 *   })
 */
export const source = <
  const S extends CollectionSlug,
  F extends string = never, M extends string = never, L extends string = never,
  // the whole of `groups` rather than its names, so that the editor offers the collection's fields for them
  const G extends Partial<Record<keyof Doc<S> & string, string>> = Record<never, string>, K extends string = never,
>(slug: S, definition: {
  /** The collection's own where it is left out. */
  label?: Label
  /** Who it is for, on top of what the collection lets them read; a filter leaves its widgets only those records. */
  access?: Access
  /**
   * `false` to have only what is declared here. Otherwise what the plugin finds in the collection by itself is
   * there too: a sum for each number field, a group for each select and relationship, a list of the latest.
   */
  discover?: boolean
  draft?: boolean
  date?: keyof Doc<S> & string
  /** Each with what it is called; named after its key where that is left out. */
  filters?: Record<F, Omit<Filter<S>, 'label'> & { label?: Label }>
  /**
   * How many there are is always there, as `count`: declare it only to call it something else. One that only makes
   * one figure of a number field can be said in place: `{ average: { avg: 'total', format: 'money' } }`.
   */
  measures?: Record<M, Measure<S, NoInfer<F>> | MeasureSpec<S, NoInfer<F>>>
  lists?: Record<L, List<S, NoInfer<F>>>
  /** The fields it can be split by, each with what to call it: `{ status: 'Status' }`. */
  groups?: Partial<Record<keyof Doc<S> & string, string>> & G & Record<Exclude<keyof G, keyof Doc<S>>, never>
  scopes?: Record<K, (id: number | string) => Where>
}): Source<S, F, M | 'count', L, keyof G & string, K> => {
  const filters = Object.fromEntries(Object.entries(definition.filters ?? {}).map(([name, filter]) => [name, { label: worded(name), ...(filter as object) }]))
  const measures = Object.fromEntries(Object.entries(definition.measures ?? {}).map(([name, measure]) => [name, 'read' in (measure as object) ? measure : declared(name, measure as MeasureSpec)]))
  return { ...definition, slug, filters, measures: 'count' in measures ? measures : { count: count(), ...measures } } as Loose
}

/** How many records a sum or a chart reads at most. */
export const MANY = 5000

/** Every record of a selection with only the fields asked for, whatever the source. */
export const fetched = async <D>(context: Context, from: AnySource, selection: Selection, select: string[], more: { limit?: number; sort?: string } = {}): Promise<D[]> => {
  // generic over the collection, which the typed local API cannot follow
  const { docs } = await (context.payload.find as Loose)({
    ...context.as, collection: from.slug, where: selection.where, pagination: false, limit: more.limit ?? MANY,
    ...(more.sort ? { sort: more.sort } : {}),
    ...(from.draft ? { draft: true } : {}),
    ...(select.length ? { select: Object.fromEntries(select.map(field => [field, true])) } : {}),
  })
  return docs
}

/** A record with only the fields that were asked for, and its id. */
export type Selected<S extends CollectionSlug, K extends keyof Doc<S>> = Pick<Doc<S>, K | ('id' & keyof Doc<S>)>

/** Every record of a selection, with only the fields asked for: typed as the collection's records, kept to those fields. */
export const records = <S extends CollectionSlug, const K extends keyof Doc<S> & string>(
  context: Context, from: From<S>, selection: Selection, select: K[], more: { limit?: number; sort?: Sort<S> } = {},
): Promise<Selected<S, K>[]> => fetched(context, from, selection, select, more)

export const counted = async (context: Context, from: AnySource, selection: Selection): Promise<number> =>
  from.draft
    // counting does not know about drafts, so the latest versions are read and counted
    ? (await fetched(context, from, selection, [])).length
    : (await (context.payload.count as Loose)({ ...context.as, collection: from.slug, where: selection.where })).totalDocs

export const shown = (context: Context, format: Format, totals: Map<string, number>) => {
  if (format === 'money') return totals.size ? context.total(totals) : context.money(0, context.currency)
  const amount = [...totals.values()].reduce((sum, value) => sum + value, 0)
  return format === 'hours' ? context.hours(amount) : context.number(amount)
}

/** The currency a record's amount is in. */
export const currencyOf = <D>(context: Context, amount: Amount<D>, doc: D) => (amount.currency?.(doc) || context.currency).toUpperCase()

/** Many numbers as one: added up unless said otherwise. Nothing counts as nought. */
export const combined = (how: Calc | undefined, values: number[]) => {
  if (!values.length) return 0
  if (how === 'min') return values.reduce((least, value) => Math.min(least, value))
  if (how === 'max') return values.reduce((most, value) => Math.max(most, value))
  const total = values.reduce((sum, value) => sum + value, 0)
  return how === 'avg' ? total / values.length : total
}

/** The records' amounts made one as the measure has it, per currency where they are money. */
export const added = <D>(context: Context, docs: D[], amount: Amount<D>) => {
  const each = new Map<string, number[]>()
  for (const doc of docs) {
    const currency = amount.format === 'money' ? currencyOf(context, amount, doc) : ''
    each.set(currency, [...(each.get(currency) ?? []), amount.of(doc)])
  }
  return new Map([...each].map(([currency, values]) => [currency, combined(amount.how, values)]))
}

/** A measure that makes one figure of a number in each record: as a figure, and as what a chart draws. */
export const reckoned = <S extends CollectionSlug = Loose>(label: Label, amount: Amount<Doc<S>>, more: { filter?: string } = {}): Measure<S, never> => ({
  label,
  amount,
  ...(more.filter ? { filter: more.filter as never } : {}),
  read: async (context, selection, from) => {
    const docs = await fetched<Doc<S>>(context, from, selection, amount.select)
    const totals = added(context, docs, amount)
    // more than can be read at once: said, so the figure is not taken for all of them
    const cut = docs.length >= MANY
    return {
      value: shown(context, amount.format, totals),
      // of money, what is in the currency the widgets were given
      amount: totals.get(amount.format === 'money' ? context.currency.toUpperCase() : '') ?? 0,
      note: cut ? context.t('Only the first {count} are counted', { count: context.number(MANY) })
        : docs.length ? context.plural(docs.length, amount.unit?.[0] ?? 'record', amount.unit?.[1] ?? 'records') : context.t('Nothing recorded yet'),
      ...(cut ? { tone: 'warn' as const } : {}),
    }
  },
})

/** What a measure said in place is called where it is given no name: the field, and how it is worked out. */
export const CALLED: Record<Calc, string> = { sum: '{what}', avg: 'Average {what}', min: 'Lowest {what}', max: 'Highest {what}' }

/** The number a record has in a field, and its currency where another field holds that. */
export const amountOf = (field: string, format: Format, how: Calc, currency?: string): Amount<Loose> => ({
  select: [field, ...(currency ? [currency] : [])],
  of: doc => Number(doc[field]) || 0,
  format,
  how,
  ...(currency ? { currency: doc => (doc[currency] ? String(doc[currency]) : undefined) } : {}),
})

/** How a measure said in place is worked out, and of what. */
export const calcOf = (spec: unknown): [Calc, string] | undefined => {
  const how = spec && typeof spec === 'object' ? CALCS.find(calc => typeof (spec as Record<string, unknown>)[calc] === 'string') : undefined
  return how ? [how, (spec as Record<Calc, string>)[how]] : undefined
}

const declared = (name: string, spec: MeasureSpec): Measure => {
  const [how, field] = calcOf(spec) ?? ['sum', name]
  return reckoned(spec.label ?? worded(name), { ...amountOf(field, spec.format ?? 'number', how, spec.currency), ...(spec.format ? {} : { loose: true as const }) }, { filter: spec.filter })
}

/** How many there are. What is worth adding comes from the filter, see `Filter.remark`. */
export const count = (label: Label = 'How many'): Measure<Loose, never> => ({
  label,
  counts: true,
  amount: { select: [], of: () => 1, format: 'number' },
  read: async (context, selection, from) => {
    const found = await counted(context, from, selection)
    return { value: String(found), amount: found }
  },
})

/** A number field added up: as a figure, and as what a chart draws. */
export const sum = <S extends CollectionSlug>(label: Label, field: keyof Doc<S> & string, format: Format, more: {
  currency?: keyof Doc<S> & string
  note?: [string, string]
  /** Where a record does not simply count as its field: what else to read, and what it counts as. */
  select?: (keyof Doc<S> & string)[]
  of?: (doc: Doc<S>) => number
} = {}): Measure<S, never> => {
  type D = Doc<S>
  const amount: Amount<D> = {
    select: [field, ...(more.currency ? [more.currency] : []), ...(more.select ?? [])],
    of: more.of ?? (doc => Number(doc[field]) || 0),
    format,
    ...(more.note ? { unit: more.note } : {}),
    ...(more.currency ? { currency: doc => (doc[more.currency as keyof D] ? String(doc[more.currency as keyof D]) : undefined) } : {}),
  }
  return reckoned<S>(label, amount)
}

/** The first few records of a selection as rows. */
export const rows = <S extends CollectionSlug, const K extends keyof Doc<S> & string, const F extends string = never>(label: Label, spec: {
  /** The fields a row is made of: `doc` in `row` has these and no others. */
  select: K[]
  sort: Sort<S>
  row: (doc: Selected<S, K>, context: Context) => Omit<Row, 'href'>
  /** What it says where there are none. */
  empty: string
  /** Kept to one of the source's filters, whatever the widget's own. */
  filter?: F
  more?: (context: Context) => Pick<ListReading, 'add' | 'quick'>
}): List<S, F> => ({
  label,
  ...(spec.filter ? { filter: spec.filter } : {}),
  read: async (context, selection, from, limit) => {
    const [docs, found] = await Promise.all([
      fetched<Selected<S, K> & { id: number | string }>(context, from, selection, spec.select, { limit, sort: spec.sort }),
      counted(context, from, selection),
    ])
    const made = docs.map(doc => ({ ...spec.row(doc, context), href: context.edit(from.slug, doc.id) }))
    const late = made.filter(row => row.late).length
    return {
      note: found ? context.t('{count} in all', { count: found }) : '',
      tone: late ? 'bad' : 'calm',
      rows: made,
      empty: context.t(spec.empty),
      ...spec.more?.(context),
    }
  },
})
