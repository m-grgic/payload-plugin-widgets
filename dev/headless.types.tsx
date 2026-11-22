// What the components for any page take, with the demo's types (`tsc -p dev`), never run: as where.types.ts, each
// `@ts-expect-error` must be an error, or test/types.test.ts fails.

import type { PayloadRequest } from 'payload'
import { raw, source } from 'payload-plugin-widgets'
import { Chart, Figure, Records } from 'payload-plugin-widgets/rsc'

declare const req: PayloadRequest

const orders = source('orders', {
  label: 'Orders',
  date: 'placedAt',
  measures: { revenue: { sum: 'total', format: 'money' } },
  groups: { status: 'Status', customer: 'Customer' },
  scopes: { customer: id => ({ customer: { equals: id } }) },
})

// as the 0.5 README has it, its `req` and `id` untyped
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ProjectSummary = async ({ req, id }: any) => (
  <>
    <Figure req={req} source="orders" measure="total" period="month" compare="previous" />
    <Chart req={req} source={orders} measure="revenue" by="customer" scope={{ customer: id }} as="line" />
    <Records req={req} source="tasks" where={{ assignee: { equals: req.user.id } }} quiet />
  </>
)

// as docs/headless.md has it
export const CustomerSummary = async ({ id }: { id: number }) => (
  <>
    <Figure req={req} source="orders" measure="total" period="month" compare="previous" />
    <Chart req={req} source={orders} measure="revenue" by="time" scope={{ customer: id }} as="line" />
    <Records req={req} source="tasks" where={{ assignee: { equals: req.user?.id } }} quiet />
    <Records req={req} source="tasks" where={raw({ 'assignee.email': { like: '@' } })} quiet />
  </>
)

export const typed = [
  <Records key="a" req={req} source="tasks" where={{ assignee: { equals: 1 }, status: { not_equals: 'done' } }} />,
  <Figure key="b" req={req} source="tasks" where={{ dueDate: { less_than: 'today' } }} date="dueDate" />,
  <Chart key="c" req={req} source="orders" where={{ status: { in: ['paid', 'shipped'] } }} by="time" />,
  <Figure key="d" req={req} source="users" date="sessions.createdAt" period="month" />,
  <Figure key="e" req={req} source={orders} measure={{ sum: { when: { status: { equals: 'refunded' } }, then: 'total' } }} />,
  // a name that is no collection's is of a source declared under it, which the types do not know
  <Figure key="f" req={req} source="sales" where={{ anything: { equals: 1 } }} filter="whatever" />,
  // a label in several languages, said in the request's
  <Figure key="g" req={req} source="orders" label={{ en: 'Sold', hr: 'Prodano' }} />,
  <Records key="h" req={req} source={orders} label="Orders" />,
  <Chart key="i" req={req} source="orders" label={{ en: 'By status', hr: 'Po statusu' }} by="status" />,
  // @ts-expect-error a field the collection does not have
  <Records key="j" req={req} source="tasks" where={{ asignee: { equals: 1 } }} />,
  // @ts-expect-error a choice its select does not offer
  <Figure key="k" req={req} source="tasks" where={{ status: { equals: 'paid' } }} />,
  // @ts-expect-error a declared source by its own collection
  <Chart key="l" req={req} source={orders} where={{ dueDate: { exists: true } }} />,
  // @ts-expect-error a date there is none of
  <Figure key="m" req={req} source="users" date="sessions.endedAt" />,
  // @ts-expect-error a formula chooses by a field there is
  <Figure key="n" req={req} source="orders" measure={{ sum: { when: { stauts: { equals: 'refunded' } }, then: 'total' } }} />,
  // @ts-expect-error a label is words
  <Figure key="o" req={req} source="orders" label={{ en: 1 }} />,
  // @ts-expect-error nor a number
  <Records key="p" req={req} source="tasks" label={3} />,
]
