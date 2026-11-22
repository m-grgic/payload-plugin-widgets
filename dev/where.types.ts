// What the generated types let a filter say, and what they do not: compiled with the demo's types (`tsc -p dev`), never
// run. Each `@ts-expect-error` is a filter that must not compile; test/types.test.ts fails where one does.

import type { PayloadRequest } from 'payload'
import { chart, figure, list, raw, readChart, readFigure, readList, source, widgetsPlugin, type Narrowing } from 'payload-plugin-widgets'

const orders = source('orders', {
  label: 'Orders',
  date: 'placedAt',
  dates: { createdAt: 'Created' },
  filters: {
    sold: { label: 'Sold', where: { status: { in: ['paid', 'shipped'] } } },
    // @ts-expect-error a choice the select does not offer
    lost: { label: 'Lost', where: { status: { equals: 'lost' } } },
    // @ts-expect-error a field the collection does not have
    late: { label: 'Late', where: { placed: { less_than: 'today' } } },
    recent: { label: 'Recent', where: { or: [{ placedAt: { greater_than: 'startOfMonth-1m' } }, { createdAt: { greater_than_equal: '2026-01-01' } }] } },
    mine: { label: 'Mine', where: { customer: { equals: 3 } } },
    nested: { label: 'Nested', where: { and: [{ or: [{ total: { greater_than: 10 } }, { total: { exists: false } }] }] } },
    // @ts-expect-error a number is compared with a number
    cheap: { label: 'Cheap', where: { total: { less_than: 'ten' } } },
    // a filter the types cannot follow is said as it is
    other: { label: 'Other', where: raw({ 'customer.country': { equals: 'Croatia' } }) },
  },
  measures: {
    revenue: { sum: 'total', format: 'money' },
    // @ts-expect-error a measure is of a number, not of any text
    wrong: { sum: 'number' },
    // @ts-expect-error nor of a field there is none of
    typo: { sum: 'totl' },
    signed: { sum: { when: { status: { equals: 'refunded' } }, then: { multiply: ['total', -1] }, else: 'total' } },
    // @ts-expect-error a formula chooses by a field there is
    unsigned: { sum: { when: { stauts: { equals: 'refunded' } }, then: 'total' } },
  },
  groups: { status: 'Status' },
})

export const where: Narrowing<'tasks'>[] = [
  { status: { not_equals: 'done' }, dueDate: { less_than: 'today' } },
  { priority: { in: ['high', 'normal'] }, assignee: { exists: true } },
  // @ts-expect-error an operator Payload has none of
  { status: { is: 'done' } },
  // @ts-expect-error a choice of another select
  { priority: { in: ['urgent'] } },
]

export const plugin = widgetsPlugin({
  sources: {
    orders,
    tasks: false,
    // @ts-expect-error only a collection there is can be left out
    invoices: false,
  },
  widgets: [
    figure('goal', orders, { label: 'Goal', measure: 'revenue', as: 'progress', goal: 100 }),
    // @ts-expect-error progress is towards a goal
    figure('no-goal', orders, { label: 'No goal', measure: 'revenue', as: 'progress' }),
    figure('labelled', 'tasks', { label: { en: 'Open', hr: 'Otvoreno' }, action: { label: { en: 'All', hr: 'Sve' }, href: '/admin/collections/tasks' } }),
    // @ts-expect-error a measure said in place is of a number of the collection
    figure('longest', 'tasks', { label: 'Longest', measure: { max: 'title' } }),
    figure('longest-estimate', 'tasks', { label: 'Longest', measure: { max: 'estimate' } }),
    // a declared source with no list named has its first
    list('latest', 'tasks', { label: 'Latest' }),
    chart('by-status', orders, { label: 'By status', by: 'status', measure: { avg: 'total' } }),
    // a date by its path, as a source's `date` takes one
    figure('by-session', 'users', { label: 'Sessions', date: 'sessions.createdAt' }),
    // @ts-expect-error a date of a field there is none of
    figure('by-nothing', 'users', { label: 'Nothing', date: 'sessions.endedAt' }),
    // @ts-expect-error a chart has no settings of its own to trust
    chart('trusting', orders, { label: 'Trusting', overrideAccess: true, access: () => true, trusted: ['period'] }),
  ],
})

// The data alone, by a slug: the collection is inferred from it, so its filters, dates and formulas are checked.
declare const req: PayloadRequest

export const read = [
  // as the 0.5 README has them
  readFigure(req, 'orders', { measure: 'total', period: 'month', compare: 'previous', goal: 5000 }),
  readList(req, 'tasks', { limit: 5 }),
  readChart(req, orders, { measure: 'revenue', by: 'status' }),
  readFigure(req, 'orders', { measure: 'total', access: () => true }),
  readFigure(req, 'orders', { measure: 'total', overrideAccess: true, access: () => true }),
  // a where of the collection the slug is
  readList(req, 'tasks', { where: { assignee: { equals: 1 }, status: { not_equals: 'done' } } }),
  readFigure(req, 'tasks', { where: { dueDate: { less_than: 'today' } }, date: 'dueDate' }),
  readChart(req, 'orders', { where: { or: [{ status: { in: ['paid'] } }, { total: { greater_than: 10 } }] } }),
  // @ts-expect-error a field the collection does not have
  readList(req, 'tasks', { where: { asignee: { equals: 1 } } }),
  // @ts-expect-error a choice of the other collection's select
  readFigure(req, 'tasks', { where: { status: { equals: 'paid' } } }),
  // @ts-expect-error a declared source is checked against its own collection
  readFigure(req, orders, { where: { dueDate: { less_than: 'today' } } }),
  // a name that is no collection's is of a source declared under it, which the types do not know
  readFigure(req, 'sales', { where: { anything: { equals: 1 } }, filter: 'whatever' }),
  // a formula's `when` is of the source's fields
  readFigure(req, orders, { measure: { sum: { when: { status: { equals: 'refunded' } }, then: 'total' } } }),
  readFigure(req, 'orders', { measure: { sum: { when: { status: { equals: 'refunded' } }, then: 'total' } } }),
  readChart(req, 'orders', { measure: [{ avg: 'total' }, { max: { when: { customer: { exists: true } }, then: 'total' } }] }),
  // @ts-expect-error by a field there is none of
  readFigure(req, orders, { measure: { sum: { when: { stauts: { equals: 'refunded' } }, then: 'total' } } }),
  // @ts-expect-error by a slug too
  readFigure(req, 'orders', { measure: { sum: { when: { stauts: { equals: 'refunded' } }, then: 'total' } } }),
  // @ts-expect-error of a chart as of a figure
  readChart(req, orders, { measure: [{ max: { when: { stauts: { exists: true } }, then: 'total' } }] }),
  // a date by its path, as a source's `date` takes one
  readFigure(req, 'users', { date: 'sessions.createdAt', period: 'month' }),
  readList(req, orders, { date: 'placedAt' }),
  // @ts-expect-error a date of a field there is none of
  readFigure(req, 'users', { date: 'sessions.endedAt' }),
  // @ts-expect-error nor of another collection
  readList(req, orders, { date: 'dueDate' }),
]
