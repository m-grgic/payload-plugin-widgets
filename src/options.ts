import type { Access, CollectionSlug, Config, Field, Payload, PayloadRequest, Where } from 'payload'
import { sourcesOf } from './discover'
import type { Dictionary, Plurals } from './strings'
import type { AnySource, Doc, Format, Label, Narrowing, Numbers, Period, Reckoned, Source, Vars, View, VIEWS } from './types'

// What the plugin is given by the project that uses it: the sources, the widgets made of them, and how things are
// said. Everything has a default: without any of it, every collection is a source as its fields describe it.
// Nothing here may import a component: this is read by the Payload config.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

interface Common {
  /** In English; `translate` in the options says it in the other languages. */
  label: string
  /**
   * Who it is for, asked as Payload asks it of a collection: `({ req }) => req.user?.role === 'admin'`. A filter in
   * place of `true` leaves it only those records. Whoever its source is for where it is left out.
   */
  access?: Access
  /** Who starts with it on their dashboard, where that is fewer than it is for: `false` for nobody, it is then only there to be added. */
  home?: Home
}

/** Whether somebody starts with a widget on their dashboard: asked as an access is, and anything but a no is a yes. */
export type Home = boolean | Access

interface Elevated {
  /**
   * Read with the server's access in place of the person's own, as the local API has it: a total for people who may
   * not open what it is a total of. It has to say who it is for (`access`, here or on its source), and leads to the
   * list behind it only for those the collection lets read.
   */
  overrideAccess?: boolean
}

/** A link in the head of a tile. */
export interface Action { label: string; href: string }

interface Slots {
  /** A link of your own in the head of the tile: `{ label: 'Export', href: '/admin/export' }`. A figure is given it under the number. */
  action?: Action
  /**
   * Something of your own drawn under what the widget shows: a component by its path, as Payload takes them
   * (`src/components/Hint.tsx#Hint`). It is handed `req`, `widgetSlug` and `widgetData`.
   */
  after?: string
}

/** How it is drawn: one of the plugin's own ways for its kind, or one the plugin was given under `views`. */
type As<K extends keyof typeof VIEWS> = keyof (typeof VIEWS)[K] | (string & {})

interface Narrowed<S extends CollectionSlug, F extends string> {
  /** One of the source's filters; none is all of its records. */
  filter?: NoInfer<F>
  /**
   * Which of its records, as Payload filters them anywhere: `{ status: { equals: 'open' } }`, with `and` and `or` as
   * needed. On top of `filter`, where both are given. A date can be compared with a moment by name, which is then
   * always the one that is now: `{ dueDate: { less_than: 'today' } }`, `'startOfMonth-1m'`, `'now+7d'` (see `Moment`).
   */
  where?: Narrowing<NoInfer<S>>
  period?: Period
  /** The date the period goes by: the source's own where it is left out. */
  date?: keyof Doc<NoInfer<S>> & string
  /** For the period between two dates: the first and the last day, as YYYY-MM-DD. Either may be left out. */
  from?: string
  to?: string
}

interface Kept {
  slug: string
  label: string
  access?: Access
  home?: Home
  data?: Record<string, unknown>
  fields?: Field[]
}

/** A widget out of a source, as the plugin keeps it: made with `figure`, `list` or `chart`. */
export interface SourceWidget extends Kept, Slots {
  kind: 'figure' | 'list' | 'chart'
  /** The source itself, or the collection of one that was found by the plugin. */
  source: AnySource | string
  overrideAccess?: boolean
  show: { filter?: string; where?: Where; period?: Period; date?: string; from?: string; to?: string; measure?: string | Reckoned | (string | Reckoned)[]; list?: string; limit?: number; by?: string; series?: string; as?: string; compare?: 'previous'; goal?: number; note?: string }
}

/** A widget drawn by a component of the project's own: made with `widget`. */
export interface OwnWidget extends Kept {
  kind: 'own'
  Component: string
  size: 'tile' | 'wide'
}

/** A ready-made widget as the plugin keeps it. */
export type Widget = SourceWidget | OwnWidget

const made = (kind: SourceWidget['kind'], slug: string, source: AnySource | string, { label, access, overrideAccess, home, data, fields, action, after, ...show }: Common & Loose): Widget => ({
  slug, label, kind, source, show,
  ...(access ? { access } : {}), ...(overrideAccess ? { overrideAccess: true } : {}), ...(home !== undefined ? { home } : {}), ...(data ? { data } : {}), ...(fields ? { fields } : {}),
  ...(action ? { action } : {}), ...(after ? { after } : {}),
})

type Fields<S extends CollectionSlug> = keyof Doc<S> & string

