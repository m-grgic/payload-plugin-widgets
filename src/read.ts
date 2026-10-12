import type { Access, CollectionSlug, FlattenedField, Where } from 'payload'
import { dateProblems, figureProblems, measureProblems, Misconfigured, nameProblems, noSource, Unavailable, isDate, whereProblems, type Problem } from './check'
import { accessTo, readable, sourceCalled } from './options'
import { after } from './time'
import { months, timed as atMoments } from './when'
import { added, amountOf, CALLED, calcOf, combined, currencyOf, fetched, labelled, MANY, nameOf, reckoned, selected, Selection, shown, type Amount, type AnySource, type Context, type Format, type Label, type ListReading, type Measure, type More, type Period, type Reading, type Reckoned, type Tone } from './types'

// What a widget shows, read out of a source: a figure, a short list, or bars over time or by group.
// The same three serve the dashboard and any other page, which may pass a scope: one project, one client.

export interface Pick {
  /** The source itself, or the name it was given to the plugin by: what a widget somebody set up themselves keeps. */
  source: AnySource | string
  /** One of the source's filters; none is all of its records. */
  filter?: string
  /** Which of its records, as Payload filters them anywhere, `and` and `or` included. On top of `filter`, where both are given. */
  where?: Where
  period?: Period
  /** The date the period goes by: the source's own where it is left out. */
  date?: string
  /** For the period between two dates: the first and the last day, as YYYY-MM-DD. Either may be left out. */
  from?: string
  to?: string
  /** Only what belongs to one of something, as the source's `scopes` call it: `{ project: 12 }`. */
  scope?: Record<string, number | string>
  /** Who it is for, on top of who its source is for: asked as Payload asks a collection, a filter leaving only some of the records. */
  access?: Access
}
/** Read with the server's access in place of the person's own: only what gives no records away, a figure and a chart. */
interface Elevated { overrideAccess?: boolean }
/** One of the source's measures by name, or one said in place: `{ avg: 'total' }`. */
type Measured = string | Reckoned
export interface FigurePick extends Pick, Elevated {
  measure?: Measured
  /** Also read for the period before this one, which is as long and ends where this one starts. */
  compare?: 'previous'
  /** What the figure is set against, in what the measure counts. */
  goal?: number
  /**
   * What the line under the figure says, in place of the usual: `'{change} on last month'`, `'{left} to go'`. It can
   * use `{value}`, `{note}` (what it would have said), with `compare` `{previous}` and `{change}`, and with a goal
   * `{goal}`, `{percent}` and `{left}`.
   */
  note?: string
  /** How it is drawn, where that asks for more to be read: a sparkline needs the figure over time. */
  as?: string
}
export interface ListPick extends Pick { list?: string; limit?: number }
export interface ChartPick extends Pick, Elevated { measure?: Measured; by?: string }

export interface Bar { label: string; amount: number; shown: string; href?: string }
/** `href` is the list behind it: there for whoever the collection lets read. */
export interface ChartReading { note: string; href?: string; bars: Bar[]; empty: string }

export { Misconfigured, Unavailable }

const DAY = /^\d{4}-\d{2}-\d{2}/

/** The days a period runs from and to, as YYYY-MM-DD; without an end it runs until now. */
const span = (context: Context, pick: Pick): { start: string | null; end: string | null } => {
  const { today } = context
  if (pick.period === 'today') return { start: today, end: today }
  if (pick.period === 'past') return { start: null, end: after(today, -1) }
  if (pick.period === 'upcoming') return { start: today, end: null }
  if (pick.period === 'month') return { start: `${today.slice(0, 7)}-01`, end: null }
  if (pick.period === 'year') return { start: `${today.slice(0, 4)}-01-01`, end: null }
  if (pick.period === 'last30') return { start: after(today, -30), end: null }
  if (pick.period === 'last12') {
    const [year, month] = today.split('-').map(Number)
    return { start: new Date(Date.UTC(year, month - 12, 1)).toISOString().slice(0, 10), end: null }
  }
  if (pick.period === 'custom') {
    const day = (value: unknown) => (typeof value === 'string' && DAY.test(value) ? context.date(value.length > 10 ? value : `${value}T12:00:00Z`) : null)
    return { start: day(pick.from), end: day(pick.to) }
  }
  return { start: null, end: null }
}

const named = (context: Context, source: AnySource | string): AnySource | undefined => (typeof source === 'string' ? sourceCalled(context.sources, source) : source)

