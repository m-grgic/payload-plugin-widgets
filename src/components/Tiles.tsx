import React, { type ReactNode } from 'react'
import { Link } from '@payloadcms/ui'
import { QuickAdd } from './QuickAdd'
import '../widgets.css'

// The figures and short lists a widget is drawn as, on the dashboard and wherever else something is summed up.
// Styled in ../widgets.css, which says what of it a project can change: every tile says what kind it is, how it
// is doing and, where it was given one, its name, as `data-kind`, `data-tone` and `data-widget`.

export type Tone = 'calm' | 'warn' | 'bad'

/** What a project adds to a tile: a link in its head, and anything at all under what it shows. */
export interface Slots {
  action?: { label: string; href: string }
  after?: ReactNode
  /** What the tile is found by in a stylesheet: `[data-widget='open-tasks']`. A ready-made widget is given its slug. */
  name?: string
}

/** What a stylesheet tells a tile by. */
const marks = (kind: string, tone: Tone, name?: string, view?: string) => ({ 'data-kind': kind, 'data-tone': tone, ...(view ? { 'data-view': view } : {}), ...(name ? { 'data-widget': name } : {}) })

const Extra = ({ action }: Pick<Slots, 'action'>) =>
  action ? <Link className="widgets-tile__action" href={action.href} {...(/^https?:/.test(action.href) ? { target: '_blank', rel: 'noreferrer' } : {})}>{action.label}</Link> : null

export interface TileContent {
  label: string
  value: ReactNode
  note?: ReactNode
  tone?: Tone
  /** Where a click leads: the list behind the figure. Without it the tile is not a link. */
  href?: string
  /** Whether it is more or less than in the period before: said to a stylesheet as `data-trend`. */
  trend?: 'up' | 'down' | 'flat'
  /** What it is set against, and how much of that it is: drawn where the tile is asked for as progress. */
  goal?: { value: string; amount: number; share: number }
  /** What it was over time: drawn where the tile is asked for as a sparkline. */
  series?: { label: string; amount: number; shown: string }[]
}

export interface ListContent {
  label: string; note: string; tone: Tone; href: string; rows: { title: string; detail: string; href: string; late?: boolean }[]; empty: string
  /** The form for a new one, where the person looking may add one. */
  add?: { href: string; label: string }
  /** A box that adds one by a single field, its title unless said otherwise. */
  quick?: { slug: string; field?: string; data?: Record<string, unknown>; placeholder: string }
}

export interface ChartContent {
  /** `href` is the list behind it: without it the head is not a link. */
  label: string; note: string; href?: string; empty: string
  bars: { label: string; amount: number; shown: string; href?: string }[]
  /**
   * Several things drawn at once, each in a colour of its own: a bar for every one of `bars`, drawn against `peak`.
   * Where they are `stacked` they are parts of `bars` and stand on one another.
   */
  series?: { key: string; label: string; total: string; peak: number; bars: { label: string; amount: number; shown: string }[] }[]
  stacked?: boolean
}

/**
 * One figure: what it is, the number, and a line under it. Orange or red when it wants attention. Asked for as
 * progress, how far towards its goal it is stands between the two; as a sparkline, what it was over time.
 */
export const Tile = ({ label, value, note, tone = 'calm', href, action, after, name, trend, goal, series, as = 'number' }: TileContent & Slots & { as?: 'number' | 'progress' | 'sparkline' }) => {
  const marked = { ...marks('figure', tone, name, as), ...(trend ? { 'data-trend': trend } : {}) }
  const peak = Math.max(...(series ?? []).map(point => Math.abs(point.amount)), 0)
  const inside = (
    <>
      <span className="widgets-tile__label">{label}</span>
      <span className="widgets-tile__value">{value}</span>
      {as === 'progress' && goal ? <span className="widgets-tile__progress" role="img" aria-label={`${Math.round(goal.share * 100)}%`}><span style={{ width: `${Math.min(1, goal.share) * 100}%` }} /></span> : null}
      {as === 'sparkline' && series?.length && peak ? <Line bars={series} peak={peak} label={label} spark /> : null}
      {note ? <span className="widgets-tile__note">{note}</span> : null}
    </>
  )
  // a link cannot hold another: with something of the project's own in it, only the figure leads to the list
  if (action || after) {
    return (
      <div className="widgets-tile widgets-tile--plain" {...marked}>
        {href ? <Link href={href} className="widgets-tile__figure">{inside}</Link> : <div className="widgets-tile__figure">{inside}</div>}
        <Extra action={action} />
        {after}
      </div>
    )
  }
  return href
    ? <Link href={href} className="widgets-tile" {...marked}>{inside}</Link>
    : <div className="widgets-tile widgets-tile--plain" {...marked}>{inside}</div>
}

