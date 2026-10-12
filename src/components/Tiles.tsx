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
  label: string; note: string; href: string; empty: string
  bars: { label: string; amount: number; shown: string; href?: string }[]
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
const share = (amount: number, peak: number) => Math.max(0, amount / peak)

/** One to a row: what it is, how long, how much. */
const Rows = ({ bars, peak }: { bars: Bars; peak: number }) => (
  <ul className="widgets-chart">
    {bars.map((bar, index) => {
      const inside = (
        <>
          <span className="widgets-chart__label">{bar.label}</span>
          <span className="widgets-chart__bar" aria-hidden="true"><span style={{ width: `${share(bar.amount, peak) * 100}%` }} /></span>
          <span className="widgets-chart__value">{bar.shown}</span>
        </>
      )
      return <li key={index}>{bar.href ? <Link href={bar.href}>{inside}</Link> : <div>{inside}</div>}</li>
    })}
  </ul>
)

/** As many labels as there is room for under what stands side by side: every one of a few, every so many of many. */
const every = (count: number) => Math.ceil(count / 8)

/** Side by side: how tall each is, with what it is under it and how much on the pointer. */
const Columns = ({ bars, peak }: { bars: Bars; peak: number }) => {
  const step = every(bars.length)
  return (
  <ol className="widgets-columns">
    {bars.map((bar, index) => {
      const inside = (
        <>
          <span className="widgets-columns__bar" aria-hidden="true"><span style={{ height: `${share(bar.amount, peak) * 100}%` }} /></span>
          {/* it has the room of the columns up to the next one that is named */}
          <span className="widgets-columns__label" style={{ maxWidth: `${Math.min(step, bars.length - index) * 100}%` }}>{index % step ? '' : bar.label}</span>
        </>
      )
      const said = `${bar.label}: ${bar.shown || '0'}`
      return <li key={index} title={said} aria-label={said}>{bar.href ? <Link href={bar.href}>{inside}</Link> : <div>{inside}</div>}</li>
    })}
  </ol>
  )
}

const HEIGHT = 40

/** One line through all of them, with where it starts, its middle and where it ends named under it. */
const Line = ({ bars, peak, label, spark }: { bars: Bars; peak: number; label: string; spark?: boolean }) => {
  const points = bars.map((bar, index) => `${bars.length > 1 ? (index / (bars.length - 1)) * 100 : 50},${(HEIGHT - 1 - share(bar.amount, peak) * (HEIGHT - 2)).toFixed(2)}`)
  const named = [...new Set([0, Math.floor((bars.length - 1) / 2), bars.length - 1])]
  return (
    <span className={spark ? 'widgets-line widgets-line--spark' : 'widgets-line'}>
      <svg viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${bars.map(bar => `${bar.label} ${bar.shown || '0'}`).join(', ')}`}>
        <polygon className="widgets-line__area" points={`0,${HEIGHT} ${points.join(' ')} 100,${HEIGHT}`} />
        <polyline className="widgets-line__stroke" points={points.join(' ')} />
      </svg>
      {spark ? null : <span className="widgets-line__labels">{named.map(index => <span key={index}>{bars[index].label}</span>)}</span>}
    </span>
  )
}

/** A measure over time or by group: bars one to a row unless it is asked for as columns or as a line. */
export const ChartTile = ({ label, note, href, bars, empty, action, after, name, as = 'bars' }: ChartContent & Slots & { as?: 'bars' | 'columns' | 'line' }) => {
  const peak = Math.max(...bars.map(bar => Math.abs(bar.amount)), 0)
  return (
    <section className="widgets-tile widgets-tile--plain" {...marks('chart', 'calm', name, as)}>
      <div className="widgets-tile__head">
        <Link href={href}>
          <span className="widgets-tile__label">{label}</span>
          <span className="widgets-tile__note">{note}</span>
        </Link>
        <Extra action={action} />
      </div>
      {!bars.length || !peak ? <span className="widgets-tile__note">{empty}</span>
        : as === 'columns' ? <Columns bars={bars} peak={peak} />
          : as === 'line' ? <Line bars={bars} peak={peak} label={label} />
            : <Rows bars={bars} peak={peak} />}
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
