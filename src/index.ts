import type { CollectionConfig, CollectionSlug, Config, Payload, PayloadRequest, Plugin, Where, Widget, WidgetInstance } from 'payload'
import { dateProblems, elevatedProblems, figureProblems, inWords, measureProblems, nameProblems, noSource, seriesProblems, viewProblems, whereProblems, type Problem } from './check'
import { component, said, setUp, sized } from './fields'
import { forgotten } from './tally'
import { KEY, settled, sourceCalled, startsWith, type Options, type Settings } from './options'

// Dashboard widgets that read from the collections. Without anything declared, every collection is a source as its
// fields describe it: how many, a sum for each number, a group for each select and relationship, the latest. Anybody
// can add a figure, a list or a chart of one to their dashboard, filtered as the admin's lists are, and one is put
// there ready-made by the collection's slug:
//
//   plugins: [widgetsPlugin({
//     sources: { media: false },
//     widgets: [
//       figure('open-tasks', 'tasks', { label: 'Open tasks', where: { status: { not_equals: 'done' } } }),
//       figure('longest-task', 'tasks', { label: 'Longest task', measure: { max: 'estimatedTime' } }),
//     ],
//   })]
//
// A filter can name a moment where a date would stand still (`{ dueDate: { less_than: 'today' } }`, see ./when), and
// a collection or a field can say of itself what it is to the widgets, under `custom.widgets` (see ./discover).
// A widget set up with what is not there stops the config from being built, and says what was probably meant.
//
// What cannot be found is declared: a source says what else of a collection is worth looking at; a widget picks
// from it, and the names it picks are checked against what the source declares:
//
//   const invoices = source('invoices', {
//     label: 'Invoices', access: ({ req }) => req.user?.role === 'admin', date: 'issuedAt',
//     filters: { unpaid: { where: { paid: { equals: false } } }, overdue: { where: { dueDate: { less_than: 'today' } } } },
//     measures: { total: { sum: 'total', format: 'money' }, average: { avg: 'total', format: 'money' } },
//     groups: { client: 'Client' },
//   })
//
//   plugins: [widgetsPlugin({
//     sources: { invoices },
//     widgets: [
//       figure('unpaid', invoices, { label: 'Unpaid invoices', filter: 'unpaid', measure: 'total' }),
//       chart('by-client', invoices, { label: 'Invoiced by client', measure: 'total', by: 'client' }),
//     ],
//   })]
//
// Besides the ready-made ones, anybody can add a figure, a list or a chart to their dashboard and set it up in its
// drawer from the same sources. The same three can stand on any other page: see ./components. Where the tiles are
// not what is wanted, `readFigure`, `readList` and `readChart` give what they would show, to draw any other way;
// `widget` puts a component of your own among the ready-made ones. A figure can be set against the period before
// (`compare: 'previous'`) and against a goal (`goal: 5000`), and says of them what its `note` asks. A chart is bars, columns or a line (`as: 'columns'`),
// and any of the three kinds can be drawn by a component of your own, given under `views` and asked for the same way. Everything is read with the access of whoever
// is looking; `access` on a source or a widget says who else it is not for, as Payload asks it of a collection, and a
// figure or a chart that is to say more than its reader may open says so with `overrideAccess`.
// Nothing here may import a component: this is read by the Payload config.
// The tiles bring their own styles and follow the admin's theme; ./widgets.css lists the variables, the classes
// and the attributes a project restyles them by.

export { chart, figure, list, widget } from './options'
export type { Action, Home, Options, Widget as ReadyWidget } from './options'
export type { CollectionHint, FieldHint } from './discover'
export type { Moment } from './when'
export { PLURALS, STRINGS, type Dictionary, type Plurals, type WidgetString } from './strings'
export type { Problem } from './check'
export { Misconfigured, readChart, readFigure, readList, Unavailable } from './data'
export type { Bar, ChartReading } from './read'
export * from './types'

/**
 * The dashboard somebody starts with, and what "Reset layout" goes back to: the ready-made widgets that are for
 * them, figures first. Everybody can then rearrange their own.
 */
const layoutFor = async (settings: Settings, req: PayloadRequest): Promise<WidgetInstance[]> => {
  const mine = (await Promise.all(settings.widgets.map(async widget =>
    (await startsWith(settings, req, widget) ? [widget] : [])))).flat()
  const small = (widget: Settings['widgets'][number]) => (widget.kind === 'own' ? widget.size === 'tile' : widget.kind === 'figure')
  const wide = mine.filter(widget => !small(widget))
  return [
    ...mine.filter(small).map(widget => ({ widgetSlug: widget.slug, width: 'x-small', ...(widget.data ? { data: widget.data } : {}) })),
    // one list takes the row, two share it
    ...wide.map(widget => ({ widgetSlug: widget.slug, width: wide.length === 1 ? 'full' : 'medium' })),
    { widgetSlug: 'collections', width: 'full' },
    // the slugs are checked against the generated types, which are made from this very list
  ] as WidgetInstance[]
}

const listed = (found: [string, Problem][]) => found.map(([slug, problem]) => `  - "${slug}": ${inWords(problem)}`).join('\n')

