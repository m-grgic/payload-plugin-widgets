# Where and dates

- [Filters](#filters)
- [Typed against the collection](#typed-against-the-collection)
- [What the types cannot follow](#what-the-types-cannot-follow)
- [Moments](#moments)
- [Periods](#periods)
- [Which date a period goes by](#which-date-a-period-goes-by)

## Filters

`where` is a filter as Payload takes them anywhere, `and` and `or` included. It is taken by:

- a ready-made widget,
- a source's filter,
- a component,
- `readFigure`, `readList` and `readChart`.

```ts
where: { or: [{ status: { equals: 'paid' } }, { and: [{ status: { equals: 'shipped' } }, { total: { greater_than: 100 } }] }] }
```

A widget's `where` is on top of its `filter`, where it has both. In the drawer it is Payload's own filter builder,
"Only those where".

## Typed against the collection

With `payload-types.ts` generated, a `where` is typed against its collection:

- **Fields.** Each one has to be a field the collection has. Paths go through groups, named tabs and arrays, two
  levels deep: `'totals.net'`, `'items.kind'`.
- **Operators.** Each has to be one Payload has: `equals`, `not_equals`, `in`, `not_in`, `all`, `exists`,
  `greater_than`, `greater_than_equal`, `less_than`, `less_than_equal`, `like`, `not_like`, `contains`, `near`,
  `within` and `intersects`.
- **Values.** A select or a radio takes only its own choices. A number is compared with a number. A date is
  compared with a date, an instant or a [moment](#moments). A relationship is compared by the id it points at.

```ts
import type { Narrowing } from 'payload-plugin-widgets'

const overdue: Narrowing<'tasks'> = { dueDate: { less_than: 'today' }, status: { not_equals: 'done' } }

// none of these compile
const wrong: Narrowing<'tasks'>[] = [
  { status: { is: 'done' } },            // an operator Payload has none of
  { priority: { in: ['urgent'] } },      // a choice the select does not offer
  { dueDat: { less_than: 'today' } },    // a field the collection does not have
]
```

The types are `Narrowing<'slug'>` (what a `where` takes), `WhereOf<Doc>` and `FieldWhere<Value>`. There are no
generated types, or the `Config` cannot be read? Then a `where` is Payload's `Where`, and anything goes until the
config is built.

**What is still checked as the config is built** is the same, whatever the types said. This applies to a filter
written with `raw(…)` as well:

- the field is there;
- the operator is one of those above;
- a select's choice is one it has, for `equals`, `not_equals`, `in`, `not_in` and `all`;
- a date is a date (`YYYY-MM-DD`, or an instant) or a moment.

A problem stops the config from being built, or Payload as it starts: see [errors](./errors.md).

**For the person looking.** On a tile, what is wrong with a filter names no field the person looking may not read,
unless the widget reads with `overrideAccess`.

## What the types cannot follow

`raw(…)` gives a filter as it is, for what the types do not follow, such as a path into the collection a
relationship points at:

```ts
import { figure, raw } from 'payload-plugin-widgets'

figure('croatia', 'orders', { label: 'From Croatia', where: raw({ 'customer.country': { equals: 'Croatia' } }) })
```

A component or a `read*` function given a collection by its slug works out the collection from it, as one given a
declared source does, so its `where` is checked against that collection's fields:

```tsx
<Records req={req} source="tasks" where={{ assignee: { equals: req.user?.id } }} quiet />
```

A name that is no collection's slug is that of a source declared under another name, which the types cannot see:
anything Payload takes is taken there, as it is everywhere without `payload-types.ts`.

## Moments

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

A moment is taken where a date is compared with `equals`, `not_equals`, `in`, `not_in`, `greater_than`,
`greater_than_equal`, `less_than` and `less_than_equal`. A day starts where the `timeZone` option says, a week on
the day `weekStartsOn` says. The type is `Moment`. A text that is neither a date nor a moment, on a date field, is
a problem: `dueDate is a date: "tomorow" is neither a date (YYYY-MM-DD) nor a moment such as "today" or
"startOfMonth-1m"`.

## Periods

| `period` | |
| --- | --- |
| `all` | any time (the default) |
| `today` | |
| `past` | before today |
| `upcoming` | from today on |
| `month`, `year` | this month or this year, to date |
| `last30`, `last12` | the last 30 days, the last 12 months |
| `custom` | between `from` and `to`, as `YYYY-MM-DD`; either may be left out |

`PERIODS` lists them with what the drawer calls them. A figure with `compare: 'previous'` needs a period that has
a beginning: not `all`, `past` or `upcoming`, and `custom` only with a `from`.

## Which date a period goes by

A source's own date is the one a period, and a chart over time, go by. It comes from one of these, the first that
is there:

1. the `date` of a declared source,
2. `custom.widgets.date` on the collection,
3. `createdAt`.

A widget can go by another with `date`; in the drawer that is "Going by", where the source has more than one.
A date has to be a date field of the record itself. One in the rows of an array is refused:
`"items.shippedAt" of orders is in the rows of an array: a period goes by a date of the record itself`.