type FigureShow<S extends CollectionSlug, F extends string, M extends string> = Common & Slots & Elevated & Narrowed<S, F> & {
  /**
   * How many there are where it is left out. One of the source's measures by name, or one said in place: a number
   * of the collection, or a measure that adds one up, as `sum`, `avg`, `min` or `max` (`{ avg: 'total' }`).
   */
  measure?: M | Reckoned<M | Numbers<S>>
  /** Also read for the period before, which is as long: the line under the figure then says how much more or less it is. Needs a period. */
  compare?: 'previous'
  /** What it is set against, in what the measure counts: the line under the figure then says how much of it that is. */
  goal?: number
  /**
   * What the line under the figure says, in place of the usual: `'{left} to go'`. It can use `{value}`, `{note}`
   * (what it would have said), with `compare` `{previous}` and `{change}`, and with a goal `{goal}`, `{percent}` and `{left}`.
   */
  note?: string
  /** A number, a number with how far towards its goal it is (`'progress'`), or a number over a line of what it was (`'sparkline'`). */
  as?: As<'figure'>
  /** Settings of its own, with what they start as: a measure reads them from `context.data`. */
  fields?: Field[]
  data?: Record<string, unknown>
}

/**
 * One figure: how many records, or one of a source's measures. Out of a source that is declared, or out of any
 * collection by its slug, which then offers what the plugin finds in it: a sum for each of its number fields.
 *
 *   figure('unpaid-invoices', invoices, { label: 'Unpaid invoices', filter: 'unpaid', measure: 'total' })
 *   figure('open-tasks', 'tasks', { label: 'Open tasks', where: { status: { not_equals: 'done' } } })
 *   figure('longest-task', 'tasks', { label: 'Longest task', measure: { max: 'estimatedTime', format: 'hours' } })
 *   figure('sold', invoices, { label: 'Sold this month', measure: 'total', period: 'month', compare: 'previous', goal: 5000, as: 'progress' })
 */
export const figure: {
  <S extends CollectionSlug, F extends string, M extends string>(slug: string, source: Source<S, F, M, Loose, Loose, Loose>, show: FigureShow<S, F, NoInfer<M>>): Widget
  <const S extends CollectionSlug>(slug: string, source: S, show: FigureShow<S, never, Numbers<S> | 'count'>): Widget
} = (slug: string, source: AnySource | string, show: Loose) => made('figure', slug, source, show)

type ListShow<S extends CollectionSlug, F extends string, L extends string> = Common & Slots & { list?: L; filter?: NoInfer<F>; where?: Narrowing<NoInfer<S>>; limit?: number; as?: As<'list'> }

/** The first few rows of one of a source's lists; of a collection by its slug, its latest records. */
export const list: {
  <S extends CollectionSlug, F extends string, L extends string>(slug: string, source: Source<S, F, Loose, L, Loose, Loose>, show: ListShow<S, F, NoInfer<L>> & { list: NoInfer<L> }): Widget
  <const S extends CollectionSlug>(slug: string, source: S, show: ListShow<S, never, 'latest'>): Widget
} = (slug: string, source: AnySource | string, show: Loose) => made('list', slug, source, show)

type ChartShow<S extends CollectionSlug, F extends string, M extends string, G extends string> = Common & Slots & Elevated & Narrowed<S, F> & {
  /** One measure, or several to set side by side: `['revenue', 'costs']`. Each is then a series. */
  measure?: M | Reckoned<M | Numbers<S>> | (M | Reckoned<M | Numbers<S>>)[]
  by?: G | 'time'
  /** Another of the source's groups to tell every bar apart by: `by: 'time', series: 'status'`. Each of the first few of its values is then a series. */
  series?: G
  /** Bars one to a row, columns side by side, or a line: `'columns'`. */
  as?: As<'chart'>
}

/** A measure over time, or split by one of the source's groups, as bars unless `as` says otherwise; of a collection by its slug, by any of its selects, checkboxes and relationships. */
export const chart: {
  <S extends CollectionSlug, F extends string, M extends string, G extends string>(slug: string, source: Source<S, F, M, Loose, G, Loose>, show: ChartShow<S, F, NoInfer<M>, NoInfer<G>>): Widget
  <const S extends CollectionSlug>(slug: string, source: S, show: ChartShow<S, never, Numbers<S> | 'count', Fields<S>>): Widget
} = (slug: string, source: AnySource | string, show: Loose) => made('chart', slug, source, show)

/**
 * A widget that is all your own: any server component, as Payload takes them. Here it is given a place in the
 * starting layout and a label in every language of the admin like the rest; wrapped in `gated` (see ./components),
 * it is also kept to whoever its `access` says it is for.
 *
 *   widget('shortcuts', { label: 'Shortcuts', Component: 'src/components/Shortcuts.tsx#Shortcuts' })
 */
