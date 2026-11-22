# Sources and measures

- [Sources](#sources)
- [What is found by itself](#what-is-found-by-itself)
- [Hints on a collection or a field](#hints-on-a-collection-or-a-field)
- [Declaring a source](#declaring-a-source)
- [A measure written out](#a-measure-written-out)
- [A list](#a-list)
- [Formulas](#formulas)

## Sources

A **source** is a collection as the widgets see it:

- its **filters**: which of its records are worth looking at,
- its **measures**: what can be told about a set of them,
- short **lists**,
- its **groups**: what it can be split by.

```ts
widgetsPlugin({
  sources: {
    media: false,         // not a source
    'audit-log': false,
    orders,               // declared, see below
  },
  discover: false,        // only the declared ones; every collection where it is left out
})
```

With the generated types, `false` is only taken for a collection there is. Without them, any name is taken.

## What is found by itself

From a collection's fields alone, the plugin makes:

| From | Comes |
| --- | --- |
| the collection | a measure of how many there are (`count`), and a list of the latest |
| each `number` field that holds one number | a measure that can be added up, averaged, or its lowest or highest taken |
| each `select`, `radio` and `checkbox`, and each `relationship` and `upload` to one collection | a group a chart can be split by |
| each `relationship` and `upload` to one collection | a scope: how to narrow it to one of what it points at |
| each `date` field, `createdAt` and `updatedAt` | a date a period can go by; `createdAt` unless said otherwise |
| the collection's labels and `useAsTitle` | what it and its rows are called |

Some fields are seen through, and some are found under their path:

- Fields inside rows, collapsibles, unnamed tabs and unnamed groups are seen through.
- Those inside a named group, a named tab or the rows of an array are found under their path, and called after
  both: `totals.net` is "Totals: Net", `items.price` is "Items: Price".
- A date and a scope are only ever the record's own, not its rows'.

Virtual fields and fields the admin hides are left out. A collection that keeps drafts is read as the admin lists
it: the latest version of each.

## Hints on a collection or a field

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
| `access` | [who it is for](./user-widgets-and-access.md#who-sees-what), where that is fewer than may read it |

| On a field | |
| --- | --- |
| `false` | left out |
| `format` | `'number'`, `'money'` or `'hours'`. **Hours are kept in minutes.** |
| `currency` | where it is money: the name of the field that holds a record's currency |

The types are `CollectionHint` and `FieldHint`.

## Declaring a source

What cannot be found is declared. The names a widget picks from a declared source are part of its type, so one
that is not there does not compile. As the config is built, everything a declared source names is checked against
the collection:

- its `date` and `dates`,
- its filters,
- its groups,
- its scopes,
- its measures, and the fields they read and take their currency from.

```ts
import type { Access } from 'payload'
import { chart, figure, raw, source, widgetsPlugin } from 'payload-plugin-widgets'

const admins: Access = ({ req }) => Boolean(req.user?.roles?.includes('admin'))

const orders = source('orders', {
  label: 'Orders',
  access: admins,
  date: 'placedAt',
  dates: { createdAt: 'Created' },
  filters: {
    unpaid: { label: 'Not paid yet', where: { status: { equals: 'pending' } } },
    sold: { label: 'Sold', where: { status: { in: ['paid', 'shipped'] } } },
    croatia: { label: 'Croatia', where: raw({ 'customer.country': { equals: 'Croatia' } }) },
  },
  measures: {
    revenue: { sum: 'total', format: 'money', label: 'Revenue' },
    average: { avg: 'total', format: 'money', label: 'Average order' },
  },
  groups: { status: 'Status', customer: 'Customer' },
  scopes: { customer: id => ({ customer: { equals: id } }) },
})

widgetsPlugin({
  sources: { orders },
  widgets: [
    figure('unpaid', orders, { label: 'Unpaid orders', filter: 'unpaid', measure: 'revenue' }),
    chart('by-customer', orders, { label: 'Sold by customer', filter: 'sold', measure: 'revenue', by: 'customer' }),
  ],
})
```

| | |
| --- | --- |
| `label` | The collection's own where it is left out. |
| `access` | [Who it is for](./user-widgets-and-access.md#who-sees-what), as Payload asks it of a collection. Whoever the collection lets read it where it is left out. |
| `date` | The date a period and a chart over time go by. |
| `dates` | Other dates a period may go by, with what to call them: offered under "Going by" in the drawer. |
| `discover` | `false` to have only what is declared here. Otherwise what the plugin finds is there too. |
| `draft` | The collection keeps drafts: read the latest version of each. |
| `filters` | Each a `where`, typed against the collection, or a function of the [context](./advanced.md#the-context) that gives one, for filters that depend on who is looking: `mine: { where: ({ as }) => ({ assignee: { equals: as.user.id } }) }`. Named after its key where it has no `label`. A `remark` says what is worth saying under the number of them. |
| `measures` | In place, `{ sum \| avg \| min \| max: 'field', format?, currency?, label?, filter? }`, with a [formula](#formulas) where a field is not enough; or one [written out](#a-measure-written-out). `count` is always there. |
| `lists` | Made with `rows(…)`: [below](#a-list). |
| `groups` | The fields it can be split by, each with what to call it. |
| `scopes` | How to narrow it to one of something, by what that is called: `<Chart scope={{ customer: id }} />`. |

A declared source is kept by the name it is given under `sources`. Renaming it leaves the widgets people set up
with it saying they are not set up.

A filter the types cannot follow, such as a path through a relationship, is given with `raw(…)`. See
[where and dates](./where-and-dates.md#what-the-types-cannot-follow).

## A measure written out

This is for what a sum of one field does not say:

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

A measure gives a `Reading`:

- `value`, as it is shown,
- and, if it likes, `note`, `tone` (`'calm' | 'warn' | 'bad'`) and `href`,
- and `amount`, the figure as a number, which lets it be compared and set against a goal.

One made with `sum`, or with `reckoned` (what `sum` is made of), can also be drawn as a chart. `count(label?)` is
the count of records under a label of your own.

## A list

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

`doc` in `row` has the fields named in `select`, typed, and no others. A `list(…)` of this source that names no
list draws the first one it declares.

## Formulas

A measure is often a little arithmetic over several fields rather than one field. For example:

- quantity times price,
- an amount that counts against the total on a credit note,
- the hours billed where they were written down, and the hours worked where they were not.

Wherever a measure names a field it can be given a formula in its place, and on Postgres the database works it
out, as it does a field:

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
| `{ add: [a, b, …] }`, `{ multiply: [a, b, …] }` | all of them added, or multiplied; at least one part |
| `{ subtract: [a, b] }`, `{ divide: [a, b] }` | one less the other; one by the other, and nought where that is by nought; exactly two parts |
| `{ first: [a, b, …] }` | the first field of them that has something in it, nought counting as something |
| `{ when: test, then: a, else: b }` | `a` for a record the test holds of, `b` for any other; nought where there is no `else` |

A test is written the way a filter is:

- `{ status: { equals: 'paid' } }`,
- several fields that all have to hold,
- and `and` and `or` of those.

A field is compared with `equals`, `not_equals`, `in`, `not_in`, `exists`, `greater_than`, `greater_than_equal`,
`less_than` and `less_than_equal`. A relationship is compared by the id it points at. A record with nothing in the
field equals nothing, is `not_equals` to anything, and is neither greater nor less.

Formulas are typed against the collection: the parts against its number fields, a `when` against all of its
fields. They are checked as the config is built too, and each of these is said with what was probably meant:

- a field that is not there, or not a number,
- a choice a select does not have,
- a part in the wrong place, said with where in the formula it is: `In the formula, at "add.1.divide": divide
  takes two parts, not 3.`

**In the rows of an array** a formula is worked out for each row, and a record counts as its rows added up:

- `{ sum: { multiply: ['items.quantity', 'items.price'] } }` is the value of everything ordered.
- Split by a field of the same rows (`by: 'items.kind'`), it is the rows under each.
- A formula reads the rows of one array, with whatever it likes of the record around them.

These are read record by record: see [limits and performance](./limits-and-performance.md).