/** A tile that only says something, for a figure that cannot be shown. */
export const Notice = ({ label, note, name }: { label: string; note: string; name?: string }) => (
  <div className="widgets-tile widgets-tile--plain" {...marks('notice', 'calm', name)}>
    <span className="widgets-tile__label">{label}</span>
    <span className="widgets-tile__note">{note}</span>
  </div>
)

/**
 * The first few of a list with a link to all of them, and where it makes sense a way to add one. `api` is Payload's
 * API route; `words` are what the link to a new one and a failed quick add say, in the language of whoever looks.
 */
export const ListTile = ({ label, note, tone, href, rows, empty, add, quick, api, words, action, after, name }: ListContent & Slots & { api: string; words?: { add?: string; failed?: string } }) => (
  <section className="widgets-tile widgets-tile--plain" {...marks('list', tone, name)}>
    <div className="widgets-tile__head">
      <Link href={href}>
        <span className="widgets-tile__label">{label}</span>
        <span className="widgets-tile__note">{note}</span>
      </Link>
      <Extra action={action} />
      {add ? <Link className="widgets-tile__action" href={add.href} aria-label={add.label} title={add.label}>{words?.add ?? '+ New'}</Link> : null}
    </div>
    {rows.length ? (
      <ul className="widgets-tile__rows">
        {rows.map((row, index) => (
          <li key={index}>
            <Link href={row.href}>
              <span>{row.title}</span>
              <span className={row.late ? 'widgets-tile__late' : undefined}>{row.detail}</span>
            </Link>
          </li>
        ))}
      </ul>
    ) : <span className="widgets-tile__note">{empty}</span>}
    {quick ? <QuickAdd api={api} slug={quick.slug} field={quick.field} data={quick.data} placeholder={quick.placeholder} failed={words?.failed ?? 'That could not be added.'} /> : null}
    {after}
  </section>
)

type Bars = ChartContent['bars']
type Many = NonNullable<ChartContent['series']>
const share = (amount: number, peak: number) => (peak ? Math.max(0, amount / peak) : 0)

/** The colour a series is drawn in: there are six, and then they come round again. */
const hue = (index: number) => ({ 'data-series': (index % 6) + 1 })
/** What a bar says of each of its series, for the pointer and for whoever does not see it. */
const told = (label: string, many: Many, index: number) => `${label}: ${many.map(one => `${one.label} ${one.bars[index]?.shown || '0'}`).join(', ')}`
/** How long a series is at one bar: of what they all come to where they stand on one another, of its own most otherwise. */
const lengths = (many: Many, stacked: boolean | undefined) => {
  const most = Math.max(...(many[0]?.bars ?? []).map((_, index) => many.reduce((sum, one) => sum + Math.max(0, one.bars[index]?.amount ?? 0), 0)), 0)
  return (one: Many[number], index: number) => `${share(one.bars[index]?.amount ?? 0, stacked ? most : one.peak) * 100}%`
}
/** Whether they stand on one another or side by side, for a stylesheet. */
const arranged = (many: Many | undefined, stacked: boolean | undefined) => (many ? { 'data-many': stacked ? 'stacked' : 'grouped' } : {})

/** One to a row: what it is, how long, how much. */
const Rows = ({ bars, peak, many, stacked }: { bars: Bars; peak: number; many?: Many; stacked?: boolean }) => {
  const long = many && lengths(many, stacked)
  return (
    <ul className="widgets-chart" {...arranged(many, stacked)}>
      {bars.map((bar, index) => {
        const inside = (
          <>
            <span className="widgets-chart__label">{bar.label}</span>
            {many && long && !stacked
              ? <span className="widgets-chart__bars" aria-hidden="true">{many.map((one, at) => <span key={one.key} className="widgets-chart__bar"><span {...hue(at)} style={{ width: long(one, index) }} /></span>)}</span>
              : <span className="widgets-chart__bar" aria-hidden="true">
                {many && long ? many.map((one, at) => <span key={one.key} {...hue(at)} style={{ width: long(one, index) }} />) : <span style={{ width: `${share(bar.amount, peak) * 100}%` }} />}
              </span>}
            {/* a few side by side each say their own; of parts, or of many, what they come to */}
            <span className="widgets-chart__value">{many && !stacked && many.length <= 3 ? many.map(one => one.bars[index]?.shown || '0').join(' · ') : bar.shown}</span>
          </>
        )
        return <li key={index} title={many ? told(bar.label, many, index) : undefined}>{bar.href ? <Link href={bar.href}>{inside}</Link> : <div>{inside}</div>}</li>
      })}
    </ul>
  )
}

/** As many labels as there is room for under what stands side by side: every one of a few, every so many of many. */
const every = (count: number) => Math.ceil(count / 8)

