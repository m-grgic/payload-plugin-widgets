import React from 'react'
import type { CollectionSlug, PayloadRequest, WidgetServerProps } from 'payload'
import { RenderServerComponent } from '@payloadcms/ui/elements/RenderServerComponent'
import { contextFor } from '../context'
import { inWords, Misconfigured, problemsOf, timedOut, viewProblems, type Problem } from '../check'
import { found as located } from '../formula'
import { readChart, readFigure, readList, titleOf, type ChartPick, type FigurePick, type ListPick } from '../read'
import type { ReadChartOptions, ReadFigureOptions, ReadListOptions, Slugged } from '../data'
import { mayUse, settingsOf, sourceCalled } from '../options'
import { labelled, nameOf, VIEWS, type AnySource, type Context, type Kind, type Label, type More, type Source } from '../types'
import { ChartTile, ListTile, Notice, Tile, type ChartContent, type ListContent, type Slots, type TileContent } from './Tiles'

// The three kinds, for any page: `req` says who is looking, the rest what to show.
//
//   <Chart req={req} source={time} measure="worked" by="user" scope={{ project: id }} />
//
// Each takes a link of the project's own for its head (`action`) and anything at all to draw under it (`after`).
//
// Given a source, what is picked from it is checked against what it declares; the widgets somebody set up themselves
// give its name instead, and what they kept. On the page of one project or one client they are given a scope, and
// show only what belongs there. Every number is read with the signed-in user's own access, so a widget somebody may
// not see says so instead of showing figures; `access` says who else it is not for, and a figure or a chart given
// `overrideAccess` is read with the server's, as the local API has it.

export * from './Tiles'
export { contextFor }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

type Shown = Slots & {
  req: PayloadRequest
  /** What it is called, in English or by language (`{ en: 'Sales', hr: 'Prodaja' }`), said in the request's; named after what it shows where it is left out. */
  label?: Label
  /** What its tile is found by in a stylesheet, as `data-widget`. */
  name?: string
  /** How it is drawn: one of the plugin's own ways for its kind (see `VIEWS`), or one it was given under `views`. */
  as?: string
  /** Leaves no trace where it cannot be shown or has nothing to show: for a page it is one part of many on. */
  quiet?: boolean
  /**
   * Set up by whoever looks at it, in the drawer of the dashboard: what is wrong with it is said to them in the names
   * the admin shows them. Any other widget says only that it could not be read, in production; the log says why. That a
   * read took too long is said to anybody.
   */
  owned?: boolean
}

/** Where a problem is said in what was set up, the names it is said with: a collection and its fields as the admin calls them. */
const FIELD_NAMED = new Set<Problem['code']>(['not-a-date', 'not-a-number', 'date-in-rows', 'no-comparable-figure'])
const inLabels = (context: Context, problem: Problem): Problem => {
  const { payload, t } = context
  const source = typeof problem.vars.source === 'string' ? sourceCalled(context.sources, problem.vars.source) : undefined
  const fields = source ? payload.collections[source.slug as CollectionSlug]?.config.flattenedFields : undefined
  const fieldLabel = (path: unknown) => {
    const field = typeof path === 'string' && fields ? located(fields, path)?.field : undefined
    const label = (field as { label?: unknown } | undefined)?.label
    return typeof label === 'string' || (label && typeof label === 'object') ? t(label as Label) : undefined
  }
  // the parts of a source a name was meant to be one of, by what is wrong
  const parts = (source && ({
    'no-filter': source.filters, 'no-measure': source.measures, 'no-drawable-measure': source.measures, 'no-list': source.lists,
  } as Record<string, Record<string, { label: Label }> | undefined>)[problem.code]) || undefined
  const partLabel = (name: string | undefined) => {
    if (!name) return undefined
    if (problem.code === 'no-source') return context.sources[name] ? t(nameOf(payload, context.sources[name])) : undefined
    if (problem.code === 'no-field') return fieldLabel(name)
    if (problem.code === 'no-group') return (source?.groups as Record<string, Label> | undefined)?.[name] ? t((source?.groups as Record<string, Label>)[name]) : undefined
    return parts?.[name] ? t(parts[name].label) : undefined
  }
  const vars = { ...problem.vars }
  if (source) vars.source = t(nameOf(payload, source))
  else if (typeof vars.source === 'string' && payload.collections[vars.source as CollectionSlug]) vars.source = t(labelled(payload.collections[vars.source as CollectionSlug].config.labels?.plural, vars.source))
  if (vars.field !== undefined) vars.field = fieldLabel(vars.field) ?? vars.field
  if (FIELD_NAMED.has(problem.code)) vars.name = fieldLabel(vars.name) ?? vars.name
  const hint = partLabel(problem.hint) ?? problem.hint
  return { ...problem, vars, ...(hint ? { hint } : {}) }
}

