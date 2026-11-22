# Drawing it your own way

Three steps, each further from the tiles. The data without any tile is on
[its own page](./headless.md#the-data-alone).

- [A view](#a-view)
- [A widget that is all your own](#a-widget-that-is-all-your-own)
- [The context](#the-context)
- [The advanced entry](#the-advanced-entry)

## A view

A view is a component of your own for one of the three kinds. It is offered under "Drawn as" in the drawer, and
asked for with `as`:

```ts
widgetsPlugin({
  views: { donut: { kind: 'chart', label: 'A donut', Component: 'src/components/Donut.tsx#Donut' } },
  widgets: [chart('by-status', 'tasks', { label: 'Tasks by status', by: 'status', as: 'donut' })],
})
```

```tsx
import type { ChartViewProps } from 'payload-plugin-widgets/rsc'

export const Donut = ({ label, note, bars, href }: ChartViewProps) => (
  <section className="widgets-tile widgets-tile--plain">
    <span className="widgets-tile__label">{label}</span>
    {/* bars: { label, amount, shown, href? }[] */}
  </section>
)
```

It is handed what the tile would be made of, with `req`, `view` (the name it was asked for by), `action`, `after`
and `name`:

| | |
| --- | --- |
| `FigureViewProps` | `label, value, note, tone, href, trend, previous, goal { value, amount, share }, series [{ label, amount, shown }]` |
| `ListViewProps` | `label, note, tone, href, rows [{ title, detail, href, late }], empty, add, quick, api, words { add, failed, submit, added }` |
| `ChartViewProps` | `label, note, href, empty, bars [{ label, amount, shown, href }]`, and where there are several: `series [{ key, label, total, peak, bars }], stacked` |

`words` of a list are what its quick-add box says, in the viewer's language: the button, what is said where adding
failed, the label of the submit button, and what is said once it is added.

Run `payload generate:importmap` after adding one.

**A view may be a client component.** All it is handed is plain data, so `'use client'` at the top is enough for
one that reacts to the pointer, or that draws with a library made for the browser. `req` is given to a server
component only, so a client one leaves it out of its props: `Omit<ChartViewProps, 'req'>`.

**With a chart library.** Recharts here; any other goes the same way. `bars` is one row for each bar, and
`series` (where the chart has several) has a bar for each of those rows:

```ts
views: { area: { kind: 'chart', label: 'An area chart', Component: 'src/components/AreaView.tsx#AreaView' } },
widgets: [chart('revenue-by-status', 'orders', { label: 'Revenue', measure: 'total', by: 'time', series: 'status', as: 'area' })],
```

```tsx
'use client'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import type { ChartViewProps } from 'payload-plugin-widgets/rsc'

export const AreaView = ({ label, note, name, view, bars, series }: Omit<ChartViewProps, 'req'>) => {
  // one series where the chart has only the one
  const lines = series ?? [{ key: 'all', label, bars }]
  // [{ label: 'Nov 25', at: 0, shipped: 2140.5, paid: 980 }, …]
  const rows = bars.map((bar, at) => ({ label: bar.label, at, ...Object.fromEntries(lines.map(line => [line.key, line.bars[at].amount])) }))
  // what a hovered point says: the amount as the plugin words it, in the viewer's language and currency
  const worded = (key: unknown, at: number) => lines.find(line => line.key === key)?.bars[at]?.shown
  return (
    <section className="widgets-tile widgets-tile--plain" data-widget={name} data-view={view}>
      <div className="widgets-tile__head">
        <span className="widgets-tile__label">{label}</span>
        <span className="widgets-tile__note">{note}</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={rows}>
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <Tooltip formatter={(value, called, item) => [worded(item.dataKey, item.payload.at) ?? String(value), called]} />
          {lines.map((line, index) => (
            <Area key={line.key} dataKey={line.key} name={line.label} stackId="all" stroke={`var(--widgets-series-${index + 1})`} fill={`var(--widgets-series-${index + 1})`} fillOpacity={0.2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </section>
  )
}
```

The tile's own classes keep it looking like the others. The numbers are already:

- read with the viewer's access,
- narrowed by the widget's filter and period,
- worded (`shown`) the way the other tiles word them.

`--widgets-series-1` to `--widgets-series-8` always have a colour in 0.6, so they need no fallback.

## A widget that is all your own

Any server component can be one. It is given a place in the starting layout, a label in every language and its
`access`, like the rest:

```ts
import type { Access } from 'payload'
import { widget } from 'payload-plugin-widgets'

const admins: Access = ({ req }) => Boolean(req.user?.roles?.includes('admin'))

widget('shortcuts', { label: { en: 'Shortcuts', de: 'Verknüpfungen' }, Component: 'src/components/Shortcuts.tsx#Shortcuts', access: admins, size: 'wide' })
```

```tsx
import { gated, NoteTile } from 'payload-plugin-widgets/rsc'

export const Shortcuts = gated(async ({ req, widgetData }) => (
  <NoteTile label="Shortcuts" text="Everything you need is one click away." link={{ href: '/admin/collections/orders', label: 'Orders' }} />
))
```

- `gated` keeps it to whoever its `access` says it is for.
- `size` is `'tile'` (as small as a figure) or `'wide'`.
- `fields` and `data` give it settings of its own, read from `widgetData`.
- `home` says who starts with it, as for a ready-made widget.

The tiles themselves are exported too, to draw your own data the way the plugin draws its own: `Tile`, `ListTile`,
`ChartTile`, `NoteTile` and `Notice`.

## The context

This is what a filter's function, a measure's `read` and a list's `row` are handed. The type is `Context`.

| | |
| --- | --- |
| `payload` | |
| `req` | the request it is all read for |
| `as` | `{ depth: 0, overrideAccess, user, req, locale }`: spread it into a read to make it as the signed-in user, with their request and locale, or with the server's access where the widget asked for [`overrideAccess`](./user-widgets-and-access.md#a-total-of-what-somebody-may-not-open) |
| `sources`, `mayRead(source)` | every source by name, and whether one is for the person looking |
| `today`, `dayStart`, `monthStart`, `yearStart` | today as `YYYY-MM-DD`, and the instants those start at, in the time zone given |
| `date(instant)`, `instant(day)` | the day an instant falls on there, and the instant a day starts at |
| `currency`, `weekStartsOn`, `zone` | as the options have them |
| `sums`, `cache`, `limits` | as the options have them |
| `data` | what the widget was set up with; under `overrideAccess`, only its `trusted` settings as they were saved |
| `list(slug, where?)`, `edit(slug, id)` | links into the admin |
| `t(text, vars?)`, `plural(count, one, many)` | in the language of the request; `t` takes a `Label` as well |
| `number`, `hours(minutes)`, `money(amount, currency)`, `total(perCurrency)`, `day(date)`, `month(date)` | written as that language writes them |

## The advanced entry

`payload-plugin-widgets/advanced` holds what a source written by hand may need, beyond the root. It is less settled
than the root and may change in a minor version:

| | |
| --- | --- |
| `Selection` | the records a widget is about, as alternatives of conditions that all hold; `.and(…)` narrows it |
| `worded`, `labelled`, `nameOf`, `amountOf`, `shown`, `added`, `CALCS` | the pieces `count`, `sum` and `rows` are made of |
| `combined`, `counted`, `fetched`, `currencyOf`, `MANY` | how records are read and added up; `MANY` is the default of `limits.records` |
| `coded`, `inWords`, `problemsOf`, `Said` | [problems](./errors.md#in-code-of-your-own) |
| `isMoment` | whether a text is a [moment](./where-and-dates.md#moments) |

The root has `anyOf(…)` and `selected(…)` to make a `Selection`, and the type `Selection` itself.