/** Side by side: how tall each is, with what it is under it and how much on the pointer. */
const Columns = ({ bars, peak, many, stacked }: { bars: Bars; peak: number; many?: Many; stacked?: boolean }) => {
  const step = every(bars.length)
  const tall = many && lengths(many, stacked)
  return (
  <ol className="widgets-columns" {...arranged(many, stacked)}>
    {bars.map((bar, index) => {
      const inside = (
        <>
          <span className="widgets-columns__bar" aria-hidden="true">
            {many && tall ? many.map((one, at) => <span key={one.key} {...hue(at)} style={{ height: tall(one, index) }} />) : <span style={{ height: `${share(bar.amount, peak) * 100}%` }} />}
          </span>
          {/* it has the room of the columns up to the next one that is named */}
          <span className="widgets-columns__label" style={{ maxWidth: `${Math.min(step, bars.length - index) * 100}%` }}>{index % step ? '' : bar.label}</span>
        </>
      )
      const said = many ? told(bar.label, many, index) : `${bar.label}: ${bar.shown || '0'}`
      return <li key={index} title={said} aria-label={said}>{bar.href ? <Link href={bar.href}>{inside}</Link> : <div>{inside}</div>}</li>
    })}
  </ol>
  )
}

const HEIGHT = 40

/** One line through all of them, with where it starts, its middle and where it ends named under it. Of several, a line each. */
const Line = ({ bars, peak, label, spark, many }: { bars: Bars; peak: number; label: string; spark?: boolean; many?: Many }) => {
  const through = (of: { amount: number }[], against: number) => of.map((bar, index) => `${of.length > 1 ? (index / (of.length - 1)) * 100 : 50},${(HEIGHT - 1 - share(bar.amount, against) * (HEIGHT - 2)).toFixed(2)}`).join(' ')
  const named = [...new Set([0, Math.floor((bars.length - 1) / 2), bars.length - 1])]
  const said = many ? many.map(one => `${one.label} ${one.total}`) : bars.map(bar => `${bar.label} ${bar.shown || '0'}`)
  return (
    <span className={spark ? 'widgets-line widgets-line--spark' : 'widgets-line'}>
      <svg viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${said.join(', ')}`}>
        {many ? many.map((one, at) => <polyline key={one.key} className="widgets-line__stroke" {...hue(at)} points={through(one.bars, one.peak)} />) : (
          <>
            <polygon className="widgets-line__area" points={`0,${HEIGHT} ${through(bars, peak)} 100,${HEIGHT}`} />
            <polyline className="widgets-line__stroke" points={through(bars, peak)} />
          </>
        )}
      </svg>
      {spark ? null : <span className="widgets-line__labels">{named.map(index => <span key={index}>{bars[index].label}</span>)}</span>}
    </span>
  )
}

/** Which colour is which, and what each comes to. */
const Legend = ({ many }: { many: Many }) => (
  <ul className="widgets-legend">
    {many.map((one, at) => (
      <li key={one.key} {...hue(at)}>
        <span className="widgets-legend__mark" aria-hidden="true" />
        <span>{one.label}</span>
        <span className="widgets-legend__total">{one.total}</span>
      </li>
    ))}
  </ul>
)

/**
 * A measure over time or by group: bars one to a row unless it is asked for as columns or as a line. Several
 * measures, or one told apart by a second group, are drawn each in its own colour and named under the head.
 */
export const ChartTile = ({ label, note, href, bars, empty, series, stacked, action, after, name, as = 'bars' }: ChartContent & Slots & { as?: 'bars' | 'columns' | 'line' }) => {
  const many = series?.length ? series : undefined
  const peak = Math.max(...(many ? many.map(one => one.peak) : bars.map(bar => Math.abs(bar.amount))), 0)
  const head = (
    <>
      <span className="widgets-tile__label">{label}</span>
      {note ? <span className="widgets-tile__note">{note}</span> : null}
    </>
  )
  return (
    <section className="widgets-tile widgets-tile--plain" {...marks('chart', 'calm', name, as)}>
      <div className="widgets-tile__head">
        {href ? <Link href={href}>{head}</Link> : <div>{head}</div>}
        <Extra action={action} />
      </div>
      {!bars.length || !peak ? <span className="widgets-tile__note">{empty}</span> : (
        <>
          {many ? <Legend many={many} /> : null}
          {as === 'columns' ? <Columns bars={bars} peak={peak} many={many} stacked={stacked} />
            : as === 'line' ? <Line bars={bars} peak={peak} label={label} many={many} />
              : <Rows bars={bars} peak={peak} many={many} stacked={stacked} />}
        </>
      )}
      {after}
    </section>
  )
}

/** Something written for whoever looks at the page, with a link where there is one. */
export const NoteTile = ({ label, text, link, name }: { label: string; text: string; link?: { href: string; label: string }; name?: string }) => (
  <section className="widgets-tile widgets-tile--plain widgets-note" {...marks('note', 'calm', name)}>
    <span className="widgets-tile__label">{label}</span>
    {text.split(/\n{2,}/).filter(Boolean).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
    {link ? <a href={link.href} {...(/^https?:/.test(link.href) ? { target: '_blank', rel: 'noreferrer' } : {})}>{link.label}</a> : null}
  </section>
)