/**
 * Why something could not be shown. What is refused says only that, to anybody. What went wrong is said to whoever
 * set the widget up in the drawer, in the admin's names, and while developing; in production every other widget
 * says only that it could not be read, and the log says why, once for every time it is drawn. A read that took too
 * long gives nothing away: that is said to anybody, anywhere, and was logged as a warning where it gave up.
 */
const reason = (context: Context, label: string, error: unknown, owned: boolean | undefined): { note: string; kind: 'error' | 'denied' } => {
  const { t, payload } = context
  if (error instanceof Error && error.name === 'Unavailable') return { note: t('Not available to this account'), kind: 'denied' }
  if (timedOut(error)) return { note: (problemsOf(error) ?? []).map(problem => inWords(problem, t)).join(' '), kind: 'error' }
  const { status, message } = error as { status?: number; message?: string }
  if (status === 401 || status === 403) return { note: t('Not available to this account'), kind: 'denied' }
  const problems = problemsOf(error)
  const developing = process.env.NODE_ENV !== 'production'
  payload.logger.error({ err: error, msg: `widgets: "${label}" could not be read${problems ? `: ${problems.map(problem => inWords(problem)).join(' ')}` : ''}` })
  if (!owned && !developing) return { note: t('This widget could not be read'), kind: 'error' }
  // what is set up wrong, said as it is so that it can be put right; a query Payload cannot run says which part of it
  if (problems) return { note: problems.map(problem => inWords(owned ? inLabels(context, problem) : problem, t)).join(' '), kind: 'error' }
  if (status === 400 && message) return { note: message, kind: 'error' }
  // anything else is for the log, and for whoever is developing
  return { note: `${t('This could not be read')}${developing && message ? `: ${message}` : ''}`, kind: 'error' }
}

/** Something that could not be shown says why in a tile of its own, or leaves no trace where it is `quiet`, and nothing else breaks. */
const guarded = async (context: Context, label: string, { quiet, name, owned }: Pick<Shown, 'quiet' | 'name' | 'owned'>, render: () => Promise<React.ReactNode>) => {
  try {
    return await render()
  } catch (error) {
    // on a page it is one part of many: whoever it is not for does not miss it
    if (quiet) return null
    return <Notice label={label} name={name} {...reason(context, label, error, owned)} />
  }
}

/**
 * What a way of the project's own to draw a widget is handed: what the tile would be made of, and the name it was
 * asked for by. `req` is there for a server component only: a client component is handed the rest, which is plain data.
 */
type Viewed = Slots & { req: PayloadRequest; view: string }
export type FigureViewProps = TileContent & More & Viewed
export type ListViewProps = ListContent & Viewed & { api: string; words: { add: string; failed: string; submit: string; added: string } }
export type ChartViewProps = ChartContent & Viewed

/** Drawn by a component of the project's own where it asks for one: found in the import map by its path. Nothing for the plugin's own ways. */
const own = (req: PayloadRequest, kind: Kind, as: string | undefined, props: object) => {
  if (!as || as in VIEWS[kind]) return undefined
  const { views } = settingsOf(req.payload)
  const problems = viewProblems(kind, as, views)
  if (problems.length) throw new Misconfigured(problems)
  // what it shows is plain data, so the component may as well be one for the browser: only a server component is handed who asks
  return RenderServerComponent({ Component: views[as].Component, importMap: req.payload.importMap, clientProps: { ...props, view: as }, serverProps: { req } })
}

/** What a tile's tone is said as to whoever does not see its colour. */
const toned = ({ t }: Context) => ({ warn: t('Needs attention'), bad: t('Urgent') })

/** The link a project adds is written in English like the rest. */
const said = ({ t }: Context, action: Slots['action']) => (action ? { ...action, label: t(action.label) } : undefined)

/**
 * Keeps a widget of the project's own (see `widget` in ../options) to whoever its `access` says it is for: anybody
 * else is told so in its place.
 *
 *   export const Shortcuts = gated(async ({ req }) => <NoteTile … />)
 */
export const gated = (Component: (props: WidgetServerProps) => Promise<React.ReactNode> | React.ReactNode) =>
  async function Gated(props: WidgetServerProps) {
    const { req, widgetSlug } = props
    if (!req.user) return null
    const settings = settingsOf(req.payload)
    const widget = settings.widgets.find(candidate => candidate.slug === widgetSlug)
    if (widget && !await mayUse(settings, req, widget)) {
      const { t } = settings.words(req)
      return <Notice label={t(widget.label)} name={widget.slug} note={t('Not available to this account')} kind="denied" />
    }
    return Component(props)
  }

