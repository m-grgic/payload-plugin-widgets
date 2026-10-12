# payload-plugin-widgets

Dashboard widgets for [Payload](https://payloadcms.com) that read from your collections: figures, lists and charts.
Anybody signed in can add one to their dashboard and set it up in its drawer; a project can put some there
ready-made, and show the same three on any other page.

Everything is read with the access of whoever is looking, and nothing is drawn by a script: the tiles are server
components that follow the admin's theme.

Tested with Payload 3.90, Next.js 16 and React 19.

## 1. Start with nothing

```ts
import { widgetsPlugin } from 'payload-plugin-widgets'

export default buildConfig({
  plugins: [widgetsPlugin()],
})
```

Then run `payload generate:importmap`.

Every collection is now a source as its fields describe it: how many there are, a sum for each number, a group for
each select, checkbox and relationship, and a list of the latest. In the dashboard's edit mode, "A figure",
"A list" and "A chart" can be added and set up: which collection, filtered as the admin's lists are, over which
period, drawn how.

Put it after the plugins that add collections. It runs with `order: 100`, so plugins that leave their order open
come first.

## 2. Put widgets there ready-made

```ts
import { chart, figure, list, widgetsPlugin } from 'payload-plugin-widgets'

widgetsPlugin({
  sources: { media: false },
  widgets: [
    figure('open-tasks', 'tasks', { label: 'Open tasks', where: { status: { not_equals: 'done' } } }),
    figure('overdue', 'tasks', { label: 'Overdue', where: { dueDate: { less_than: 'today' } } }),
    figure('average-order', 'orders', { label: 'Average order', measure: { avg: 'total' }, period: 'month' }),
    chart('orders-by-month', 'orders', { label: 'Orders', measure: 'total', by: 'time', period: 'last12', as: 'columns' }),
    list('latest-orders', 'orders', { label: 'Latest orders', limit: 5 }),
  ],
})
```

- `where` is a filter as Payload takes them anywhere, `and` and `or` included.
- A date can be compared with a **moment** instead of a date that would stand still: `now`, `today`, `tomorrow`,
  `yesterday`, `startOfWeek`, `startOfMonth`, `startOfYear`, each on its own or moved by days, weeks, months or
  years (`today+7d`, `startOfMonth-1m`).
- `period` is one of `all`, `today`, `past`, `upcoming`, `month`, `year`, `last30`, `last12` or `custom` (with
  `from` and `to`); `date` says which date it goes by where that is not the source's own.
- `measure` is how many there are where it is left out, a number field by name (its sum), or
  `{ sum | avg | min | max: 'field' }`.
- `roles` says who a widget is for, `home` who starts with it on their dashboard.

A widget set up with what is not there says so, and what was probably meant:

```
widgetsPlugin: a widget is set up with what is not there
  - "overdue": tasks has no field called "dueDat". Did you mean "dueDate"?
```

A source, a filter, a measure or a view that is not there stops the config from being built. A field that is not
there, in a `where`, a `date` or a measure, is only known once Payload has started: it is logged as an error then,
and the tile says the same in place of its figure.

The ready-made widgets are what a dashboard starts with and what "Reset layout" goes back to. Payload keeps each
person's own layout once they rearrange it.

## 3. Say more about a figure

```ts
figure('sold', 'orders', {
  label: 'Sold this month', measure: 'total', period: 'month',
  compare: 'previous',   // also read for the period before
  goal: 5000,            // what it is set against
  as: 'progress',        // or 'sparkline', or left out for the number alone
  note: '{change} on last month · {left} to go',
})
```

`compare`, `goal` and `as: 'sparkline'` say what else is read; `as` says how it is drawn; `note` what the line
under the number says. Without a note the figure says the usual of what it was given ("+12% on the period before
· 60% of 5.000,00 €").

A note can use `{value}` and `{note}` (what it would have said); with `compare`, `{previous}` and `{change}`; with
a goal, `{goal}`, `{percent}` and `{left}`.

A month or a year to date is compared with the same days of the one before; any other period with the one that is
as long and ends where it starts.

## 4. Let a collection describe itself

Under `custom.widgets`, a collection or a field says what it is to the widgets:

```ts
{
  slug: 'orders',
  custom: { widgets: { label: 'Orders', date: 'placedAt', roles: ['admin'] } },
  fields: [
    { name: 'total', type: 'number', custom: { widgets: { format: 'money', currency: 'currency' } } },
    { name: 'internalScore', type: 'number', custom: { widgets: false } },
  ],
}
```

`custom: { widgets: false }` on a collection keeps it from being a source at all. A number's `format` is
`number`, `money` or `hours`; **hours are kept in minutes**.

## 5. Declare what cannot be found

A source says what else of a collection is worth looking at. The names a widget picks from it are part of its
type, so one that is not there does not compile.

```ts
import { source } from 'payload-plugin-widgets'

const invoices = source('invoices', {
  label: 'Invoices', roles: ['admin'], date: 'issuedAt',
  filters: {
    unpaid: { where: { paid: { equals: false } } },
    overdue: { where: { dueDate: { less_than: 'today' } } },
  },
  measures: {
    total: { sum: 'total', format: 'money' },
    average: { avg: 'total', format: 'money' },
  },
  groups: { client: 'Client' },
})

widgetsPlugin({
  sources: { invoices },
  widgets: [
    figure('unpaid', invoices, { label: 'Unpaid invoices', filter: 'unpaid', measure: 'total' }),
    chart('by-client', invoices, { label: 'Invoiced by client', measure: 'total', by: 'client' }),
  ],
})
```

What the plugin finds in the collection by itself is still added to a declared source, unless it says
`discover: false`. `widgetsPlugin({ discover: false })` keeps to the declared sources altogether.

## 6. Show them on any page

```tsx
import { Chart, Figure, Records } from 'payload-plugin-widgets/rsc'

<Figure req={req} source="orders" measure="total" period="month" compare="previous" />
<Chart req={req} source={time} measure="worked" by="user" scope={{ project: id }} as="line" />
<Records req={req} source="tasks" where={{ assignee: { equals: req.user.id } }} quiet />
```

`req` says who is looking. `scope` narrows a declared source to one of something, as its `scopes` call it.
`quiet` leaves no trace where there is nothing to show or the person may not see it; otherwise a tile says why.

## 7. Draw it your own way

Three steps, each further from the tiles:

**A view**, for one of the three kinds. It is offered under "Drawn as" in the drawer, and asked for with `as`:

```ts
widgetsPlugin({
  views: { donut: { kind: 'chart', label: 'A donut', Component: 'src/components/Donut.tsx#Donut' } },
  widgets: [chart('by-status', 'tasks', { label: 'Tasks by status', by: 'status', as: 'donut' })],
})
```

```tsx
import type { ChartViewProps } from 'payload-plugin-widgets/rsc'

export const Donut = ({ label, bars, href }: ChartViewProps) => …
```

The component is handed what the tile would be made of (`FigureViewProps`, `ListViewProps`, `ChartViewProps`),
with `req` and the name it was asked for by.

**The data alone**, to draw anything anywhere:

```ts
import { readChart, readFigure, readList } from 'payload-plugin-widgets'

const { value, note, tone, href, previous, trend } = await readFigure(req, 'orders', { measure: 'total', period: 'month', compare: 'previous' })
```

**A widget that is all your own**, given a place in the starting layout, a label in every language and its roles
like the rest:

```ts
widget('shortcuts', { label: 'Shortcuts', Component: 'src/components/Shortcuts.tsx#Shortcuts', roles: ['admin'] })
```

```tsx
import { gated, NoteTile } from 'payload-plugin-widgets/rsc'

export const Shortcuts = gated(async ({ req }) => <NoteTile label="Shortcuts" text="…" />)
```

A ready-made widget also takes a link for its head (`action`) and a component drawn under what it shows (`after`).

## 8. Who sees what

Every read is made as the signed-in user, so Payload's access control always applies. On top of it, `roles` on a
source or a widget says who has a use for it. The plugin expects a `roles` field on the user holding some of them;
where yours is kept another way, say how:

```ts
widgetsPlugin({ allowed: (roles, user) => roles.includes(user?.role) })
```

A source without roles is for whoever the collection lets read it.

## 9. Languages, time and numbers

```ts
widgetsPlugin({
  timeZone: 'Europe/Zagreb',   // where a day starts and ends; UTC where it is left out
  weekStartsOn: 1,             // Monday, the default
  currency: 'EUR',             // of amounts that do not say theirs
  format: (value, { style, currency }) => style === 'money' ? `${value.toFixed(2)} ${currency}` : undefined,
  i18n: {
    translations: { de: { 'Today': 'Heute', 'by {what}': 'nach {what}' } },
    plurals: { de: { record: { one: 'Eintrag', other: 'Einträge' } } },
  },
})
```

Everything is written in English. `STRINGS` is the full list of what the widgets say, to translate; what you
write yourself (the label of a source, of a widget) is said through the same dictionary. A project with a
dictionary of its own gives `i18n.translate` and `i18n.plural` instead.

## 10. Styling

The tiles bring their own stylesheet, in a cascade layer of its own, so anything a project writes wins without
`!important`. It can change:

- **variables**, each falling back to the admin's own: `--widgets-accent`, `--widgets-radius`,
  `--widgets-chart-height` and the rest;
- **classes** that keep their names: `.widgets-tile` with `__label`, `__value`, `__note`, `.widgets-chart`,
  `.widgets-columns`, `.widgets-line`;
- **attributes** each tile says of itself: `data-kind`, `data-tone`, `data-view`, `data-trend`, and `data-widget`
  with the slug of a ready-made one.

```css
:root { --widgets-accent: var(--theme-warning-500); }
[data-widget='overdue'] .widgets-tile__value { color: var(--theme-error-500); }
[data-trend='down'] .widgets-tile__note { color: var(--theme-error-500); }
```

The full list is at the top of [`src/widgets.css`](./src/widgets.css).

## Limits

- A sum or a chart reads at most 5,000 records and works them out in memory. Beyond that the tile says
  "Only the first 5.000 are counted": narrow it with a period or a filter. Counts have no such limit.
- A chart of money is drawn in one currency; records in another are left out, and the tile says how many.
- A list can be drawn another way only by a view of the project's own.

## Working on it

```sh
pnpm typecheck   # the source, strictly
pnpm test        # node --test, no database needed
pnpm build       # dist: JavaScript, types and the stylesheet
```

The source imports its own files without an extension; the build says them in full, so what is published is read
by Node as it is. Nothing the Payload config reads (`src/index.ts` and what it imports) may import a component.
