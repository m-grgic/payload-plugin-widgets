# payload-plugin-widgets

[![npm version](https://img.shields.io/npm/v/payload-plugin-widgets)](https://www.npmjs.com/package/payload-plugin-widgets)
[![npm downloads](https://img.shields.io/npm/dm/payload-plugin-widgets)](https://www.npmjs.com/package/payload-plugin-widgets)
[![CI](https://img.shields.io/github/actions/workflow/status/m-grgic/payload-plugin-widgets/ci.yml?branch=main&label=CI)](https://github.com/m-grgic/payload-plugin-widgets/actions/workflows/ci.yml)
[![Licence: MIT](https://img.shields.io/npm/l/payload-plugin-widgets?label=licence)](https://github.com/m-grgic/payload-plugin-widgets/blob/main/LICENSE)

A [Payload CMS](https://payloadcms.com) plugin for dashboard widgets that read from your collections: **KPI figures,
lists and charts**. Add the plugin and every collection can be put on the admin dashboard; whoever is signed in sets
a widget up in a drawer, a project puts some there ready-made, and the same three can stand on any other page of
the admin.

```sh
pnpm add payload-plugin-widgets   # or npm install, or yarn add
```

![A Payload admin dashboard of KPI figures, charts and a list](https://raw.githubusercontent.com/m-grgic/payload-plugin-widgets/main/docs/dashboard.png)

- **Nothing to declare.** Every collection is a source as its fields describe it: how many there are, a sum for
  each number, a group for each select, checkbox and relationship, a list of the latest.
- **Set up by whoever is looking.** "A figure", "A list" and "A chart" are added in the dashboard's edit mode and
  filtered with the admin's own filter builder.
- **Or by the config.** `figure(…)`, `list(…)` and `chart(…)` put widgets there ready-made. They are typed against
  your generated types and checked as the config is built, with a "did you mean" where a name is off.
- **With whoever's access.** Every read is made as the signed-in user, so access control always applies; `access`
  functions, written as Payload's own are, say who else a widget is not for.
- **No script draws anything.** The tiles are server components and plain CSS that follow the admin's theme, light
  and dark. No chart library is shipped to the browser.
- **Yours to take apart.** Views of your own, the data without the tiles, widgets that are all your own, and a
  stylesheet made to be overridden.

## Contents

- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [Setting a widget up on the dashboard](#setting-a-widget-up-on-the-dashboard)
- [Ready-made widgets](#ready-made-widgets)
  - [Figures](#figures) · [Lists](#lists) · [Charts](#charts) · [What all three take](#what-all-three-take)
  - [Filters, periods and moments](#filters-periods-and-moments)
  - [When something is not there](#when-something-is-not-there)
- [Sources](#sources)
  - [What is found by itself](#what-is-found-by-itself) · [Hints on a collection or a field](#hints-on-a-collection-or-a-field) · [Declaring a source](#declaring-a-source)
- [On any other page](#on-any-other-page)
- [Drawing it your own way](#drawing-it-your-own-way)
- [Who sees what](#who-sees-what)
- [Languages, time and numbers](#languages-time-and-numbers)
- [Styling](#styling)
- [Reference](#reference)
- [Formulas](#formulas)
- [Where the adding is done](#where-the-adding-is-done)
- [Limits](#limits)
- [Troubleshooting](#troubleshooting)
- [The demo](#the-demo)
- [Working on it](#working-on-it)
- [Licence](#licence)

## Requirements

| | |
| --- | --- |
| Payload | 3.90 or later (the modular dashboard) |
| Next.js | what your Payload supports; developed on 16.3 |
| React | 19 |
| Node | 18.20.2, or 20.9 and later |
| Database | any Payload adapter |

Developed and tested with Payload 3.90.2, Next.js 16.3.8 and React 19.3 on Postgres. Next.js 15 is allowed by the
peer range as Payload allows it, and has not been tried.

## Install

```sh
pnpm add payload-plugin-widgets
```

```ts
// payload.config.ts
import { buildConfig } from 'payload'
import { widgetsPlugin } from 'payload-plugin-widgets'

export default buildConfig({
  // …
  plugins: [widgetsPlugin()],
})
```

Then write the import map again, as after adding any plugin that brings components:

```sh
pnpm payload generate:importmap
```

That is all. There is no stylesheet to add and no route to mount: the components bring their styles, and
everything is read on the server.

Put the plugin **after the plugins that add collections**. It runs with `order: 100`, so plugins that leave their
order open come first anyway; a collection that is added later still is named in a warning when Payload starts.

## Quick start

With nothing but `widgetsPlugin()`, open the dashboard, choose **Edit Dashboard** from the menu beside its name,
and add "A figure", "A list" or "A chart". The pencil on a widget opens its drawer.

To have a dashboard that starts with something on it:

```ts
import { chart, figure, list, widgetsPlugin } from 'payload-plugin-widgets'

widgetsPlugin({
  currency: 'EUR',
  timeZone: 'Europe/Zagreb',
  sources: { media: false },
  widgets: [
    figure('open-tasks', 'tasks', { label: 'Open tasks', where: { status: { not_equals: 'done' } } }),
    figure('overdue', 'tasks', { label: 'Overdue', where: { dueDate: { less_than: 'today' } } }),
    figure('sold', 'orders', { label: 'Sold this month', measure: 'total', period: 'month', compare: 'previous' }),
    chart('orders-by-month', 'orders', { label: 'Orders', measure: 'total', by: 'time', period: 'last12', as: 'columns' }),
    list('latest-orders', 'orders', { label: 'Latest orders', limit: 5 }),
  ],
})
```

The collection slugs, the field names in `where`, `measure`, `by` and `date` are all offered and checked by the
editor from your `payload-types.ts`.

## Setting a widget up on the dashboard

![Setting a figure up in its drawer](https://raw.githubusercontent.com/m-grgic/payload-plugin-widgets/main/docs/setup.gif)

Anybody signed in can add the three widgets to their own dashboard and say what each shows. What they pick from is
what they may read: a source that is not for them is not offered.

<img src="https://raw.githubusercontent.com/m-grgic/payload-plugin-widgets/main/docs/drawer.png" alt="The drawer of a figure" width="520">

| In the drawer | For | What it says |
| --- | --- | --- |
| Title | all | What the tile is called. Empty, it is named after what it shows ("Orders · Sold · Revenue"). |
| Of what | all | The source: a collection, or one the project declared. |
| Which ones | all | One of the source's filters, where it declares any. |
| Only those where | all | Payload's own filter builder, over the collection's fields. On top of "Which ones". |
| What about them | figure, chart | The measure. Empty is how many there are. |
| Worked out as | figure, chart | Added up, the average, the lowest or the highest: for a measure that is a number field. |
| Period | figure, chart | Any time, today, before today, from today on, this month, this year, the last 30 days, the last 12 months, or between two dates. |
| Going by | figure, chart | Which date the period goes by, where the source has more than one. |
| From, Until | figure, chart | The two dates of "Between two dates". Either may be left open. |
| Compared with | figure | The period before. |
| Goal | figure | What the figure is set against. |
| Drawn as | all | A number, progress or a sparkline; bars, columns or a line; and any view the project added. |
| Line under it | figure | What the note says, in place of the usual. |
| Which list | list | One of the source's lists. |
| How many rows | list | |
| Split by | chart | Time, or one of the source's groups. |

A click on a figure or on a bar leads to the collection's list view, filtered to exactly the records it counted.

Payload keeps each person's layout as their own preference. The ready-made widgets are what a dashboard starts with
and what "Reset Layout" goes back to.

## Ready-made widgets

`widgets` in the options is the dashboard everybody starts with, in the order given: figures first in a row of
small tiles, then lists and charts side by side, then Payload's own list of collections.

Each is made by a function that takes a **slug** of its own (what Payload keeps it by, and `data-widget` in a
stylesheet), a **source** (a collection's slug, or a [declared source](#declaring-a-source)), and what it shows.

### Figures

![A figure as a number, as progress and over a sparkline](https://raw.githubusercontent.com/m-grgic/payload-plugin-widgets/main/docs/figures.png)

```ts
figure('sold', 'orders', {
  label: 'Sold this month',
  measure: 'total',        // a number field (its sum), or { sum | avg | min | max: 'field' }; left out: how many
  period: 'month',
  compare: 'previous',     // also read for the period before
  goal: 5000,              // what it is set against
  as: 'progress',          // or 'sparkline'; left out: the number alone
  note: '{change} on last month · {left} to go',
})
```

| Option | | |
| --- | --- | --- |
| `measure` | `string \| { sum \| avg \| min \| max: field or formula, format?, currency? }` | How many there are where it is left out. A number field by name is added up. Of a declared source, one of its measures by name. |
| `compare` | `'previous'` | Also read for the period before. Needs a period that has a beginning: not `all`, `past` or `upcoming`, and `custom` only with a `from`. |
| `goal` | `number` | What the figure is set against, in what the measure counts. |
| `as` | `'number' \| 'progress' \| 'sparkline'` or a view of your own | `progress` draws how far towards the goal it is, and needs one; `sparkline` what it was over the period. |
| `note` | `string` | The line under the number, in place of the usual one. |
| `fields`, `data` | `Field[]`, `object` | Settings of the widget's own in its drawer, and what they start as. A measure reads them from `context.data`. |

Without a `note` a figure says the usual of what it was given: "+12% on the period before · 60% of €5,000.00". A
note can use:

| | |
| --- | --- |
| `{value}` | the figure as it is shown |
| `{note}` | what the line would have said |
| `{previous}`, `{change}` | with `compare`: what it was then, and by how much it changed ("+12%") |
| `{goal}`, `{percent}`, `{left}` | with a goal: the goal, how much of it this is, and how much is missing |

A month or a year to date is compared with the same days of the one before; any other period with the one that is
as long and ends where it starts.

### Lists

```ts
list('latest-orders', 'orders', { label: 'Latest orders', limit: 5 })
list('my-tasks', tasks, { label: 'My tasks', list: 'mine', filter: 'open' })
```

| Option | | |
| --- | --- | --- |
| `list` | `string` | One of the source's lists. Of a collection by its slug there is one, `latest`, and it can be left out. |
| `limit` | `number` | How many rows. |
| `filter`, `where` | | As below. A list has no period. |
| `as` | a view of your own | A list is drawn as rows unless a [view](#a-view) draws it otherwise. |

Every row leads to its document; the head of the tile to the whole list. A declared list can say which rows are
late, offer a link to a new document and a box that adds one by its title.

### Charts

![The same chart as bars, as columns and as a line](https://raw.githubusercontent.com/m-grgic/payload-plugin-widgets/main/docs/charts.png)

```ts
chart('revenue-by-month', 'orders', { label: 'Revenue by month', measure: 'total', by: 'time', period: 'last12', as: 'columns' })
chart('orders-by-status', 'orders', { label: 'Orders by status', by: 'status', period: 'year' })
```

| Option | | |
| --- | --- | --- |
| `measure` | as of a figure, or several | What is drawn. How many there are where it is left out. Several are a series each: `['revenue', 'count']`. |
| `by` | `'time'` or a group | Over time, or split by a select, a checkbox or a relationship of the collection. A select gives the labels of its options, a relationship the titles of what it points at. |
| `series` | a group | A series for each of what is in another field: every bar told apart by it. The five there is most of, and the rest as one. |
| `as` | `'bars' \| 'columns' \| 'line'` or a view of your own | Bars one to a row where it is left out. |

Over time, a chart is drawn by day up to two months and by month beyond. Each bar leads to the records it is made of.

**Several series.** A chart tells apart either what is in a second field or several measures, each in a colour
of its own (`--widgets-series-1` to `-6`) and named above it with what it comes to:

![Columns stacked by status, and two measures as two lines](https://raw.githubusercontent.com/m-grgic/payload-plugin-widgets/main/docs/series.png)

```ts
chart('revenue-by-status', 'orders', { label: 'Orders by month and status', measure: 'total', by: 'time', series: 'status', period: 'last12', as: 'columns' })
chart('revenue-and-orders', 'orders', { label: 'Revenue and orders', measure: ['total', 'count'], by: 'time', period: 'last12', as: 'line' })
```

What adds up is stacked: the series of a field, where the measure is a sum or a count. Anything else stands side
by side: an average of each, or measures of different kinds, which are each drawn against their own highest so
that euros and a count can share a chart.

### What all three take

| Option | | |
| --- | --- | --- |
| `label` | `string` | Required. In English; [`i18n`](#languages-time-and-numbers) says it in the admin's other languages. |
| `filter` | `string` | One of a declared source's filters. |
| `where` | `Where` | Which records, as Payload filters them anywhere. On top of `filter`. |
| `period` | see below | Which records by date. Figures and charts. |
| `date` | field name | The date the period goes by; the source's own where it is left out. |
| `from`, `to` | `'YYYY-MM-DD'` | The first and the last day of `period: 'custom'`. Either may be left out. |
| `access` | `Access` | [Who the widget is for](#who-sees-what), as Payload asks it of a collection: `({ req }) => boolean \| Where`. Whoever its source is for where it is left out. |
| `overrideAccess` | `boolean` | Figures and charts: [read with the server's access](#a-total-of-what-somebody-may-not-open) in place of the person's own. Needs an `access`. |
| `home` | `boolean \| Access` | Who *starts with it* on their dashboard, where that is fewer than it is for. `false` is nobody: it is then only there to be added. |
| `action` | `{ label, href }` | A link of your own in the head of the tile. |
| `after` | component path | Something of your own drawn under what the widget shows (`'src/components/Hint.tsx#Hint'`). It is handed `req`, `widgetSlug` and `widgetData`. |

### Filters, periods and moments

`where` is a filter as Payload takes them anywhere, `and` and `or` included:

```ts
where: { or: [{ status: { equals: 'paid' } }, { and: [{ status: { equals: 'shipped' } }, { total: { greater_than: 100 } }] }] }
```

A date can be compared with a **moment** in place of a date that would stand still, so "due before today" is still
true tomorrow:

```ts
where: { dueDate: { less_than: 'today' } }                        // overdue
where: { createdAt: { greater_than_equal: 'startOfMonth-1m' } }   // since the start of last month
where: { dueDate: { less_than: 'now+7d' } }                       // due within a week
```

| Moment | |
| --- | --- |
| `now` | this instant |
| `today`, `tomorrow`, `yesterday` | the start of that day |
| `startOfWeek`, `startOfMonth`, `startOfYear` | the start of the one that is now |
| any of them `+` or `-` a count and `d`, `w`, `m` or `y` | moved by days, weeks, months or years: `today+7d`, `startOfYear-1y` |

A day starts where the `timeZone` option says, a week on the day `weekStartsOn` says.

| `period` | |
| --- | --- |
| `all` | any time (the default) |
| `today` | |
| `past` | before today |
| `upcoming` | from today on |
| `month`, `year` | this month or this year, to date |
| `last30`, `last12` | the last 30 days, the last 12 months |
| `custom` | between `from` and `to` |

### When something is not there

![Tiles that say what they were set up with is not there](https://raw.githubusercontent.com/m-grgic/payload-plugin-widgets/main/docs/notices.png)

A source, a filter, a measure or a view that is not there **stops the config from being built**, and says what was
probably meant:

```
widgetsPlugin: a widget is set up with what is not there
  - "by-status": orders has no group called "stauts". Did you mean "status"?
```

A field that is not there, in a `where`, a `date` or a measure, is only known once Payload has settled the
collections: it is logged as an error when Payload starts, and the tile says the same in place of its figure. So
does a widget somebody set up themselves after the config changed under it. Nothing else on the page breaks.

Most of this never gets that far: with `payload-types.ts` generated, a misspelt name does not compile.

## Sources

A **source** is a collection as the widgets see it: which of its records are worth looking at (filters), what can
be told about a set of them (measures), short lists, and what it can be split by (groups).

```ts
widgetsPlugin({
  sources: {
    media: false,         // not a source
    'audit-log': false,
    invoices,             // declared, see below
  },
  discover: false,        // only the declared ones; every collection where it is left out
})
```

### What is found by itself

From a collection's fields alone, the plugin makes:

| From | Comes |
| --- | --- |
| the collection | a measure of how many there are (`count`), and a list of the latest |
| each `number` field that holds one number | a measure that can be added up, averaged, or its lowest or highest taken |
| each `select`, `radio` and `checkbox`, and each `relationship` and `upload` to one collection | a group a chart can be split by |
| each `relationship` and `upload` to one collection | a scope: how to narrow it to one of what it points at |
| each `date` field, `createdAt` and `updatedAt` | a date a period can go by; `createdAt` unless said otherwise |
| the collection's labels and `useAsTitle` | what it and its rows are called |

Fields inside rows, collapsibles, unnamed tabs and unnamed groups are seen through. Those inside a named group, a
named tab or the rows of an array are found under their path, and called after both: `totals.net` is "Totals: Net",
`items.price` is "Items: Price". A date and a scope are only ever the record's own, not its rows'. Virtual fields
and fields the admin hides are left out. A collection that keeps drafts is read as the admin lists it: the latest version of each.

### Hints on a collection or a field

Under `custom.widgets`, a collection or a field says what it is to the widgets:

```ts
{
  slug: 'orders',
  custom: { widgets: { label: 'Orders', date: 'placedAt', access: ({ req }) => req.user?.role === 'admin' } },
  fields: [
    { name: 'total', type: 'number', custom: { widgets: { format: 'money', currency: 'currency' } } },
    { name: 'estimate', type: 'number', custom: { widgets: { format: 'hours' } } },
    { name: 'internalScore', type: 'number', custom: { widgets: false } },
  ],
}
```

| On a collection | |
| --- | --- |
| `false` | not a source at all (`sources: { slug: true }` in the options brings it back) |
| `label` | what it is called, where that is not the collection's own label |
| `date` | the date its periods go by |
| `access` | [who it is for](#who-sees-what), where that is fewer than may read it |

| On a field | |
| --- | --- |
| `false` | left out |
| `format` | `'number'`, `'money'` or `'hours'`. **Hours are kept in minutes.** |
| `currency` | where it is money: the name of the field that holds a record's currency |

### Declaring a source

What cannot be found is declared. The names a widget picks from a declared source are part of its type, so one
that is not there does not compile.

```ts
import { chart, figure, source, widgetsPlugin } from 'payload-plugin-widgets'

const invoices = source('invoices', {
  label: 'Invoices',
  access: ({ req }) => req.user?.role === 'admin',
  date: 'issuedAt',
  filters: {
    unpaid: { where: { paid: { equals: false } } },
    overdue: { label: 'Overdue', where: { and: [{ paid: { equals: false } }, { dueDate: { less_than: 'today' } }] } },
    mine: { where: ({ as }) => ({ owner: { equals: as.user.id } }) },
  },
  measures: {
    total: { sum: 'total', format: 'money', currency: 'currency' },
    average: { avg: 'total', format: 'money', label: 'Average invoice' },
  },
  groups: { client: 'Client', status: 'Status' },
  scopes: { client: id => ({ client: { equals: id } }) },
})

widgetsPlugin({
  sources: { invoices },
  widgets: [
    figure('unpaid', invoices, { label: 'Unpaid invoices', filter: 'unpaid', measure: 'total' }),
    chart('by-client', invoices, { label: 'Invoiced by client', measure: 'total', by: 'client' }),
  ],
})
```

| | |
| --- | --- |
| `label` | The collection's own where it is left out. |
| `access` | [Who it is for](#who-sees-what), as Payload asks it of a collection. Whoever the collection lets read it where it is left out. |
| `date` | The date a period and a chart over time go by. |
| `discover` | `false` to have only what is declared here. Otherwise what the plugin finds is there too. |
| `draft` | The collection keeps drafts: read the latest version of each. |
| `filters` | Each a `where`, or a function of the [context](#the-context) that gives one, for filters that depend on who is looking. Named after its key where it has no `label`. A `remark` says what is worth saying under the number of them. |
| `measures` | In place, `{ sum \| avg \| min \| max: 'field', format?, currency?, label?, filter? }`, with a [formula](#formulas) where a field is not enough; or one written out (below). `count` is always there. |
| `lists` | Made with `rows(…)` (below). |
| `groups` | The fields it can be split by, each with what to call it. |
| `scopes` | How to narrow it to one of something, by what that is called: `<Chart scope={{ client: id }} />`. |

A declared source is kept by the name it is given under `sources`. Renaming it leaves the widgets people set up
with it saying they are not set up.

**A measure written out** is for what a sum of one field does not say:

```ts
import { records, sum } from 'payload-plugin-widgets'

measures: {
  // a field added up, with what its records are called
  worked: sum('Hours worked', 'minutes', 'hours', { note: ['entry', 'entries'] }),
  // a record that does not simply count as its field: as a formula, which the database can work out as well
  billable: sum('Billable', 'minutes', 'money', { of: { multiply: [{ divide: ['minutes', 60] }, 'rate'] } }),
  // or as a function of the record, which has every record read; `select` names what else it reads
  rounded: sum('Billed', 'minutes', 'hours', { select: ['step'], of: doc => Math.ceil(doc.minutes / (doc.step || 15)) * (doc.step || 15) }),
  // anything at all: `read` is handed the context, the selection and the source
  oldest: {
    label: 'Oldest open',
    read: async (context, selection, from) => {
      const [first] = await records(context, from, selection, ['createdAt'], { limit: 1, sort: 'createdAt' })
      return first ? { value: context.day(context.date(first.createdAt)) } : { value: '–' }
    },
  },
}
```

A measure gives a `Reading`: `value` as it is shown, and optionally `note`, `tone` (`'calm' | 'warn' | 'bad'`),
`href`, and `amount`, the figure as a number, which lets it be compared and set against a goal. One made with
`sum`, or with `reckoned` (what `sum` is made of), can also be drawn as a chart.

**A list:**

```ts
import { rows } from 'payload-plugin-widgets'

lists: {
  upcoming: rows('Upcoming', {
    select: ['title', 'dueDate'],
    sort: 'dueDate',
    row: (doc, context) => ({
      title: doc.title,
      detail: doc.dueDate ? context.day(context.date(doc.dueDate)) : '',
      late: !!doc.dueDate && context.date(doc.dueDate) < context.today,
    }),
    empty: 'Nothing coming up',
    more: context => ({ add: { href: `${context.list('tasks')}/create`, label: 'New task' } }),
  }),
}
```

`doc` in `row` has the fields named in `select`, typed, and no others.

## On any other page

The same three are server components for any page of the admin: a custom view, a field, a tab of a document.

```tsx
import { Chart, Figure, Records } from 'payload-plugin-widgets/rsc'

export const ProjectSummary = async ({ req, id }) => (
  <>
    <Figure req={req} source="orders" measure="total" period="month" compare="previous" />
    <Chart req={req} source={time} measure="worked" by="user" scope={{ project: id }} as="line" />
    <Records req={req} source="tasks" where={{ assignee: { equals: req.user.id } }} quiet />
  </>
)
```

| Prop | | |
| --- | --- | --- |
| `req` | `PayloadRequest` | Who is looking. Required. |
| `source` | a declared source, or a name | Required. |
| `filter`, `where`, `period`, `date`, `from`, `to` | | As of a ready-made widget. |
| `scope` | `{ [name]: id }` | Only what belongs to one of something, as the source's `scopes` call it. |
| `label` | `string` | What the tile is called; named after what it shows where it is left out. |
| `name` | `string` | What it is found by in a stylesheet, as `data-widget`. |
| `as` | `string` | How it is drawn. |
| `quiet` | `boolean` | Leaves no trace where there is nothing to show or the person may not see it. Otherwise a tile says why. |
| `action` | `{ label, href }` | A link in the head of the tile. |
| `after` | `ReactNode` | Anything at all under what it shows. |
| `measure`, `compare`, `goal`, `note`, `data` | | `Figure` |
| `list`, `limit` | | `Records` |
| `measure`, `by`, `series` | | `Chart` |

Nobody signed in: nothing is drawn.

## Drawing it your own way

Three steps, each further from the tiles.

### A view

A component of your own for one of the three kinds. It is offered under "Drawn as" in the drawer, and asked for
with `as`:

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
| `ListViewProps` | `label, note, tone, href, rows [{ title, detail, href, late }], empty, add, quick, api, words` |
| `ChartViewProps` | `label, note, href, empty, bars [{ label, amount, shown, href }]`, and where there are several: `series [{ key, label, total, peak, bars }], stacked` |

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
            <Area key={line.key} dataKey={line.key} name={line.label} stackId="all" stroke={`var(--widgets-series-${index + 1}, var(--theme-success-500))`} fill={`var(--widgets-series-${index + 1}, var(--theme-success-500))`} fillOpacity={0.2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </section>
  )
}
```

The tile's own classes keep it looking like the others; the numbers are already read with the viewer's access,
narrowed by the widget's filter and period, and worded (`shown`) the way the other tiles word them.

### The data alone

To draw anything anywhere: a page, a component, an endpoint.

```ts
import { readChart, readFigure, readList, Unavailable } from 'payload-plugin-widgets'

const sold = await readFigure(req, 'orders', { measure: 'total', period: 'month', compare: 'previous', goal: 5000 })
// { value: '€2,445.63', amount: 2445.63, note: '+34% on the period before · 49% of €5,000.00', href: '/admin/collections/orders?…',
//   previous: { value: '€1,825.10', amount: 1825.1 }, trend: 'up', goal: { value: '€5,000.00', amount: 5000, share: 0.49 } }

const { rows, note, href } = await readList(req, 'tasks', { limit: 5 })
const { bars, note: total } = await readChart(req, invoices, { measure: 'total', by: 'client', scope: { client: 12 } })
```

They take what the components take, read as whoever makes the request and in their language. Where the source is
not for them, or nobody is signed in, `Unavailable` is thrown; where what is picked is not there, `Misconfigured`,
with what is wrong as `problems`.

### A widget that is all your own

Any server component, given a place in the starting layout, a label in every language and its `access` like the rest:

```ts
import { widget } from 'payload-plugin-widgets'

widget('shortcuts', { label: 'Shortcuts', Component: 'src/components/Shortcuts.tsx#Shortcuts', access: ({ req }) => req.user?.role === 'admin', size: 'wide' })
```

```tsx
import { gated, NoteTile } from 'payload-plugin-widgets/rsc'

export const Shortcuts = gated(async ({ req, widgetData }) => (
  <NoteTile label="Shortcuts" text="Everything you need is one click away." link={{ href: '/admin/collections/orders', label: 'Orders' }} />
))
```

`gated` keeps it to whoever its `access` says it is for. `size` is `'tile'` (as small as a figure) or `'wide'`; `fields` and `data` give it
settings of its own, read from `widgetData`.

The tiles themselves are exported too, to draw your own data the way the plugin draws its own: `Tile`, `ListTile`,
`ChartTile`, `NoteTile` and `Notice`.

## Who sees what

Every read is made as the signed-in user (`overrideAccess: false`), so **Payload's access control always
applies**: a figure counts only what that person may read.

On top of it, `access` on a source or a widget says who it is *for*: who is offered it, and who starts with it. It
is Payload's own `Access`, written and typed like the one on a collection, and handed `{ req }`:

```ts
import type { Access } from 'payload'

const admins: Access = ({ req }) => req.user?.role === 'admin'
const theirOwn: Access = ({ req }) => ({ owner: { equals: req.user?.id } })

source('invoices', { access: admins })                               // nobody else is offered it
figure('my-orders', 'orders', { label: 'My orders', access: theirOwn }) // everybody's is their own
<Figure req={req} source="orders" measure="total" access={admins} />
await readFigure(req, 'orders', { measure: 'total', access: admins })
```

- `true` is everybody the collection lets read, `false` nobody. A `Where` in place of `true` leaves the widget only
  those records, and the list it leads to shows the same ones.
- A source without one is for whoever the collection lets read it. A widget without one is for whoever its source
  is for; one with its own is asked both.
- It only ever narrows. What the collection refuses, no `access` here brings back.
- A widget somebody may not see says "Not available to this account" in place of its figure, or nothing where it
  is `quiet`.
- `home` is asked the same way, for who starts with a widget: `home: admins`, or `home: false` for nobody.

In the drawer a source is offered to whoever its `access` lets in. One that answers with a promise is offered to
everybody and refused when it is read, as the field that offers it cannot wait.

### A total of what somebody may not open

A figure or a chart can say more than its reader may read: revenue for a team that cannot open the invoices. As
in the local API, that is `overrideAccess`, and as there, who then sees it is yours to say:

```ts
figure('revenue', 'invoices', {
  label: 'Revenue this month', measure: 'total', period: 'month',
  overrideAccess: true,
  access: ({ req }) => ['admin', 'sales'].includes(req.user?.role),
})

<Chart req={req} source="invoices" measure="total" by="time" overrideAccess access={staff} />
await readFigure(req, 'invoices', { measure: 'total', overrideAccess: true, access: staff })
```

- The collection's own access is not asked, and every read behind it is made with the server's access: a custom
  measure's too, which finds `overrideAccess: true` in `context.as`.
- It has to come with an `access`, on the widget or on its source: a ready-made widget without one stops the
  config from being built. Somebody still has to be signed in.
- A filter returned by that `access` still narrows what is counted.
- The tile leads to the list behind it only for those the collection lets read. For everybody else it is not a
  link, and neither are the bars of a chart.
- Only figures and charts take it, and only where a developer writes them: not a list, whose rows are records,
  and nothing set up in the drawer.

What it shows is still data. A chart by client names the clients, and a figure filtered narrowly enough is one
record's number.

## Languages, time and numbers

```ts
widgetsPlugin({
  timeZone: 'Europe/Zagreb',   // where a day starts and ends; UTC where it is left out
  weekStartsOn: 1,             // Monday, the default; 0 is Sunday
  currency: 'EUR',             // of amounts that do not say theirs, and the one charts are drawn in
  format: (value, { style, currency }) => (style === 'money' ? `${value.toFixed(2)} ${currency}` : undefined),
  i18n: {
    translations: { de: { 'Today': 'Heute', 'by {what}': 'nach {what}', 'Open tasks': 'Offene Aufgaben' } },
    plurals: { de: { record: { one: 'Eintrag', other: 'Einträge' } } },
    locale: language => (language === 'de' ? 'de-AT' : language),
  },
})
```

Everything is written in English and said in the language of the request. Numbers, amounts, hours and dates are
written by `Intl` in that language; `format` is only for where that is not how you write them, and whatever it
returns nothing for is written as usual.

- `STRINGS` is the full list of what the widgets say, to translate; `PLURALS` what they count.
- What you write yourself (the label of a source, of a widget, of a filter) is said through the same dictionary.
  A label can also be given in several languages at once, as Payload's own are: `{ en: 'Orders', de: 'Bestellungen' }`.
- `plurals` are by language under what the thing is called for one in English, in the forms `Intl.PluralRules`
  names: `{ hr: { record: { one: 'zapis', few: 'zapisa', other: 'zapisa' } } }`.
- A project with a dictionary of its own gives `i18n.translate(language, text, vars)` and
  `i18n.plural(language, count, one, many)` instead.

## Styling

![The same dashboard in the admin's dark theme](https://raw.githubusercontent.com/m-grgic/payload-plugin-widgets/main/docs/dashboard-dark.png)

The tiles follow the admin's theme by themselves. Their stylesheet is in a cascade layer of its own (`widgets`),
so **anything a project writes wins without `!important`**, whatever its selector.

```css
/* in your admin stylesheet, e.g. src/app/(payload)/custom.scss */
:root { --widgets-accent: var(--theme-warning-500); --widgets-radius: 0; }
[data-widget='overdue'] .widgets-tile__value { color: var(--theme-error-500); }
[data-trend='down'] .widgets-tile__note { color: var(--theme-error-500); }
.widgets-tile[data-tone='bad'] { --widgets-border: var(--theme-error-500); }
```

**Variables**, each falling back to the admin's own:

| | |
| --- | --- |
| `--widgets-accent` | the dot of a tile that is doing fine, and a chart's bars |
| `--widgets-warn`, `--widgets-bad` | the dot of one that wants attention, and of one that is late |
| `--widgets-link` | the links of a tile |
| `--widgets-bg`, `--widgets-bg-hover` | a tile's background |
| `--widgets-border`, `--widgets-border-hover` | its border |
| `--widgets-radius`, `--widgets-padding` | its corners, and the room inside it |
| `--widgets-text`, `--widgets-muted`, `--widgets-label` | what it says, what it says under that, and what it is called |
| `--widgets-label-size`, `--widgets-value-size`, `--widgets-text-size`, `--widgets-note-size` | |
| `--widgets-chart-height`, `--widgets-spark-height` | how tall columns and a line are drawn, and the line under a figure |
| `--widgets-series-1` … `--widgets-series-6` | the colours of a chart's series, the first being `--widgets-accent` |

**Classes**, which keep their names:

| | |
| --- | --- |
| `.widgets-tile` | with `__label`, `__value`, `__progress`, `__note`, `__head`, `__rows`, `__late`, `__action`, `__add` |
| `.widgets-chart` | with `__label`, `__bar`, `__value` |
| `.widgets-columns` | with `__bar`, `__label` |
| `.widgets-line` | with `__stroke`, `__area`, `__labels` |
| `.widgets-legend` | with `__mark`, `__total` |
| `.widgets-quick`, `.widgets-note` | |

**Attributes** each tile says of itself:

| | |
| --- | --- |
| `data-kind` | `figure`, `list`, `chart`, `notice`, `note` |
| `data-tone` | `calm`, `warn`, `bad` |
| `data-view` | `number`, `progress`, `sparkline`; `bars`, `columns`, `line` |
| `data-trend` | on a figure that is compared: `up`, `down`, `flat` |
| `data-widget` | the slug of a ready-made widget, or the `name` a component was given |

The stylesheet is also there by itself, as `payload-plugin-widgets/widgets.css`, for a page that draws the classes
without the components.

## Reference

### Options

```ts
widgetsPlugin({
  sources,       // { [name]: source(…) | boolean }
  discover,      // false: only the declared sources
  widgets,       // figure(…), list(…), chart(…), widget(…)
  views,         // { [name]: { kind: 'figure' | 'list' | 'chart', label, Component } }
  i18n,          // { translations, plurals, translate, plural, locale }
  timeZone,      // 'UTC'
  weekStartsOn,  // 1
  currency,      // 'EUR'
  format,        // (value, { style, locale, currency }) => string | undefined
  sums,          // 'database'; 'records' to read record by record always
  cache,         // seconds what was read is kept for; nothing is kept without it
})
```

An `admin.dashboard.defaultLayout` of the project's own is left as it is; the ready-made widgets are then there to
be added.

### Entries

| | |
| --- | --- |
| `payload-plugin-widgets` | For the Payload config, and anything else on the server: `widgetsPlugin`, `figure`, `list`, `chart`, `widget`, `source`, `count`, `sum`, `reckoned`, `rows`, `records`, `any`, `selected`, `readFigure`, `readList`, `readChart`, `Unavailable`, `Misconfigured`, `STRINGS`, `PLURALS`, `PERIODS`, `VIEWS`, and the types. It imports no component. |
| `payload-plugin-widgets/rsc` | Server components: `Figure`, `Records`, `Chart`, `gated`, `contextFor`, the tiles, and `FigureViewProps`, `ListViewProps`, `ChartViewProps`. |
| `payload-plugin-widgets/client` | The client components the drawer and the tiles use. The import map points at them; there is seldom a reason to import one. |
| `payload-plugin-widgets/widgets.css` | The stylesheet. |

### The context

What a filter's function, a measure's `read` and a list's `row` are handed:

| | |
| --- | --- |
| `payload` | |
| `req` | the request it is all read for |
| `as` | `{ depth: 0, overrideAccess: false, user }`: spread it into a read to make it as the signed-in user, or with the server's access where the widget asked for [`overrideAccess`](#a-total-of-what-somebody-may-not-open) |
| `sources`, `mayRead(source)` | every source by name, and whether one is for the person looking |
| `today`, `dayStart`, `monthStart`, `yearStart` | today as `YYYY-MM-DD`, and the instants those start at, in the time zone given |
| `date(instant)`, `instant(day)` | the day an instant falls on there, and the instant a day starts at |
| `currency`, `weekStartsOn` | as the options have them |
| `data` | what the widget was set up with |
| `list(slug, where?)`, `edit(slug, id)` | links into the admin |
| `t(text, vars?)`, `plural(count, one, many)` | in the language of the request |
| `number`, `hours(minutes)`, `money(amount, currency)`, `total(perCurrency)`, `day(date)`, `month(date)` | written as that language writes them |

## Formulas

A measure is often not one field but a little arithmetic over several: quantity times price, an amount that counts
against the total on a credit note, the hours that were billed where they were written down and the hours worked
where they were not. Wherever a measure names a field it can be given a formula in its place, and on Postgres the
database works it out, as it does a field:

```ts
measures: {
  value: { sum: { multiply: ['quantity', 'price'] }, format: 'money' },
  margin: { avg: { divide: [{ subtract: ['price', 'cost'] }, 'price'] } },
  // a credit note counts against what was invoiced
  invoiced: { sum: { when: { type: { equals: 'creditNote' } }, then: { multiply: ['total', -1] }, else: 'total' }, format: 'money' },
  // minutes billed, or the minutes worked where none were written down, of what is billable at all
  billable: { sum: { when: { billable: { equals: true } }, then: { first: ['billedMinutes', 'workedMinutes'] } }, format: 'hours' },
}
```

The same goes for one said in place on a widget (`measure: { sum: { multiply: ['quantity', 'price'] } }`) and for
`sum('Value', 'price', 'money', { of: { multiply: ['quantity', 'price'] } })`.

| A formula is | It comes to |
| --- | --- |
| a number, `60` | itself |
| a number field by its path, `'price'`, `'totals.net'` | what the record has there; nought where it has nothing |
| `{ add: [a, b, …] }`, `{ multiply: [a, b, …] }` | all of them added, or multiplied |
| `{ subtract: [a, b] }`, `{ divide: [a, b] }` | one less the other; one by the other, and nought where that is by nought |
| `{ first: [a, b, …] }` | the first field of them that has something in it, nought counting as something |
| `{ when: test, then: a, else: b }` | `a` for a record the test holds of, `b` for any other; nought where there is no `else` |

A test is written as a filter is: `{ status: { equals: 'paid' } }`, several fields that all have to hold, and `and`
and `or` of those. A field is compared with `equals`, `not_equals`, `in`, `not_in`, `exists`, `greater_than`,
`greater_than_equal`, `less_than` and `less_than_equal`; a relationship by the id it points at. A record with
nothing in the field equals nothing, is `not_equals` to anything, and is neither greater nor less.

Formulas are typed against the collection's number fields and checked as the config is built: a field that is not
there, or not a number, or a choice a select does not have, is said with what was probably meant.

**In the rows of an array** a formula is worked out for each row, and a record counts as its rows added up:
`{ sum: { multiply: ['items.quantity', 'items.price'] } }` is the value of everything ordered. Split by a field
of the same rows (`by: 'items.kind'`) it is the rows under each. A formula reads the rows of one array, with
whatever it likes of the record around them. These are read record by record: see below.

## Where the adding is done

**On Postgres, by the database.** A sum, an average, a lowest, a highest and every chart of a field or of a
[formula](#formulas) are one query that groups and adds, however many records there are. A field inside a named
group or a named tab is a column like any other. The query is built by Payload the way it builds one to
count, with the collection's `access` for whoever asks (or without, under `overrideAccess`), so it comes to what
reading the records would.

**Anywhere else, record by record**, at most 5,000 of them, with a tile that says so beyond that. That is MongoDB
and SQLite, and on Postgres whatever the database does not hold just as a record shows it:

- a measure worked out by a function (`sum(…, { of: doc => … })`, or a `read` of your own): say it as a
  [formula](#formulas) where it can be,
- a number or a group in the rows of an array,
- a field with `access.read` or an `afterRead` hook, a virtual or a localized one, one that holds several
  (`hasMany`), and any field of a collection that has an `afterRead` hook of its own,
- a collection read with its drafts (`draft: true` on its source).

Nothing has to be said for either: each figure goes the way it can. `sums: 'records'` has everything read record
by record, which is the place to look first should a number ever differ.

**Kept for a while, where you say so.** With `cache: 60` what a figure or a chart read is kept for a minute, so a
dashboard opened ten times asks the database once. It is kept for each person apart, as what they may read
differs; what is read under `overrideAccess` is the same for everybody and kept once. A record of the collection
that is created, changed or deleted through Payload has it forgotten at once. Lists are never kept.

```ts
widgetsPlugin({ cache: 60 })
```

It is kept in the memory of the server: on serverless hosting each instance keeps its own, and one instance does
not hear of a change made through another before the seconds are up.

## Limits

- **Where the database does not do the adding, a sum or a chart reads at most 5,000 records** and works them
  out in memory. Beyond that the tile says "Only the first 5,000 are counted": narrow it with a period or a
  filter. Counts have no such limit. See [Where the adding is done](#where-the-adding-is-done).
- A chart of money is drawn in one currency, the one the plugin was given; records in another are left out, and
  the tile says how many. A figure of money says each currency's total.
- A list is drawn as rows; another way only by a view of your own.
- Nothing inside a block is found, and nothing in the rows of rows. What is in the rows of an array is read
  record by record, and a period cannot go by a date there. A relationship to more than one collection is not a
  group.
- A tile is read when the page is, unless the plugin is given a `cache`: see [Where the adding is done](#where-the-adding-is-done).

## Troubleshooting

| What you see | Why |
| --- | --- |
| `widgetsPlugin: a widget is set up with what is not there` when the config is built | A ready-made widget names a source, filter, measure, group, list or view that is not there. The message says which, and what was probably meant. |
| The same in the log when Payload starts, and in a tile | A field in a `where`, a `date` or a measure is not in the collection. |
| `… was added to the config after the widgets were set up, and is no source` | A plugin that adds a collection runs after this one. Give it an `order` below 100, or list this plugin last. |
| A widget is missing, or its component is not found | The import map is old: `payload generate:importmap`. |
| "Not available to this account" | The collection's own access control refuses the read, or the widget's or its source's [`access`](#who-sees-what) does. |
| `What is read with overrideAccess has to say who it is for` when the config is built | A ready-made figure or chart has `overrideAccess` and neither it nor its source an `access`. |
| "Only the first 5,000 are counted" | See [Limits](#limits). |
| A figure is one day off around midnight | Set `timeZone`: a day starts in UTC where it is left out. |
| Hours are sixty times too many | A field with `format: 'hours'` is expected to hold minutes. |
| `The widgets plugin is not in the Payload config` | A component from `/rsc` is used in an admin whose config does not have `widgetsPlugin()`. |
| Somebody still has the old layout after `widgets` changed | Payload keeps their own once they rearrange it. "Reset Layout" in the dashboard's menu goes back to the ready-made one. |

## The demo

[`dev/`](./dev) is a small shop in a stock Payload admin, with made-up data, that every screenshot here is taken
of. It reads the plugin from its source, so it is also where to work on it:

```sh
git clone https://github.com/m-grgic/payload-plugin-widgets.git
cd payload-plugin-widgets
pnpm install
DATABASE_URI=postgres://postgres:postgres@127.0.0.1:5432/widgets_demo pnpm dev
```

See [`dev/README.md`](./dev/README.md).

## Working on it

```sh
pnpm typecheck   # the source, strictly
pnpm test        # node --test; with DATABASE_URI also against a Postgres, which it empties first
pnpm build       # dist: JavaScript, types and the stylesheet
pnpm dev         # the demo
```

- The source imports its own files without an extension; the build says them in full, so what is published is
  read by Node as it is.
- Nothing the Payload config reads (`src/index.ts` and what it imports) may import a component.
- Everything a tile says is in `src/strings.ts`; a test fails where one is said that is not listed there.
- What the database adds up is compared with what the records come to in `test/database.test.ts`, which runs
  where `DATABASE_URI` names a Postgres that may be emptied, as it does in CI.
- A release is a tag: `v1.2.3` on a commit whose `package.json` says `1.2.3` is checked, built and published by
  `.github/workflows/release.yml`, which npm trusts as the package's publisher, so no token is kept anywhere. By
  hand it is `pnpm pack` and `npm publish` of the tarball: pnpm points the package's entries at `dist`
  (`publishConfig`), and npm sends the README along.

Issues and pull requests are welcome. See the [changelog](./CHANGELOG.md) for what changed.

## Licence

[MIT](./LICENSE) © Matija Grgić
