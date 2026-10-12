import React from 'react'
import type { Where, WidgetServerProps } from 'payload'
import { RenderServerComponent } from '@payloadcms/ui/elements/RenderServerComponent'
import { mayUse, settingsOf } from '../options'
import { CALCS, type Measure, type Period, type Reckoned } from '../types'
import { Chart, Figure, Records } from './index'
import { Notice } from './Tiles'

// What Payload draws for a dashboard widget: the ones somebody sets up themselves (a figure, a list or a chart out
// of any source they have a use for) and the ready-made ones. What can be chosen is listed in ../fields, from what
// the sources declare.

/** A choice is kept as `source.name`; one left over from another source counts as not made. */
const chosen = (value: unknown, source: unknown) =>
  typeof value === 'string' && value.startsWith(`${String(source)}.`) ? value.slice(String(source).length + 1) : undefined

const picked = (data: Record<string, unknown> = {}) => ({
  source: String(data.source ?? ''),
  filter: chosen(data.filter, data.source),
  // kept as the filter builder writes it; nothing where it was emptied
  where: data.where && typeof data.where === 'object' && !Array.isArray(data.where) ? data.where as Where : undefined,
  // a field of whichever collection the source is of
  date: chosen(data.date, data.source) as never,
  period: (data.period as Period | undefined) ?? 'all',
  from: typeof data.from === 'string' ? data.from : undefined,
  to: typeof data.to === 'string' ? data.to : undefined,
  label: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : undefined,
  as: typeof data.as === 'string' && data.as ? data.as : undefined,
})

/** The measure it kept, worked out the way it kept, where that is a measure it can be said of. */
const measured = (req: WidgetServerProps['req'], data: Record<string, unknown>) => {
  const name = chosen(data.measure, data.source)
  const measure = name ? settingsOf(req.payload).sources[String(data.source)]?.measures[name] as Measure | undefined : undefined
  const how = CALCS.find(calc => calc === data.calc)
  return name && how && how !== 'sum' && measure?.amount && !measure.counts ? { [how]: name } as unknown as Reckoned : name
}

const wordsOf = (req: WidgetServerProps['req']) => settingsOf(req.payload).words(req)

const unset = (req: WidgetServerProps['req'], label: string) => {
  const { t } = wordsOf(req)
  return <Notice label={t(label)} note={t('Choose what it shows: the pencil on the widget while editing the dashboard')} />
}

export const FigureWidget = async ({ req, widgetData: data }: WidgetServerProps) => {
  if (!data?.source) return unset(req, 'A figure')
  return (
    <Figure
      req={req} {...picked(data)} measure={measured(req, data)}
      compare={data.compare === 'previous' ? 'previous' : undefined}
      goal={Number(data.goal) > 0 ? Number(data.goal) : undefined}
      note={typeof data.note === 'string' && data.note.trim() ? data.note.trim() : undefined}
    />
  )
}

export const RecordsWidget = async ({ req, widgetData: data }: WidgetServerProps) => {
  if (!data?.source) return unset(req, 'A list')
  return <Records req={req} {...picked(data)} list={chosen(data.list, data.source)} limit={Number(data.limit) || undefined} />
}

export const ChartWidget = async ({ req, widgetData: data }: WidgetServerProps) => {
  if (!data?.source) return unset(req, 'A chart')
  return <Chart req={req} {...picked(data)} measure={measured(req, data)} by={data.by === 'time' ? 'time' : chosen(data.by, data.source) ?? 'time'} />
}

/** A ready-made widget: one of those the plugin was given, found by the slug it is drawn for. */
export const ReadyWidget = async ({ req, widgetData, widgetSlug }: WidgetServerProps) => {
  if (!req.user) return null
  const settings = settingsOf(req.payload)
  const widget = settings.widgets.find(candidate => candidate.slug === widgetSlug)
  if (!widget) return null
  const { t } = settings.words(req)
  if (!await mayUse(settings, req, widget)) return <Notice label={t(widget.label)} name={widget.slug} note={t('Not available to this account')} />
  // one of the project's own is drawn by its own component, not by this one
  if (widget.kind === 'own') return null
  const { source, label, show, action, access, overrideAccess } = widget
  // what the project draws under it: found in the import map by its path
  const after = widget.after
    ? RenderServerComponent({ Component: widget.after, importMap: req.payload.importMap, serverProps: { req, widgetSlug, widgetData: widgetData ?? {} } })
    : undefined
  // what it picks was checked where it was defined
  const own = { req, label, name: widget.slug, source, action, after, access, ...(overrideAccess ? { overrideAccess } : {}), ...show } as { req: typeof req; source: string }
  if (widget.kind === 'list') return <Records {...own} />
  if (widget.kind === 'chart') return <Chart {...own} />
  return <Figure {...own} data={widgetData ?? {}} />
}