/**
 * The source a widget reads, for whoever asks: with what their access narrows it by, the context to read it with
 * (the server's access where the widget asks for that) and whether the list behind it is theirs to open.
 */
const from = async (asked: Context, pick: Pick & Elevated, kind: 'figure' | 'list' | 'chart') => {
  if (!asked.as.user) throw new Unavailable('Nobody is signed in')
  const source = named(asked, pick.source)
  if (!source) throw new Misconfigured([noSource(String(pick.source), asked.sources)])
  // rows would lead to records nobody could open
  const elevated = !!pick.overrideAccess && kind !== 'list'
  const narrowed = await accessTo(asked.req, source, { access: pick.access, overrideAccess: elevated })
  if (!narrowed) throw new Unavailable('Not for whoever is asking')
  return {
    source, narrowed,
    context: elevated ? { ...asked, as: { ...asked.as, overrideAccess: true } } : asked,
    linked: !elevated || await readable(asked.req, source),
  }
}

/** The date a widget goes by: the one it picked, as long as it reads like a field, or the source's own. */
const dateOf = (source: AnySource, pick: Pick): string => (typeof pick.date === 'string' && /^[\w.]+$/.test(pick.date) ? pick.date : source.date ?? 'createdAt')

/** Said before anything is read: what a widget picks that its source or its collection does not have. */
const sound = (context: Context, source: AnySource, pick: FigurePick & ListPick & ChartPick, kind: 'figure' | 'list' | 'chart') => {
  const fields = context.payload.collections[source.slug as CollectionSlug]?.config.flattenedFields ?? []
  const scopes: Problem[] = Object.entries(pick.scope ?? {})
    .filter(([name, id]) => id !== undefined && id !== null && !source.scopes?.[name])
    // better nothing than everybody's figures on the page of one project
    .map(([name]) => ({ text: '{source} cannot be narrowed to a "{name}"', vars: { source: source.slug, name } }))
  const problems = [
    ...nameProblems(source, pick, kind), ...scopes,
    ...whereProblems(source.slug, fields, pick.where),
    ...(kind === 'list' ? [] : measureProblems(source, fields, pick.measure)),
    ...(kind === 'figure' ? figureProblems(pick as FigurePick) : []),
    ...dateProblems(source.slug, fields, typeof pick.date === 'string' ? pick.date : undefined),
  ]
  if (problems.length) throw new Misconfigured(problems)
}

const fieldsOf = (context: Context, source: AnySource) => context.payload.collections[source.slug as CollectionSlug]?.config.flattenedFields ?? []

/**
 * The measure a widget picks: one the source declares, or one said in place, which is of a measure that adds a
 * number up, worked out another way, or of a number field of the collection.
 */
const measureOf = (context: Context, source: AnySource, picked: Measured | undefined): Measure | undefined => {
  if (typeof picked !== 'object' || !picked) return source.measures[picked ?? 'count']
  const found = calcOf(picked)
  if (!found) return undefined
  const [how, name] = found
  const called = (label: Label) => (how === 'sum' ? label : context.t(CALLED[how], { what: context.t(label).toLowerCase() }))
  const base = source.measures[name] as Measure | undefined
  if (base?.amount) return reckoned(called(base.label), { ...base.amount, how, format: picked.format ?? base.amount.format }, { filter: base.filter })
  const field = fieldsOf(context, source).find(candidate => candidate.name === name)
  if (field?.type !== 'number') return undefined
  const hint = (field.custom?.widgets || {}) as { format?: Format; currency?: string }
  return reckoned(called(labelled(field.label, name)), amountOf(name, picked.format ?? hint.format ?? 'number', how, picked.currency ?? hint.currency))
}

/**
 * The records a widget is about: its filter, its period and where it stands. `fixed` is a filter the measure or list
 * insists on, `left` what the access of whoever asks leaves of them.
 */
