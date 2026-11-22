import type { PayloadRequest } from 'payload'
import { once } from './memo'
import type { Settings, UserWidgets } from './options'
import type { AnySource } from './types'

// The widgets anybody sets up in the dashboard's drawer, kept to what `userWidgets` in the options says: which
// kinds there are, of which sources, and for whom. What the drawer offers is narrowed where Payload is given the
// widgets; what is read is asked again on every request, so that a widget set up before something was taken away
// shows nothing of it. Nothing here may import a component: this is read by the Payload config.

type Kind = 'figure' | 'list' | 'chart'

/** The kind of widget each of the drawer's is, by its slug (see `setUp` in ./fields). */
export const KINDS: Record<string, Kind> = { figure: 'figure', records: 'list', chart: 'chart' }

const ruleOf = (settings: Settings): false | UserWidgets => settings.userWidgets ?? {}

/** The sources they may be of: by the name a source is given, or by its collection. */
export const theirSources = (settings: Settings): Record<string, AnySource> => {
  const rule = ruleOf(settings)
  if (!rule) return {}
  const only = rule.sources
  if (!only) return settings.sources
  return Object.fromEntries(Object.entries(settings.sources).filter(([name, source]) => only.includes(name) || only.includes(source.slug)))
}

/** The drawer's widgets that are offered at all: none, or those of the kinds there are, of the sources they may be of. */
export const offered = <W extends { slug: string }>(settings: Settings, setUp: (settings: Settings) => W[]): W[] => {
  const rule = ruleOf(settings)
  if (!rule) return []
  const made = setUp({ ...settings, sources: theirSources(settings) })
  return rule.kinds ? made.filter(widget => !KINDS[widget.slug] || rule.kinds?.includes(KINDS[widget.slug])) : made
}

/**
 * Whether a widget set up in the drawer may be read for whoever makes the request: of a kind there is, of a source
 * it may be of, and for them as `access` says, asked once a request. One that throws is a no.
 */
export const userMay = async (settings: Settings, req: PayloadRequest, kind: Kind, source: string): Promise<boolean> => {
  const rule = ruleOf(settings)
  if (!rule || !req.user) return false
  if (rule.kinds && !rule.kinds.includes(kind)) return false
  if (rule.sources && !(source in theirSources(settings))) return false
  if (!rule.access) return true
  const access = rule.access
  return once(req, ['userWidgets'], async () => {
    try {
      return !!await access({ req })
    } catch {
      return false
    }
  })
}

/**
 * What a ready-made widget is handed as `context.data`: what whoever has it set it to. Where it reads with the
 * server's access, only the fields it trusts them with (`trusted`); the rest are what it starts as (`data`), so that
 * nobody widens what it reads past what it was made to read by setting it.
 */
export const dataFor = (widget: { overrideAccess?: boolean; trusted?: string[]; data?: Record<string, unknown> }, stored: Record<string, unknown> | undefined): Record<string, unknown> => {
  if (!widget.overrideAccess) return stored ?? {}
  const own = Object.fromEntries((widget.trusted ?? []).filter(name => stored && Object.hasOwn(stored, name)).map(name => [name, stored?.[name]]))
  return { ...widget.data, ...own }
}
