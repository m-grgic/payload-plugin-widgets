import type { Access, CollectionSlug, PayloadRequest } from 'payload'
import { contextFor } from './context'
import { readChart as chartOf, readFigure as figureOf, readList as listOf, type ChartPick, type FigurePick, type ListPick } from './read'
import type { Doc, Fields, Narrowing, Numbers, Paths, Period, Reckoned, Source } from './types'

// What a widget would show, without the widget: for a page, a component or an endpoint that draws it its own way.
//
//   const { value, note, href } = await readFigure(req, invoices, { filter: 'unpaid', measure: 'total' })
//
// What is picked is checked against what the source declares. Everything is read with the access of whoever makes
// the request, in their language; where the source is not for them, or nobody is signed in, `Unavailable` is thrown.
// A figure and a chart take `overrideAccess` as the local API does, and are then read with the server's access.

export { Misconfigured, TimedOut, Unavailable } from './read'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

/**
 * The collection a source given by its name is of: the one of that slug, so that what is picked is checked against
 * its fields. Any other name is of a source declared under it, which the types do not know, and anything goes.
 */
export type Slugged<N extends string> = N extends CollectionSlug ? N : Loose

/** Which of a source's records: common to a figure, a list and a chart. */
export type Narrowed<F extends string, K extends string, S extends CollectionSlug = Loose> = {
  /** One of the source's filters; none is all of its records. */
  filter?: NoInfer<F>
  /** Which of its records, as Payload filters them anywhere, `and` and `or` included. On top of `filter`, where both are given. */
  where?: Narrowing<NoInfer<S>>
  period?: Period
  /** The date the period goes by, by its path as a source's `date` is: the source's own where it is left out. */
  date?: Paths<Doc<NoInfer<S>>, string>
  /** For the period between two dates: the first and the last day, as YYYY-MM-DD. */
  from?: string
  to?: string
  /** Only what belongs to one of something, as the source's `scopes` call it: `{ project: 12 }`. */
  scope?: Partial<Record<NoInfer<K>, number | string>>
  /** Who it is for, on top of who its source is for: asked as Payload asks a collection, a filter leaving only some of the records. */
  access?: Access
}

/** What a figure and a chart take besides: neither gives a record away. */
export type Elevated = {
  /** Read with the server's access in place of the person's own, as the local API has it. Say who it is for with `access`. */
  overrideAccess?: boolean
}

/** A measure picked from a source of `S`: one of its measures by name, or one said in place of the collection's numbers, its fields in a formula. */
type Picked<S extends CollectionSlug, M extends string> = M | Reckoned<M | Numbers<S>, Fields<S>>

/** What `readFigure` and `<Figure>` take besides the request and the source. */
export type ReadFigureOptions<S extends CollectionSlug = Loose, F extends string = string, M extends string = string, K extends string = string> = Narrowed<F, K, S> & Elevated & {
  measure?: Picked<S, NoInfer<M>>
  compare?: 'previous'
  goal?: number
  note?: string
  /** `'sparkline'` to have what it was over time as well, as `series`. */
  as?: string
  /** The settings a measure reads from `context.data`. */
  data?: Record<string, unknown>
}
/** What `readList` and `<Records>` take besides the request and the source. */
export type ReadListOptions<S extends CollectionSlug = Loose, F extends string = string, L extends string = string, K extends string = string> =
  Narrowed<F, K, S> & { list?: NoInfer<L>; limit?: number }
/** What `readChart` and `<Chart>` take besides the request and the source. */
export type ReadChartOptions<S extends CollectionSlug = Loose, F extends string = string, M extends string = string, G extends string = string, K extends string = string> =
  Narrowed<F, K, S> & Elevated & { measure?: Picked<S, NoInfer<M>> | Picked<S, NoInfer<M>>[]; by?: NoInfer<G> | 'time'; series?: NoInfer<G> }

/**
 * One figure: `value` as it is shown, with the line under it, how urgent it is and the list behind it; asked for,
 * also what it was in the period before (`previous`, `trend`), how much of a goal it is (`goal`) and what it was over time (`series`).
 * Of a declared source, or of one by its name: by a collection's slug, what is picked is checked against its fields.
 */
export const readFigure: {
  <S extends CollectionSlug, F extends string, M extends string, K extends string>(req: PayloadRequest, source: Source<S, F, M, Loose, Loose, K>, pick?: ReadFigureOptions<S, F, M, K>): ReturnType<typeof figureOf>
  <const N extends string>(req: PayloadRequest, source: N, pick?: ReadFigureOptions<Slugged<N>>): ReturnType<typeof figureOf>
} = (req: PayloadRequest, source: Loose, pick: Loose = {}) => {
  const { data, ...picked } = pick as ReadFigureOptions
  return figureOf(contextFor(req, data), { source, ...picked } as FigurePick)
}

/** The first few rows of one of a source's lists: the first it declares where none is named. */
export const readList: {
  <S extends CollectionSlug, F extends string, L extends string, K extends string>(req: PayloadRequest, source: Source<S, F, Loose, L, Loose, K>, pick?: ReadListOptions<S, F, L, K>): ReturnType<typeof listOf>
  <const N extends string>(req: PayloadRequest, source: N, pick?: ReadListOptions<Slugged<N>>): ReturnType<typeof listOf>
} = (req: PayloadRequest, source: Loose, pick: Loose = {}) => listOf(contextFor(req), { source, ...pick } as ListPick)

/**
 * A measure as bars: over time, or split by one of the source's groups. Several measures, or a second group as
 * `series`, are read as `series` besides: one for each, with a bar for every one of `bars`.
 */
export const readChart: {
  <S extends CollectionSlug, F extends string, M extends string, G extends string, K extends string>(req: PayloadRequest, source: Source<S, F, M, Loose, G, K>, pick?: ReadChartOptions<S, F, M, G, K>): ReturnType<typeof chartOf>
  <const N extends string>(req: PayloadRequest, source: N, pick?: ReadChartOptions<Slugged<N>>): ReturnType<typeof chartOf>
} = (req: PayloadRequest, source: Loose, pick: Loose = {}) => chartOf(contextFor(req), { source, ...pick } as ChartPick)