const chosen = (context: Context, source: AnySource, pick: Pick, fixed?: string, left: Where[] = []) => {
  const name = fixed ?? pick.filter
  const filter = name ? source.filters[name] : undefined
  if (name && !filter) throw new Misconfigured([{ text: '{source} has no filter called "{name}"', vars: { source: source.slug, name } }])
  const fields = fieldsOf(context, source)
  // as Payload takes them, in the shape the list behind the widget can show; a moment it names, "today", is the instant that is now
  const plain = (where: Where) => selected(atMoments(context, where, path => isDate(fields, path)))
  const narrowed = (typeof filter?.where === 'function' ? filter.where(context) : filter?.where) ?? []
  // not by its class: the sources come out of the Payload config, which may be loaded apart from the page that reads them
  let selection = Array.isArray(narrowed) ? new Selection([narrowed as Where[]])
    : Array.isArray((narrowed as Selection).alternatives) ? new Selection((narrowed as Selection).alternatives) : plain(narrowed as Where)
  // what the widget itself is narrowed by
  if (pick.where) selection = selection.within(plain(pick.where))
  for (const where of left) selection = selection.within(selected(where))

  for (const [kind, id] of Object.entries(pick.scope ?? {})) {
    if (id === undefined || id === null) continue
    const scope = source.scopes?.[kind]
    if (scope) selection = selection.and(scope(id))
  }

  const { start, end } = span(context, pick)
  const date = dateOf(source, pick)
  if (start) selection = selection.and({ [date]: { greater_than_equal: context.instant(start) } })
  // the last day counts whole
  if (end) selection = selection.and({ [date]: { less_than: context.instant(after(end, 1)) } })
  return { selection, filter }
}

/** What to call it where nobody gave it a name: the source, and what of it. */
export const titleOf = (context: Context, pick: FigurePick & ListPick & ChartPick, kind: 'figure' | 'list' | 'chart') => {
  const source = named(context, pick.source)
  if (!source) return context.t('Widget')
  const part = kind === 'list' ? source.lists?.[pick.list ?? ''] : measureOf(context, source, pick.measure)
  const filter = source.filters[part?.filter ?? pick.filter ?? '']
  const what = part && !('counts' in part && part.counts) ? context.t(part.label) : ''
  const split = kind === 'chart' && pick.by && pick.by !== 'time' ? (source.groups as Record<string, Label> | undefined)?.[pick.by] : undefined
  return [
    context.t(nameOf(context.payload, source)), filter ? context.t(filter.label).toLowerCase() : '', what.toLowerCase(),
    split ? context.t('by {what}', { what: context.t(split).toLowerCase() }) : '',
  ].filter(Boolean).join(' · ')
}

/** The period before one: as long, and ending where it starts; a month or a year to date is set against the same days of the one before. */
const before = (context: Context, pick: Pick): { from: string; to: string } | undefined => {
  const { start, end } = span(context, pick)
  if (!start) return undefined
  const last = end ?? context.today
  const back = pick.period === 'month' ? 1 : pick.period === 'year' || pick.period === 'last12' ? 12 : 0
  if (back) return { from: months(start, -back), to: months(last, -back) }
  const days = Math.round((Date.parse(last) - Date.parse(start)) / 86400000) + 1
  return { from: after(start, -days), to: after(start, -1) }
}

/** By how much one number is more or less than another, as a share of it: "+12%". Nothing where there was nothing. */
const changed = (context: Context, now: number, then: number) => {
  if (!then) return now ? '' : '0%'
  const share = Math.round(((now - then) / Math.abs(then)) * 100)
  return `${share > 0 ? '+' : share < 0 ? '−' : ''}${context.number(Math.abs(share))}%`
}

