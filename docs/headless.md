# On any other page, and the data alone

- [On any other page](#on-any-other-page)
- [The data alone](#the-data-alone)

## On any other page

The same three are server components for any page of the admin, such as a custom view, a field or a tab of a
document:

```tsx
import type { PayloadRequest } from 'payload'
import { Chart, Figure, Records } from 'payload-plugin-widgets/rsc'

export const CustomerSummary = async ({ req, id }: { req: PayloadRequest; id: number }) => (
  <>
    <Figure req={req} source="orders" measure="total" period="month" compare="previous" />
    <Chart req={req} source={orders} measure="revenue" by="time" scope={{ customer: id }} as="line" />
    <Records req={req} source="tasks" where={{ assignee: { equals: req.user?.id } }} quiet />
  </>
)
```

Here `orders` is a [declared source](./sources-and-measures.md#declaring-a-source) with a `customer` scope. A
source named by its slug is typed by that collection, so `where`, `date` and a measure's formula are checked against
its fields, as they are for a declared source. See
[where and dates](./where-and-dates.md#what-the-types-cannot-follow).

| Prop | | |
| --- | --- | --- |
| `req` | `PayloadRequest` | Who is looking. Required. |
| `source` | a declared source, or a name | Required. |
| `filter`, `where`, `period`, `date`, `from`, `to` | | As of a [ready-made widget](./configuration.md#what-all-of-them-take). |
| `scope` | `{ [name]: id }` | Only what belongs to one of something, as the source's `scopes` call it. |
| `access` | Payload's `Access` | Who it is for, on top of the collection's own. See [who sees what](./user-widgets-and-access.md#who-sees-what). |
| `overrideAccess` | `boolean` | `Figure` and `Chart`: read with the server's access. Needs an `access`. See [a total of what somebody may not open](./user-widgets-and-access.md#a-total-of-what-somebody-may-not-open). |
| `label` | `string` or `{ [language]: string }` | What the tile is called, in the language of the request. Named after what it shows where it is left out. |
| `name` | `string` | What it is found by in a stylesheet, as `data-widget`. |
| `as` | `string` | How it is drawn. |
| `quiet` | `boolean` | Leaves no trace where there is nothing to show or the person may not see it. Otherwise a tile says why. |
| `owned` | `boolean` | Set up by whoever looks at it: what is wrong is said to them in production too, in the names the admin shows them. See [errors](./errors.md#on-a-tile). |
| `action` | `{ label, href }` | A link in the head of the tile. |
| `after` | `ReactNode` | Anything at all under what it shows. |
| `measure`, `compare`, `goal`, `note`, `data` | | `Figure` |
| `list`, `limit` | | `Records` |
| `measure`, `by`, `series` | | `Chart` |

Nobody signed in: nothing is drawn.

## The data alone

To draw anything anywhere, such as a page, a component or an endpoint:

```ts
import { readChart, readFigure, readList, Unavailable } from 'payload-plugin-widgets'

const sold = await readFigure(req, 'orders', { measure: 'total', period: 'month', compare: 'previous', goal: 5000 })
// { value: '€2,445.63', amount: 2445.63, note: '+34% on the period before · 49% of €5,000.00', href: '/admin/collections/orders?…',
//   previous: { value: '€1,825.10', amount: 1825.1 }, trend: 'up', goal: { value: '€5,000.00', amount: 5000, share: 0.49 } }

const { rows, note, href } = await readList(req, 'tasks', { limit: 5 })
const { bars, note: total } = await readChart(req, orders, { measure: 'revenue', by: 'customer', scope: { customer: 12 } })
```

They take what the components take, and read as whoever makes the request, in their language and locale:

- Where the source is not for them, or nobody is signed in, `Unavailable` is thrown.
- Where what is picked is not there, `Misconfigured` is thrown, with what is wrong as `problems`. See
  [errors](./errors.md#in-code-of-your-own).
- A read that takes longer than `limits.timeoutMs` throws a `TimedOut`, whose one problem has the code `timed-out`.

Within one request, the same figure or chart asked for twice is read once.