/** The ready-made widgets that pick a source, or a name from one, that is not there: found as the config is built. */
const misnamed = (settings: Settings): [string, Problem][] => settings.widgets.flatMap((widget): [string, Problem][] => {
  if (widget.kind === 'own') return []
  const source = typeof widget.source === 'string' ? sourceCalled(settings.sources, widget.source) : widget.source
  if (!source) return [[widget.slug, noSource(String(widget.source), settings.sources)]]
  return [
    ...elevatedProblems(widget.kind, widget, source),
    ...nameProblems(source, widget.show, widget.kind), ...viewProblems(widget.kind, widget.show.as, settings.views),
    ...(widget.kind === 'figure' ? figureProblems(widget.show as never) : []),
    ...(widget.kind === 'chart' ? seriesProblems(widget.show) : []),
  ].map(problem => [widget.slug, problem])
})

/** What only shows once Payload has settled the collections: a filter on a field one does not have, a date that is none. */
const misfiltered = (settings: Settings, payload: Payload): [string, Problem][] => settings.widgets.flatMap((widget): [string, Problem][] => {
  if (widget.kind === 'own') return []
  const source = typeof widget.source === 'string' ? sourceCalled(settings.sources, widget.source) : widget.source
  const fields = source && payload.collections[source.slug as CollectionSlug]?.config.flattenedFields
  if (!source || !fields) return []
  return [
    ...whereProblems(source.slug, fields, widget.show.where), ...dateProblems(source.slug, fields, widget.show.date),
    ...(widget.kind === 'list' ? [] : [widget.show.measure].flat().flatMap(measure => measureProblems(source, fields, measure))),
  ].map(problem => [widget.slug, problem])
})

/** The same of the filters a source declares as they are, without a function. */
const misdeclared = (settings: Settings, payload: Payload): [string, Problem][] => Object.entries(settings.sources).flatMap(([name, source]) => {
  const fields = payload.collections[source.slug as CollectionSlug]?.config.flattenedFields
  if (!fields) return []
  return Object.entries(source.filters).flatMap(([filter, { where }]) =>
    (typeof where === 'function' ? [] : whereProblems(source.slug, fields, where as Where)).map((problem): [string, Problem] => [`${name}.${filter}`, problem]))
})

/** After the plugins that leave their order open, so the collections they add are sources as well. */
const ORDER = 100

export const widgetsPlugin = (options: Options = {}): Plugin => Object.assign((config: Config): Config => {
  const settings = settled(options, config)
  const dashboard = config.admin?.dashboard
  const wrong = misnamed(settings)
  if (wrong.length) throw new Error(`widgetsPlugin: ${wrong.length === 1 ? 'a widget is' : 'some widgets are'} set up with what is not there\n${listed(wrong)}`)
  const seen = new Set((config.collections ?? []).map(collection => collection.slug as string))

  const ready: Widget[] = settings.widgets.map(widget => ({
    slug: widget.slug,
    label: settings.label(widget.label),
    // one component for all that read a source: it is told which one it stands for
    Component: widget.kind === 'own' ? widget.Component : component('ReadyWidget'),
    ...sized(widget.kind === 'own' ? (widget.size === 'tile' ? 'figure' : 'list') : widget.kind),
    ...(widget.fields ? { fields: said(widget.fields, settings.label) } : {}),
  }))

  // what is drawn under a widget is not a widget of Payload's: the import map has to be told of it
  const under = Object.fromEntries(settings.widgets.flatMap(widget =>
    widget.kind !== 'own' && widget.after ? [[`widgets-after-${widget.slug}`, { path: widget.after, type: 'component' as const }]] : []))
  // nor is a way of the project's own to draw one
  const views = Object.fromEntries(Object.entries(settings.views).map(([name, view]) => [`widgets-view-${name}`, { path: view.Component, type: 'component' as const }]))

  // what is kept of a collection is good until one of its records changes
  const fresh = (collection: CollectionConfig): CollectionConfig => {
    const forget = <D>({ doc }: { doc: D }) => {
      forgotten(collection.slug)
      return doc
    }
    return { ...collection, hooks: { ...collection.hooks, afterChange: [...(collection.hooks?.afterChange ?? []), forget], afterDelete: [...(collection.hooks?.afterDelete ?? []), forget] } }
  }

  return {
    ...config,
    ...(settings.cache && config.collections ? { collections: config.collections.map(fresh) } : {}),
    custom: { ...config.custom, [KEY]: settings },
    onInit: async payload => {
      await config.onInit?.(payload)
      const off = misfiltered(settings, payload)
      if (off.length) payload.logger.error(`widgetsPlugin: ${off.length === 1 ? 'a widget is' : 'some widgets are'} set up with what is not there\n${listed(off)}`)
      const filters = misdeclared(settings, payload)
      if (filters.length) payload.logger.error(`widgetsPlugin: ${filters.length === 1 ? 'a filter of a source is' : 'some filters of the sources are'} on what is not there\n${listed(filters)}`)
      // Payload's own come after every plugin; anything else was added by one that ran later still
      const late = options.discover === false ? [] : Object.keys(payload.collections).filter(slug => !seen.has(slug) && !slug.startsWith('payload-'))
      if (late.length) payload.logger.warn(`widgetsPlugin: ${late.join(', ')} ${late.length === 1 ? 'was' : 'were'} added to the config after the widgets were set up, and ${late.length === 1 ? 'is no source' : 'are no sources'}: give the plugin that adds ${late.length === 1 ? 'it' : 'them'} an order below ${ORDER}`)
    },
    admin: {
      ...config.admin,
      dependencies: { ...config.admin?.dependencies, ...under, ...views },
      dashboard: {
        ...dashboard,
        widgets: [...(dashboard?.widgets ?? []), ...ready, ...setUp(settings)],
        defaultLayout: dashboard?.defaultLayout ?? (({ req }) => layoutFor(settings, req)),
      },
    },
  }
}, { order: ORDER })