export const readFigure = async (asked: Context, pick: FigurePick): Promise<Reading & More & { tone: Tone }> => {
  const { source, narrowed, context, linked } = await from(asked, pick, 'figure')
  sound(context, source, pick, 'figure')
  const measure = measureOf(context, source, pick.measure)
  if (!measure) throw new Misconfigured([{ text: '{source} has no measure called "{name}"', vars: { source: source.slug, name: String(pick.measure ?? 'count') } }])
  const { selection, filter } = chosen(context, source, pick, measure.filter, narrowed)

  const reading = await measure.read(context, selection, source)
  // a plain count says what its filter finds worth saying
  const remark = measure.counts && filter?.remark ? await filter.remark(context, Number(reading.value), selection, source) : {}
  const plain: Reading & { tone: Tone } = { tone: 'calm', href: context.list(source.slug, selection.filter), ...reading, ...remark }
  // the list behind it is the collection's own: not for whoever only this figure is for
  if (!linked) delete plain.href
  const goal = Number(pick.goal) > 0 ? Number(pick.goal) : undefined
  const drawn = pick.as === 'sparkline'
  if (!pick.compare && !goal && !drawn && !pick.note) return plain

  const now = reading.amount
  if ((pick.compare || goal) && now === undefined) {
    throw new Misconfigured([{ text: '"{name}" of {source} gives no number to compare or to set against a goal', vars: { source: source.slug, name: String(pick.measure ?? 'count') } }])
  }
  // written as the measure writes its own
  const format = measure.amount?.format ?? 'number'
  const written = (value: number) => shown(context, format, new Map([[format === 'money' ? context.currency.toUpperCase() : '', value]]))
  const more: More = {}
  const vars: Record<string, string> = { value: plain.value, note: plain.note ?? '' }
  const usual: string[] = []

  const earlier = pick.compare ? before(context, pick) : undefined
  if (earlier && now !== undefined) {
    const then = await measure.read(context, chosen(context, source, { ...pick, period: 'custom', ...earlier }, measure.filter, narrowed).selection, source)
    const amount = then.amount ?? 0
    more.previous = { value: then.value, amount }
    more.trend = now > amount ? 'up' : now < amount ? 'down' : 'flat'
    vars.previous = then.value
    vars.change = changed(context, now, amount)
    usual.push(vars.change ? context.t('{change} on the period before', vars) : context.t('Nothing in the period before'))
  }
  if (goal && now !== undefined) {
    more.goal = { value: written(goal), amount: goal, share: Math.max(0, now / goal) }
    vars.goal = more.goal.value
    vars.percent = `${context.number(Math.round((now / goal) * 100))}%`
    vars.left = written(Math.max(0, goal - now))
    usual.push(context.t('{percent} of {goal}', vars))
  }
  if (drawn) more.series = (await readChart(asked, { ...pick, by: 'time' })).bars

  const note = pick.note ? context.t(pick.note, vars) : usual.length ? usual.join(' · ') : plain.note
  return { ...plain, ...more, ...(note ? { note } : {}) }
}

export const readList = async (asked: Context, pick: ListPick): Promise<ListReading & { href: string }> => {
  const { source, narrowed, context } = await from(asked, pick, 'list')
  sound(context, source, pick, 'list')
  const list = source.lists?.[pick.list ?? Object.keys(source.lists ?? {})[0]]
  if (!list) throw new Misconfigured([{ text: '{source} has no list to show', vars: { source: source.slug } }])
  const { selection } = chosen(context, source, pick, list.filter, narrowed)
  const limit = Math.max(1, Math.min(20, Number(pick.limit) || 6))
  return { href: context.list(source.slug, selection.filter), ...await list.read(context, selection, source, limit) }
}

const text = (label: unknown, context: Context) =>
  typeof label === 'string' ? context.t(label) : label && typeof label === 'object' ? context.t(label as Record<string, string>) : ''

/** What the values of a field are called: the labels of a select's options, the titles of what a relationship points at. */
const called = async (context: Context, source: AnySource, field: string, keys: string[]) => {
  const names = new Map<string, string>()
  const config = context.payload.collections[source.slug as CollectionSlug].config.flattenedFields.find((candidate: FlattenedField) => candidate.name === field)
  if (config?.type === 'select' || config?.type === 'radio') {
    for (const option of config.options) {
      if (typeof option === 'string') names.set(option, context.t(option))
      else names.set(option.value, text(option.label, context) || option.value)
    }
  }
  if (config?.type === 'checkbox') {
    names.set('true', context.t('Yes'))
    names.set('false', context.t('No'))
  }
  if ((config?.type === 'relationship' || config?.type === 'upload') && typeof config.relationTo === 'string' && keys.length) {
    const related = config.relationTo as CollectionSlug
    const title = context.payload.collections[related].config.admin.useAsTitle ?? 'id'
    // read as the person looking: what they may not open stays a number
    const found = await context.payload.find({
      ...context.as, collection: related, pagination: false, limit: keys.length,
      where: { id: { in: keys } }, select: { [title]: true } as never,
    }).catch(() => ({ docs: [] }))
    for (const doc of found.docs as unknown as Record<string, unknown>[]) names.set(String(doc.id), String(doc[title] ?? doc.id))
  }
  return names
}

const MOST = 8