export const widget = (slug: string, { label, access, home, Component, size = 'wide', fields, data }: Common & {
  Component: string
  /** As small as a figure, or as wide as a list. */
  size?: 'tile' | 'wide'
  /** Its settings, with what they start as: the component reads them from `widgetData`. */
  fields?: Field[]
  data?: Record<string, unknown>
}): Widget => ({
  slug, label, kind: 'own', Component, size,
  ...(access ? { access } : {}), ...(home !== undefined ? { home } : {}), ...(data ? { data } : {}), ...(fields ? { fields } : {}),
})

export interface Options {
  /**
   * Every collection is a source by itself, as its fields describe it. Here one is left out with `false`, or
   * declared with `source(…)` for what cannot be found: `{ media: false, invoices }`. A declared one is kept by the
   * name it is given here; renaming it leaves the widgets set up with it saying they are not set up.
   */
  sources?: { [Slug in CollectionSlug]?: AnySource | boolean } & Record<string, AnySource | boolean | undefined>
  /** `false` to have only the sources that are declared. */
  discover?: boolean
  /** The ready-made widgets, in the order they are laid out: `figure(…)`, `list(…)`, `chart(…)`, and `widget(…)` for one of your own. */
  widgets?: Widget[]
  /**
   * Ways of your own to draw a widget, by the name a widget asks for one with (`as: 'donut'`); whoever sets one up
   * in its drawer is offered them under "Drawn as".
   *
   *   views: { donut: { kind: 'chart', label: 'A donut', Component: 'src/components/Donut.tsx#Donut' } }
   */
  views?: Record<string, View>
  /** Only where the admin speaks more than English. */
  i18n?: {
    /** Everything is written in English: this is what it is in the admin's other languages, by language (see `STRINGS`). */
    translations?: Record<string, Dictionary>
    /** What is counted, by language, under what it is called for one in English: `{ hr: { record: { one: 'zapis', few: 'zapisa', other: 'zapisa' } } }`. */
    plurals?: Record<string, Plurals>
    /** For a project with a dictionary of its own: says a text in a language, with `{name}` filled from `vars`. Instead of `translations`. */
    translate?: (language: string, text: string, vars?: Vars) => string
    /** "1 task", "3 tasks" the project's own way. Instead of `plurals`. */
    plural?: (language: string, count: number, one: string, many: string) => string
    /** What dates and numbers are formatted with in a language: `hr-HR`. The language itself where it is left out. */
    locale?: (language: string) => string
  }
  /** Where a day starts and ends: `Europe/Zagreb`. UTC where it is left out. */
  timeZone?: string
  /** The day a week starts on, for `startOfWeek` in a filter: 0 for Sunday to 6 for Saturday. Monday where it is left out. */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6
  /** The currency of amounts that do not say theirs, and the one charts are drawn in. EUR where it is left out. */
  currency?: string
  /**
   * Only where a number is not written the way the locale has it: every amount, number and count of hours a widget
   * shows goes through here. What it leaves alone (returns nothing for) is written as usual.
   *
   *   format: (value, { style, currency }) => style === 'money' ? `${value.toFixed(2)} ${currency}` : undefined
   */
  format?: (value: number, as: { style: Format; locale: string; currency?: string }) => string | undefined
  /**
   * A sum, an average and a chart of a field are added up by the database where it is Postgres, and where that
   * comes to what reading the records would. `'records'` to have them always read record by record instead.
   */
  sums?: 'database' | 'records'
  /**
   * For how many seconds what a figure and a chart read is kept, for each person apart: the dashboard then asks
   * the database once for as many times as it is opened. Forgotten when a record of the collection changes.
   * Nothing is kept where it is left out.
   */
  cache?: number
}

/** How things are said to whoever makes a request. */
export interface Words {
  t: (text: Label, vars?: Vars) => string
  plural: (count: number, one: string, many: string) => string
  locale: string
}

/** The options with every default filled in: what the components read. */
export interface Settings {
  sources: Record<string, AnySource>
  widgets: Widget[]
  views: Record<string, View>
  words: (req: PayloadRequest) => Words
  /** What a widget, a field or a choice is called in each of the admin's languages. */
  label: (english: Label) => Label
  timeZone: string
  weekStartsOn: number
  currency: string
  /** A number as it is shown: an amount in a currency, a plain number, or hours. */
  format: (value: number, style: Format, locale: string, currency?: string) => string
  sums: 'database' | 'records'
  /** In seconds; nought for nothing kept. */
  cache: number
}

const fill = (text: string, vars?: Vars) => (vars ? text.replace(/\{(\w+)\}/g, (whole, key) => (key in vars ? String(vars[key]) : whole)) : text)