/**
 * The props of a figure: `measure` one of the source's measures, or one said in place (`{ avg: 'total' }`); `compare`
 * to read the period before as well; `goal` what it is set against; `note` what the line under it says in place of
 * the usual (`'{left} to go'`, see `FigurePick`); `data` the settings a measure reads from `context.data`.
 */
export type FigureProps<S extends CollectionSlug = Loose, F extends string = string, M extends string = string, K extends string = string> = Shown & ReadFigureOptions<S, F, M, K>

/** Of a declared source, or of one by its name: by a collection's slug, what is picked is checked against its fields. */
export const Figure: {
  <S extends CollectionSlug, F extends string, M extends string, K extends string>(props: FigureProps<S, F, M, K> & { source: Source<S, F, M, Loose, Loose, K> }): Promise<React.ReactNode>
  <const N extends string>(props: FigureProps<Slugged<N>> & { source: N }): Promise<React.ReactNode>
} = async ({ req, label, quiet, name: called, owned, as, data, action, after, ...picked }: FigureProps & { source: AnySource | string }) => {
  if (!req.user) return null
  const pick = { ...picked, as } as FigurePick
  const context = contextFor(req, data)
  const name = label ? context.t(label) : titleOf(context, pick, 'figure')
  return guarded(context, name, { quiet, name: called, owned }, async () => {
    const tile = { ...await readFigure(context, pick), label: name, name: called, action: said(context, action), after }
    return own(req, 'figure', as, tile) ?? <Tile {...tile} as={as as keyof typeof VIEWS.figure | undefined} words={toned(context)} />
  })
}

/** The props of a list: `list` one of the source's lists, the first where it is left out; `limit` how many rows. */
export type RecordsProps<S extends CollectionSlug = Loose, F extends string = string, L extends string = string, K extends string = string> = Shown & ReadListOptions<S, F, L, K>

export const Records: {
  <S extends CollectionSlug, F extends string, L extends string, K extends string>(props: RecordsProps<S, F, L, K> & { source: Source<S, F, Loose, L, Loose, K> }): Promise<React.ReactNode>
  <const N extends string>(props: RecordsProps<Slugged<N>> & { source: N }): Promise<React.ReactNode>
} = async ({ req, label, quiet, name: called, owned, as, action, after, ...picked }: RecordsProps & { source: AnySource | string }) => {
  if (!req.user) return null
  const pick = picked as ListPick
  const context = contextFor(req)
  const name = label ? context.t(label) : titleOf(context, pick, 'list')
  const words = { add: context.t('+ New'), failed: context.t('That could not be added.'), submit: context.t('Add'), added: context.t('Added') }
  return guarded(context, name, { quiet, name: called, owned }, async () => {
    const tile = { ...await readList(context, pick), label: name, name: called, api: req.payload.config.routes.api, words, action: said(context, action), after }
    return own(req, 'list', as, tile) ?? <ListTile {...tile} words={{ ...words, ...toned(context) }} />
  })
}

/** The props of a chart: `measure` one or several, `by` a group or `'time'`, `series` another group to tell every bar apart by. */
export type ChartProps<S extends CollectionSlug = Loose, F extends string = string, M extends string = string, G extends string = string, K extends string = string> = Shown & ReadChartOptions<S, F, M, G, K>

export const Chart: {
  <S extends CollectionSlug, F extends string, M extends string, G extends string, K extends string>(props: ChartProps<S, F, M, G, K> & { source: Source<S, F, M, Loose, G, K> }): Promise<React.ReactNode>
  <const N extends string>(props: ChartProps<Slugged<N>> & { source: N }): Promise<React.ReactNode>
} = async ({ req, label, quiet, name: called, owned, as, action, after, ...picked }: ChartProps & { source: AnySource | string }) => {
  if (!req.user) return null
  const pick = picked as ChartPick
  const context = contextFor(req)
  const name = label ? context.t(label) : titleOf(context, pick, 'chart')
  return guarded(context, name, { quiet, name: called, owned }, async () => {
    const chart = await readChart(context, pick)
    // on a page, a chart of nothing only takes up room
    if (quiet && ![chart.bars, ...(chart.series ?? []).map(one => one.bars)].some(bars => bars.some(bar => bar.amount))) return null
    const tile = { ...chart, label: name, name: called, action: said(context, action), after }
    return own(req, 'chart', as, tile) ?? <ChartTile {...tile} as={as as keyof typeof VIEWS.chart | undefined} words={{ apart: context.t('Each series is drawn to its own scale') }} />
  })
}