export const readChart = async (asked: Context, pick: ChartPick): Promise<ChartReading> => {
  const { source, narrowed, context, linked } = await from(asked, pick, 'chart')
  sound(context, source, pick, 'chart')
  const measure = measureOf(context, source, pick.measure)
  const amount = measure?.amount as Amount<Record<string, unknown>> | undefined
  if (!measure || !amount) throw new Misconfigured([{ text: '{source} has no measure called "{name}" that can be drawn', vars: { source: source.slug, name: String(pick.measure ?? 'count') } }])

  const by = pick.by && pick.by !== 'time' ? pick.by : null
  const date = dateOf(source, pick)
  // over time there has to be an end to it: a year back where nothing else is said
  let timed: Pick = pick
  if (!by) {
    const { start, end } = span(context, pick)
    const last = end ?? context.today
    // what is still to come is drawn half a year ahead
    if (pick.period === 'upcoming') timed = { ...pick, period: 'custom', from: context.today, to: after(context.today, 180) }
    else if (!start) timed = { ...pick, period: 'custom', from: `${after(`${last.slice(0, 7)}-01`, -340).slice(0, 7)}-01`, to: end ?? undefined }
  }
  const { selection } = chosen(context, source, timed, measure.filter, narrowed)

  const docs = await fetched<Record<string, unknown>>(context, source, selection, [...new Set([...amount.select, by ?? date])])
  // money is drawn in one currency; what is in another is said, not added
  const main = context.currency.toUpperCase()
  const kept = amount.format === 'money' ? docs.filter(doc => currencyOf(context, amount, doc) === main) : docs
  const left = docs.length - kept.length
  const show = (value: number) => shown(context, amount.format, new Map([[amount.format === 'money' ? main : '', value]]))
  const whole = show([...added(context, kept, amount).values()].reduce((sum, value) => sum + value, 0))
  const note = [
    whole, left ? context.t('{count} in another currency left out', { count: left }) : '',
    // more than can be read at once: said, so the chart is not taken for all of them
    docs.length >= MANY ? context.t('Only the first {count} are counted', { count: context.number(MANY) }) : '',
  ].filter(Boolean).join(' · ')
  const href = linked ? context.list(source.slug, selection.filter) : undefined
  const empty = context.t('Nothing to show yet')

  if (!by) {
    const { start: first, end } = span(context, timed)
    const start = first as string
    const last = end && end < context.today ? end : end ?? context.today
    // by day up to two months, by month beyond
    const daily = (new Date(last).getTime() - new Date(start).getTime()) / 86400000 <= 62
    const buckets = new Map<string, number[]>()
    // every month or day in the period has its bar, also the empty ones
    for (let at = new Date(`${daily ? start : `${start.slice(0, 7)}-01`}T00:00:00Z`); at.toISOString().slice(0, 10) <= last;) {
      buckets.set(at.toISOString().slice(0, daily ? 10 : 7), [])
      if (daily) at.setUTCDate(at.getUTCDate() + 1)
      else at.setUTCMonth(at.getUTCMonth() + 1)
    }
    for (const doc of kept) {
      const value = doc[date]
      if (typeof value !== 'string') continue
      const key = context.date(value).slice(0, daily ? 10 : 7)
      buckets.get(key)?.push(amount.of(doc))
    }
    return {
      note, href, empty,
      bars: kept.length ? [...buckets].map(([key, values]) => {
        const value = combined(amount.how, values)
        return { label: daily ? context.day(key) : context.month(key), amount: value, shown: value ? show(value) : '' }
      }) : [],
    }
  }

  const each = new Map<string, number[]>()
  for (const doc of kept) {
    const value = doc[by]
    const keys = (Array.isArray(value) ? value : [value]).filter(key => key !== null && key !== undefined && key !== '')
    for (const key of keys.length ? keys : ['']) {
      const id = typeof key === 'object' ? String((key as { id: unknown }).id) : String(key)
      each.set(id, [...(each.get(id) ?? []), amount.of(doc)])
    }
  }
  const sorted = [...each].map(([key, values]) => [key, combined(amount.how, values)] as const).sort((a, b) => b[1] - a[1])
  const names = await called(context, source, by, sorted.slice(0, MOST).map(([key]) => key).filter(Boolean))
  // what is left over is made one the same way: the average of the rest, not the sum of their averages
  const rest = combined(amount.how, sorted.slice(MOST).flatMap(([key]) => each.get(key) ?? []))
  return {
    note, href, empty,
    bars: [
      ...sorted.slice(0, MOST).map(([key, value]) => ({
        label: key ? names.get(key) ?? `#${key}` : context.t('None'),
        amount: value,
        shown: show(value),
        ...(linked ? { href: context.list(source.slug, (key ? selection.and({ [by]: { equals: key } }) : selection.and({ [by]: { exists: false } })).filter) } : {}),
      })),
      ...(rest ? [{ label: context.t('Other'), amount: rest, shown: show(rest) }] : []),
    ],
  }
}
