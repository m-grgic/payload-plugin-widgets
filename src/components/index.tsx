import React from 'react'
import type { CollectionSlug, PayloadRequest, WidgetServerProps } from 'payload'
import { RenderServerComponent } from '@payloadcms/ui/elements/RenderServerComponent'
import { contextFor } from '../context'
import { inWords, Misconfigured, problemsOf, viewProblems } from '../check'
import { readChart, readFigure, readList, titleOf, type ChartPick, type FigurePick, type ListPick } from '../read'
import type { Narrowed } from '../data'
import { mayUse, settingsOf } from '../options'
import { VIEWS, type Context, type Kind, type More, type Numbers, type Reckoned, type Source } from '../types'
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
// not see says so instead of showing figures.

export * from './Tiles'
export { contextFor }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

type Shown = Slots & {
  req: PayloadRequest
  /** What it is called; named after what it shows where it is left out. */
  label?: string
  /** What its tile is found by in a stylesheet, as `data-widget`. */
  name?: string
  /** How it is drawn: one of the plugin's own ways for its kind (see `VIEWS`), or one it was given under `views`. */
  as?: string
  /** Leaves no trace where it cannot be shown or has nothing to show: for a page it is one part of many on. */
  quiet?: boolean
}


/** Why something could not be shown: what is set up wrong is said as it is, so it can be put right; what is refused is not. */
const reason = ({ t, payload }: Context, label: string, error: unknown) => {
  const problems = problemsOf(error)
  if (problems) return problems.map(problem => inWords(problem, t)).join(' ')
  if (error instanceof Error && error.name === 'Unavailable') return t('Not part of your role')
  const { status, message } = error as { status?: number; message?: string }
  if (status === 401 || status === 403) return t('Not available to this account')
  payload.logger.error({ err: error, msg: `widgets: "${label}" could not be read` })
  // a query Payload cannot run says which part of it; anything else is for the log, and for whoever is developing
  return status === 400 && message ? message : `${t('This could not be read')}${process.env.NODE_ENV !== 'production' && message ? `: ${message}` : ''}`
}

/** Something that could not be shown says why in a tile of its own, or leaves no trace where it is `quiet`, and nothing else breaks. */
const guarded = async (context: Context, label: string, quiet: boolean | undefined, name: string | undefined, render: () => Promise<React.ReactNode>) => {
  try {
    return await render()
  } catch (error) {
    // on a page it is one part of many: whoever it is not for does not miss it
    if (quiet) return null
    return <Notice label={label} name={name} note={reason(context, label, error)} />
  }
}

/** What a way of the project's own to draw a widget is handed: what the tile would be made of, who asks, and the name it was asked for by. */
type Viewed = Slots & { req: PayloadRequest; view: string }
export type FigureViewProps = TileContent & More & Viewed
export type ListViewProps = ListContent & Viewed & { api: string; words: { add: string; failed: string } }
export type ChartViewProps = ChartContent & Viewed

/** Drawn by a component of the project's own where it asks for one: found in the import map by its path. Nothing for the plugin's own ways. */
const own = (req: PayloadRequest, kind: Kind, as: string | undefined, props: object) => {
  if (!as || as in VIEWS[kind]) return undefined
  const { views } = settingsOf(req.payload)
  const problems = viewProblems(kind, as, views)
  if (problems.length) throw new Misconfigured(problems)
  return RenderServerComponent({ Component: views[as].Component, importMap: req.payload.importMap, serverProps: { ...props, req, view: as } })
}

/** The link a project adds is written in English like the rest. */
const said = ({ t }: Context, action: Slots['action']) => (action ? { ...action, label: t(action.label) } : undefined)

/**
 * Keeps a widget of the project's own (see `widget` in ../options) to the roles it was given: whoever it is not
 * for is told so in its place.
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
      return <Notice label={t(widget.label)} name={widget.slug} note={t('Not part of your role')} />
    }
    return Component(props)
  }

export const Figure = async <S extends CollectionSlug, F extends string, M extends string, K extends string>(
  { req, label, quiet, name: called, as, data, action, after, ...picked }: Shown & Narrowed<F, K, S> & {
    source: Source<S, F, M, Loose, Loose, K> | string
    /** One of the source's measures, or one said in place: `{ avg: 'total' }`. */
    measure?: NoInfer<M> | Reckoned<NoInfer<M> | Numbers<S>>
    /** Also read for the period before, to say how much more or less it is. */
    compare?: 'previous'
    /** What it is set against. */
    goal?: number
    /** What the line under it says, in place of the usual: `'{left} to go'` (see `FigurePick`). */
    note?: string
    /** The settings a measure reads from `context.data`. */
    data?: Record<string, unknown>
  },
) => {
  if (!req.user) return null
  const pick = { ...picked, as } as FigurePick
  const context = contextFor(req, data)
  const name = label ? context.t(label) : titleOf(context, pick, 'figure')
  return guarded(context, name, quiet, called, async () => {
    const tile = { ...await readFigure(context, pick), label: name, name: called, action: said(context, action), after }
    return own(req, 'figure', as, tile) ?? <Tile {...tile} as={as as keyof typeof VIEWS.figure | undefined} />
  })
}

export const Records = async <S extends CollectionSlug, F extends string, L extends string, K extends string>(
  { req, label, quiet, name: called, as, action, after, ...picked }: Shown & Narrowed<F, K, S> & { source: Source<S, F, Loose, L, Loose, K> | string; list?: NoInfer<L>; limit?: number },
) => {
  if (!req.user) return null
  const pick = picked as ListPick
  const context = contextFor(req)
  const name = label ? context.t(label) : titleOf(context, pick, 'list')
  const words = { add: context.t('+ New'), failed: context.t('That could not be added.') }
  return guarded(context, name, quiet, called, async () => {
    const tile = { ...await readList(context, pick), label: name, name: called, api: req.payload.config.routes.api, words, action: said(context, action), after }
    return own(req, 'list', as, tile) ?? <ListTile {...tile} />
  })
}

export const Chart = async <S extends CollectionSlug, F extends string, M extends string, G extends string, K extends string>(
  { req, label, quiet, name: called, as, action, after, ...picked }: Shown & Narrowed<F, K, S> & { source: Source<S, F, M, Loose, G, K> | string; measure?: NoInfer<M> | Reckoned<NoInfer<M> | Numbers<S>>; by?: NoInfer<G> | 'time' },
) => {
  if (!req.user) return null
  const pick = picked as ChartPick
  const context = contextFor(req)
  const name = label ? context.t(label) : titleOf(context, pick, 'chart')
  return guarded(context, name, quiet, called, async () => {
    const chart = await readChart(context, pick)
    // on a page, a chart of nothing only takes up room
    if (quiet && !chart.bars.some(bar => bar.amount)) return null
    const tile = { ...chart, label: name, name: called, action: said(context, action), after }
    return own(req, 'chart', as, tile) ?? <ChartTile {...tile} as={as as keyof typeof VIEWS.chart | undefined} />
  })
}