export const settled = (options: Options, config: Config): Settings => {
  const { i18n = {} } = options
  const translate = i18n.translate ?? ((language, text, vars) => fill(i18n.translations?.[language]?.[text] ?? text, vars))
  const counted = (language: string, count: number, one: string, many: string) => {
    const forms = i18n.plurals?.[language]?.[one]
    if (!forms) return `${count} ${count === 1 ? one : many}`
    return `${count} ${forms[new Intl.PluralRules(language).select(count)] ?? forms.other ?? many}`
  }
  const languages = Object.keys(config.i18n?.supportedLanguages ?? {})
  return {
    sources: sourcesOf(options.sources, config, options.discover !== false),
    widgets: options.widgets ?? [],
    views: options.views ?? {},
    words: req => {
      const language = req.i18n?.language || 'en'
      return {
        // what is already in several languages is said in the one asked for; failing that its English is translated like the rest
        t: (text, vars) => (typeof text === 'string' ? translate(language, text, vars)
          : text[language] ? fill(text[language], vars)
            : text.en ? translate(language, text.en, vars) : fill(Object.values(text)[0] ?? '', vars)),
        plural: (count, one, many) => i18n.plural?.(language, count, one, many) ?? counted(language, count, one, many),
        locale: i18n.locale?.(language) ?? language,
      }
    },
    label: english => (typeof english !== 'string' ? english : (i18n.translate || i18n.translations) && languages.length ? Object.fromEntries(languages.map(language => [language, translate(language, english)])) : english),
    timeZone: options.timeZone ?? 'UTC',
    weekStartsOn: options.weekStartsOn ?? 1,
    currency: (options.currency ?? 'EUR').toUpperCase(),
    sums: options.sums ?? 'database',
    cache: Math.max(0, Number(options.cache) || 0),
    format: (value, style, locale, currency) => {
      const own = options.format?.(value, { style, locale, ...(currency ? { currency } : {}) })
      if (own !== undefined) return own
      if (style === 'money') return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value)
      // hours as the language writes them: "14 hr", "14 h", "14 Std."
      return value.toLocaleString(locale, { maximumFractionDigits: 1, ...(style === 'hours' ? { style: 'unit', unit: 'hour', unitDisplay: 'short' } : {}) })
    },
  }
}

/** Where the settings are kept in the Payload config, for the components to find them by. */
export const KEY = 'widgets'

export const settingsOf = (payload: Payload): Settings => {
  const found = (payload.config.custom as Record<string, unknown> | undefined)?.[KEY]
  if (!found) throw new Error('The widgets plugin is not in the Payload config: add widgetsPlugin() to its plugins')
  return found as Settings
}

/** A source by the name it is kept under, or by its collection. */
export const sourceCalled = (sources: Record<string, AnySource>, name: string): AnySource | undefined =>
  sources[name] ?? Object.values(sources).find(source => source.slug === name)

/** Whether the collection of a source lets whoever makes the request read it at all. */
export const readable = async (req: PayloadRequest, source: AnySource): Promise<boolean> => {
  const read = req.payload.collections[source.slug as CollectionSlug]?.config.access.read
  try {
    return !!req.user && !!read && !!(await read({ req }))
  } catch {
    return false
  }
}

/** What a widget adds to who its source is for. */
export interface Gate { access?: Access; overrideAccess?: boolean }

/**
 * What somebody is let see of a source: nothing, or its records, narrowed by whatever filters stood in place of a
 * yes. The collection is asked first, unless it is read with the server's access; then the source, then the widget.
 */
export const accessTo = async (req: PayloadRequest, source: AnySource, gate: Gate = {}): Promise<Where[] | false> => {
  if (!req.user) return false
  try {
    if (!gate.overrideAccess && !await readable(req, source)) return false
    const narrowed: Where[] = []
    for (const access of [source.access, gate.access]) {
      const answer = access ? await access({ req }) : true
      if (!answer) return false
      if (typeof answer === 'object') narrowed.push(answer)
    }
    return narrowed
  } catch {
    return false
  }
}

/** Whether a source is for whoever makes the request. */
export const mayRead = async (req: PayloadRequest, source: AnySource): Promise<boolean> => !!await accessTo(req, source)

/** Whether a ready-made widget is: by its own access and its source's. One of the project's own without any is anybody's. */
export const mayUse = async (settings: Settings, req: PayloadRequest, widget: Widget): Promise<boolean> => {
  if (!req.user) return false
  if (widget.kind === 'own') {
    try {
      return !widget.access || !!await widget.access({ req })
    } catch {
      return false
    }
  }
  const source = typeof widget.source === 'string' ? sourceCalled(settings.sources, widget.source) : widget.source
  return !!source && !!await accessTo(req, source, widget)
}

/** Whether somebody starts with a ready-made widget on their dashboard: it is for them, and it does not say otherwise. */
export const startsWith = async (settings: Settings, req: PayloadRequest, widget: Widget): Promise<boolean> => {
  if (widget.home === false || !await mayUse(settings, req, widget)) return false
  return typeof widget.home === 'function' ? !!await widget.home({ req }) : true
}
