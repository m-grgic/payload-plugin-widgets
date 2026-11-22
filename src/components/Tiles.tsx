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

/** What the tone of a tile, otherwise only a colour, says to whoever does not see it. */
type Toned = { warn?: string; bad?: string }
const Spoken = ({ tone, words }: { tone: Tone; words?: Toned }) =>
  tone === 'calm' ? null : <span className="widgets-hidden">{', '}{tone === 'warn' ? words?.warn ?? 'Needs attention' : words?.bad ?? 'Urgent'}</span>

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
   * Several things drawn at once, each in a colour of its own: a bar for every one of `bars`. Where every one has the
   * same `peak` they are drawn to one scale, each to its own otherwise. Where they are `stacked` they are parts of
   * `bars` and stand on one another.
   */
  series?: { key: string; label: string; total: string; peak: number; bars: { label: string; amount: number; shown: string }[] }[]
  stacked?: boolean
}

/**
 * One figure: what it is, the number, and a line under it. Orange or red when it wants attention. Asked for as
 * progress, how far towards its goal it is stands between the two; as a sparkline, what it was over time.
 */
export const Tile = ({ label, value, note, tone = 'calm', href, action, after, name, trend, goal, series, as = 'number', words }: TileContent & Slots & { as?: 'number' | 'progress' | 'sparkline'; /** What its tone is said as, in the language of whoever looks. */ words?: Toned }) => {
  const marked = { ...marks('figure', tone, name, as), ...(trend ? { 'data-trend': trend } : {}) }
  // drawn from nothing, up or down, as a chart is
  const scales = scalesOf(series ?? [], undefined, false)
  // which way it went, for whoever does not tell it by the number: the note says how much
  const way = trend === 'up' ? '▲' : trend === 'down' ? '▼' : null
  const inside = (
    <>
      <span className="widgets-tile__label">{label}<Spoken tone={tone} words={words} /></span>
      <span className="widgets-tile__value">{value}</span>
      {as === 'progress' && goal ? <span className="widgets-tile__progress" role="img" aria-label={`${Math.round(goal.share * 100)}%`}><span style={{ width: `${Math.min(1, goal.share) * 100}%` }} /></span> : null}
      {as === 'sparkline' && series?.length && spanOf(scales.all) ? <Line bars={series} label={label} scales={scales} spark /> : null}
      {note ? <span className="widgets-tile__note">{way ? <span className="widgets-tile__trend" aria-hidden="true">{way}</span> : null}{note}</span> : null}
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

/** The sign a notice is told apart by, beside the words that say why. */
const SIGNS = {
  // something went wrong: an exclamation mark in a ring
  error: <><circle cx="8" cy="8" r="6.25" /><path d="M8 4.75v3.75M8 11v.25" /></>,
  // not for this account: a lock
  denied: <><rect x="3.5" y="7.25" width="9" height="6.25" rx="1.5" /><path d="M5.5 7.25V5.5a2.5 2.5 0 0 1 5 0v1.75" /></>,
  // nothing chosen yet: the pencil it is set up with
  unset: <path d="M10.75 2.75l2.5 2.5L6 12.5H3.5V10z" />,
}

/**
 * A tile that only says something, for a figure that cannot be shown. `kind` says why, as `data-notice`, and draws a
 * sign for it: it went wrong (`error`), it is not for whoever looks (`denied`), or it is not set up yet (`unset`).
 */
export const Notice = ({ label, note, name, kind }: { label: string; note: string; name?: string; kind?: 'error' | 'denied' | 'unset' }) => (
  <div className="widgets-tile widgets-tile--plain" {...marks('notice', 'calm', name)} {...(kind ? { 'data-notice': kind } : {})}>
    <span className="widgets-tile__label">
      {kind ? <svg className="widgets-tile__sign" viewBox="0 0 16 16" aria-hidden="true" focusable="false">{SIGNS[kind]}</svg> : null}
      {label}
    </span>
    <span className="widgets-tile__note">{note}</span>
  </div>
)

/**
 * The first few of a list with a link to all of them, and where it makes sense a way to add one. `api` is Payload's
 * API route; `words` are what the link to a new one, the button of a quick add, its having added one and its failing
 * say, in the language of whoever looks.
 */
export const ListTile = ({ label, note, tone, href, rows, empty, add, quick, api, words, action, after, name }: ListContent & Slots & { api: string; words?: { add?: string; failed?: string; submit?: string; added?: string } & Toned }) => (
  <section className="widgets-tile widgets-tile--plain" {...marks('list', tone, name)}>
    <div className="widgets-tile__head">
      <Link href={href}>
        <span className="widgets-tile__label">{label}<Spoken tone={tone} words={words} /></span>
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
    {quick ? <QuickAdd api={api} slug={quick.slug} field={quick.field} data={quick.data} placeholder={quick.placeholder} failed={words?.failed ?? 'That could not be added.'} submit={words?.submit} added={words?.added} /> : null}
    {after}
  </section>
)

type Bars = ChartContent['bars']
type Many = NonNullable<ChartContent['series']>
type Point = { label: string; amount: number; shown: string }

/** What a chart is drawn against: from how far below nothing to how far above it. Of what is never below nothing, from nothing. */
type Scale = { lo: number; hi: number }
const scaleOf = (amounts: number[]): Scale => ({ lo: Math.min(0, ...amounts), hi: Math.max(0, ...amounts) })
const spanOf = ({ lo, hi }: Scale) => hi - lo
/** How far up (or along) an amount is, as a part of the whole. */
const fraction = (amount: number, scale: Scale) => (spanOf(scale) ? (amount - scale.lo) / spanOf(scale) : 0)
/** Where something drawn from one amount to another starts and how long it is, as parts of the whole: from nothing, up or down. */
const place = (from: number, to: number, scale: Scale) =>
  spanOf(scale) ? { start: (Math.min(from, to) - scale.lo) / spanOf(scale), size: Math.abs(to - from) / spanOf(scale) } : { start: 0, size: 0 }
const percent = (part: number) => `${part * 100}%`

/** Where each part of one bar that stands on the others runs from and to: what is above nothing on what is above it, what is below under it. */
const stackAt = (many: Many, index: number) => {
  let up = 0, down = 0
  return many.map(one => {
    const amount = one.bars[index]?.amount ?? 0
    if (amount >= 0) return [up, (up += amount)] as const
    return [down, (down += amount)] as const
  })
}

/**
 * What every series is drawn against. Of one, or where they stand on one another, one scale. Of several side by side,
 * one scale where they are read alike (they come with one peak), each its own otherwise: then they are not to be set
 * against one another, which is said under the legend.
 */
const scalesOf = (bars: Bars, many: Many | undefined, stacked: boolean | undefined) => {
  if (!many) {
    const all = scaleOf(bars.map(bar => bar.amount))
    return { all, shared: true, of: () => all }
  }
  if (stacked) {
    const ends = (many[0]?.bars ?? []).flatMap((_, index) => stackAt(many, index).flat())
    const all = scaleOf(ends)
    return { all, shared: true, of: () => all }
  }
  const own = many.map(one => scaleOf(one.bars.map(bar => bar.amount)))
  const all = { lo: Math.min(0, ...own.map(scale => scale.lo)), hi: Math.max(0, ...own.map(scale => scale.hi)) }
  const shared = many.every(one => one.peak === many[0].peak)
  return { all, shared, of: (at: number) => (shared ? all : own[at]) }
}
type Scales = ReturnType<typeof scalesOf>

/** The colour a series is drawn in: there are eight, and then they come round again. */
const hue = (index: number) => ({ 'data-series': (index % 8) + 1 })
/** What a bar says of each of its series, for whoever is led by it somewhere. */
const told = (label: string, many: Many, index: number) => `${label}: ${many.map(one => `${one.label} ${one.bars[index]?.shown || '0'}`).join(', ')}`
/** Whether they stand on one another or side by side, and whether anything goes below nothing, for a stylesheet. */
const arranged = (many: Many | undefined, stacked: boolean | undefined, scales: Scales) => ({
  ...(many ? { 'data-many': stacked ? 'stacked' : 'grouped' } : {}),
  // where each is drawn to its own scale, nothing is somewhere else for each, and is not marked
  ...(scales.all.lo < 0 && scales.shared ? { 'data-signed': '' } : {}),
})
/** A custom property, as React is handed one. */
const vars = (values: Record<string, string | number>) => values as React.CSSProperties

/** What each of the series comes to at one bar, or what the one bar comes to. */
const valuesAt = (bar: Point, many: Many | undefined, index: number) =>
  many ? many.map((one, at) => ({ key: one.key, series: one.label as string | undefined, shown: one.bars[index]?.shown || '0', at })) : [{ key: 'one', series: undefined, shown: bar.shown || '0', at: 0 }]

/** Which side of what it is over a tip opens to: the first third to the end, the last to the start, the rest over its middle. */
const alignOf = (index: number, count: number) => {
  const at = count > 1 ? index / (count - 1) : 0.5
  return at < 1 / 3 ? 'start' : at > 2 / 3 ? 'end' : 'center'
}

/** What one bar or point is and comes to, on the pointer and on focus. Not said to a screen reader: the table under the chart says it. */
const Tip = ({ bar, many, index, count }: { bar: Point; many?: Many; index: number; count: number }) => (
  <span className="widgets-tip" data-align={alignOf(index, count)} aria-hidden="true">
    <span className="widgets-tip__label">{bar.label}</span>
    {valuesAt(bar, many, index).map(value => (
      <span key={value.key} className="widgets-tip__value" {...(many ? hue(value.at) : {})}>
        {many ? <span className="widgets-tip__mark" /> : null}
        {value.series ? <span>{value.series}</span> : null}
        <span>{value.shown}</span>
      </span>
    ))}
  </span>
)

/**
 * Everything a chart shows, as a table only a screen reader is told: named by the chart, a row for each bar, a column
 * for each series. Bars one to a row say it in words besides.
 */
const Table = ({ label, bars, many }: { label: string; bars: Bars; many?: Many }) => (
  <table className="widgets-hidden">
    <caption>{label}</caption>
    <thead>
      <tr>
        <td />
        {many ? many.map(one => <th key={one.key} scope="col">{one.label}</th>) : <th scope="col">{label}</th>}
      </tr>
    </thead>
    <tbody>
      {bars.map((bar, index) => (
        <tr key={index}>
          <th scope="row">{bar.label}</th>
          {valuesAt(bar, many, index).map(value => <td key={value.key}>{value.shown}</td>)}
        </tr>
      ))}
    </tbody>
  </table>
)

/** What the amount a chart is drawn up to is shown as: the bar that comes to it says it in its own way. */
const shownAt = (amount: number, bars: Bars, many: Many | undefined) =>
  [...bars, ...(many ?? []).flatMap(one => one.bars)].find(bar => bar.amount === amount)?.shown

/**
 * How much the top of columns or a line is, and where nothing is, named beside them (and the bottom, where it goes
 * below nothing). Where the series are each drawn to their own scale no one amount is the top, and nothing is named.
 * `at` turns a part of the whole into how far up the plot it is.
 */
const Scaled = ({ bars, many, scales, at, children }: { bars: Bars; many?: Many; scales: Scales; at: (part: number) => number; children: ReactNode }) => {
  const { lo, hi } = scales.all
  const zero = fraction(0, scales.all)
  const ticks = !scales.shared ? [] : [
    ...(hi > 0 ? [{ kind: 'top', said: shownAt(hi, bars, many), part: 1 }] : []),
    // nothing is not named where it is next to an end that is
    ...((hi > 0 && zero > 0.85) || (lo < 0 && zero < 0.15) ? [] : [{ kind: 'zero', said: '0', part: zero }]),
    ...(lo < 0 ? [{ kind: 'bottom', said: shownAt(lo, bars, many), part: 0 }] : []),
  ].filter((tick): tick is { kind: string; said: string; part: number } => !!tick.said)
  const widest = Math.max(0, ...ticks.map(tick => tick.said.length))
  return (
    <div className="widgets-scale" {...(ticks.length ? { 'data-ticks': '', style: vars({ '--widgets-gutter': widest }) } : {})}>
      {ticks.map(tick => (
        <span key={tick.kind} className="widgets-scale__tick" data-tick={tick.kind} aria-hidden="true" style={vars({ '--widgets-at': at(tick.part) })}>
          <span>{tick.said}</span>
        </span>
      ))}
      {children}
    </div>
  )
}

/** One to a row: what it is, how long, how much. */
const Rows = ({ bars, many, stacked, scales }: { bars: Bars; many?: Many; stacked?: boolean; scales: Scales }) => {
  const zero = { '--widgets-zero': fraction(0, scales.all) }
  const along = (from: number, to: number, scale: Scale, at?: number) => {
    const { start, size } = place(from, to, scale)
    return { ...(at === undefined ? {} : hue(at)), style: { insetInlineStart: percent(start), width: percent(size) } }
  }
  return (
    <ul className="widgets-chart" {...arranged(many, stacked, scales)} style={vars(zero)}>
      {bars.map((bar, index) => {
        const inside = (
          <>
            <span className="widgets-chart__label">{bar.label}</span>
            {many && !stacked
              ? <span className="widgets-chart__bars" aria-hidden="true">{many.map((one, at) => <span key={one.key} className="widgets-chart__bar"><span {...along(0, one.bars[index]?.amount ?? 0, scales.of(at), at)} /></span>)}</span>
              : <span className="widgets-chart__bar" aria-hidden="true">
                {many ? stackAt(many, index).map(([from, to], at) => <span key={many[at].key} {...along(from, to, scales.all, at)} />) : <span {...along(0, bar.amount, scales.all)} />}
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

/**
 * Side by side: how tall each is, with what it is under it and how much in a tip. Only those that lead somewhere can
 * be tabbed to; what the rest say is in the table under the chart.
 */
const Columns = ({ bars, many, stacked, scales }: { bars: Bars; many?: Many; stacked?: boolean; scales: Scales }) => {
  const step = every(bars.length)
  const up = (from: number, to: number, scale: Scale, at?: number, of?: number) => {
    const { start, size } = place(from, to, scale)
    // several side by side share the column, a pixel apart
    const beside = of && at !== undefined && !stacked ? { insetInlineStart: `calc((100% + 1px) * ${at / of})`, width: `calc((100% - ${of - 1}px) / ${of})` } : {}
    return { ...(at === undefined ? {} : hue(at)), ...(Math.min(from, to) < 0 ? { 'data-below': '' } : {}), style: { insetBlockEnd: percent(start), height: percent(size), ...beside } }
  }
  return (
    <ol className="widgets-columns" {...arranged(many, stacked, scales)} style={vars({ '--widgets-zero': fraction(0, scales.all) })}>
      {bars.map((bar, index) => {
        const inside = (
          <>
            <span className="widgets-columns__bar" aria-hidden="true">
              {!many ? <span {...up(0, bar.amount, scales.all)} />
                : stacked ? stackAt(many, index).map(([from, to], at) => <span key={many[at].key} {...up(from, to, scales.all, at)} />)
                  : many.map((one, at) => <span key={one.key} {...up(0, one.bars[index]?.amount ?? 0, scales.of(at), at, many.length)} />)}
            </span>
            {/* it has the room of the columns up to the next one that is named */}
            <span className="widgets-columns__label" aria-hidden="true" style={{ maxWidth: `${Math.min(step, bars.length - index) * 100}%` }}>{index % step ? '' : bar.label}</span>
            <Tip bar={bar} many={many} index={index} count={bars.length} />
          </>
        )
        // a link is named by what it is and how much; the rest is in the table
        return <li key={index}>{bar.href ? <Link href={bar.href} aria-label={many ? told(bar.label, many, index) : `${bar.label}: ${bar.shown || '0'}`}>{inside}</Link> : <div>{inside}</div>}</li>
      })}
    </ol>
  )
}

const HEIGHT = 40
/** How far up the plot of a line a part of its scale is: it is drawn a unit inside the top and the bottom, so a stroke is never cut. */
const lifted = (part: number) => (1 + part * (HEIGHT - 2)) / HEIGHT

/**
 * One line through all of them, with where it starts, its middle and where it ends named under it. Of several, a
 * line each. Every point has a tip over the room up to half way to the ones beside it; those that lead somewhere are
 * links, and only they can be tabbed to.
 */
const Line = ({ bars, label, spark, many, scales }: { bars: Bars; label: string; spark?: boolean; many?: Many; scales: Scales }) => {
  const x = (index: number, count: number) => (count > 1 ? (index / (count - 1)) * 100 : 50)
  const y = (amount: number, scale: Scale) => HEIGHT - 1 - fraction(amount, scale) * (HEIGHT - 2)
  const through = (of: { amount: number }[], scale: Scale) => of.map((bar, index) => `${x(index, of.length)},${y(bar.amount, scale).toFixed(2)}`).join(' ')
  const named = [...new Set([0, Math.floor((bars.length - 1) / 2), bars.length - 1])]
  // nothing, where the line goes below it; the foot of the plot otherwise, as it always was
  const floor = scales.all.lo < 0 ? y(0, scales.all) : HEIGHT
  const last = Math.max(1, bars.length - 1)
  const room = (index: number) => {
    if (bars.length === 1) return { start: 0, end: 1 }
    return { start: Math.max(0, (index - 0.5) / last), end: Math.min(1, (index + 0.5) / last) }
  }
  const plot = (
    <span className="widgets-line__plot">
      <svg viewBox={`0 0 100 ${HEIGHT}`} preserveAspectRatio="none" {...(spark ? { role: 'img', 'aria-label': `${label}: ${bars.map(bar => `${bar.label} ${bar.shown || '0'}`).join(', ')}` } : { 'aria-hidden': true })}>
        {scales.all.lo < 0 && scales.shared ? <line className="widgets-line__zero" x1="0" x2="100" y1={floor.toFixed(2)} y2={floor.toFixed(2)} /> : null}
        {many ? many.map((one, at) => <polyline key={one.key} className="widgets-line__stroke" {...hue(at)} points={through(one.bars, scales.of(at))} />) : (
          <>
            <polygon className="widgets-line__area" points={`0,${floor.toFixed(2)} ${through(bars, scales.all)} 100,${floor.toFixed(2)}`} />
            <polyline className="widgets-line__stroke" points={through(bars, scales.all)} />
          </>
        )}
      </svg>
      {/* under a figure the tile itself is the link, and what it was is said in the svg */}
      {spark ? null : bars.map((bar, index) => {
        const { start, end } = room(index)
        const inside = (
          <>
            {(many ?? [{ key: 'one', bars }]).map((one, at) => (
              <span
                key={one.key} className="widgets-line__dot" {...hue(at)} aria-hidden="true"
                style={{ left: percent((x(index, bars.length) / 100 - start) / (end - start || 1)), bottom: percent(lifted(fraction(one.bars[index]?.amount ?? 0, scales.of(at)))) }}
              />
            ))}
            <Tip bar={bar} many={many} index={index} count={bars.length} />
          </>
        )
        const zone = { left: percent(start), width: percent(end - start) }
        return bar.href
          ? <Link key={index} href={bar.href} className="widgets-line__point" style={zone} aria-label={many ? told(bar.label, many, index) : `${bar.label}: ${bar.shown || '0'}`}>{inside}</Link>
          : <span key={index} className="widgets-line__point" style={zone}>{inside}</span>
      })}
    </span>
  )
  return (
    <span className={spark ? 'widgets-line widgets-line--spark' : 'widgets-line'} {...(scales.all.lo < 0 ? { 'data-signed': '' } : {})}>
      {plot}
      {spark ? null : <span className="widgets-line__labels" aria-hidden="true">{named.map(index => <span key={index}>{bars[index].label}</span>)}</span>}
    </span>
  )
}

/** Which colour is which, and what each comes to; where each is drawn to its own scale, that it is. */
const Legend = ({ many, apart }: { many: Many; apart?: string }) => (
  <>
    <ul className="widgets-legend">
      {many.map((one, at) => (
        <li key={one.key} {...hue(at)}>
          <span className="widgets-legend__mark" aria-hidden="true" />
          <span>{one.label}</span>
          <span className="widgets-legend__total">{one.total}</span>
        </li>
      ))}
    </ul>
    {apart ? <span className="widgets-legend__note">{apart}</span> : null}
  </>
)

/**
 * A measure over time or by group: bars one to a row unless it is asked for as columns or as a line. Several
 * measures, or one told apart by a second group, are drawn each in its own colour and named under the head. What
 * goes below nothing is drawn down from it. `words` are what it says in the language of whoever looks.
 */
export const ChartTile = ({ label, note, href, bars, empty, series, stacked, action, after, name, as = 'bars', words }: ChartContent & Slots & {
  as?: 'bars' | 'columns' | 'line'
  /** `apart`: said under the legend where the series are each drawn to their own scale. */
  words?: { apart?: string }
}) => {
  const many = series?.length ? series : undefined
  const scales = scalesOf(bars, many, stacked)
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
      {!bars.length || !spanOf(scales.all) ? <span className="widgets-tile__note">{empty}</span> : (
        <>
          {many ? <Legend many={many} apart={scales.shared ? undefined : words?.apart ?? 'Each series is drawn to its own scale'} /> : null}
          {as === 'columns' ? <Scaled bars={bars} many={many} scales={scales} at={part => part}><Columns bars={bars} many={many} stacked={stacked} scales={scales} /></Scaled>
            : as === 'line' ? <Scaled bars={bars} many={many} scales={scales} at={lifted}><Line bars={bars} label={label} many={many} scales={scales} /></Scaled>
              : <Rows bars={bars} many={many} stacked={stacked} scales={scales} />}
          {as === 'bars' && !many ? null : <Table label={label} bars={bars} many={many} />}
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
