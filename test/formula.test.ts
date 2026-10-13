import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { CollectionConfig, FlattenedField } from 'payload'
import { dateProblems, formulaProblems, measureProblems } from '../src/check'
import { discovered } from '../src/discover'
import { at, fieldsIn, found, holds, numberOf, pathsOf, valuesAt, worked, type Formula } from '../src/formula'
import { combined, made, tallied, type Cell } from '../src/tally'
import { amountOf, Selection, source, sum, type AnySource, type Context } from '../src/types'

const invoice = {
  id: 1, documentType: 'creditNote', totalAmount: 100, isBillable: true, billableTime: null, workDuration: 90, client: { id: 7 },
  totals: { net: 80, vat: 20, currency: 'USD' },
  items: [{ quantity: 2, price: 10.5, kind: 'goods' }, { quantity: 1, price: 4, kind: 'service' }, { quantity: 3, price: null, kind: 'goods' }],
}
const of = (formula: Formula, doc: unknown = invoice) => worked(formula, path => at(doc, path))

test('a formula is worked out of a record, with nothing counting as nought', () => {
  assert.equal(of(5), 5)
  assert.equal(of('totalAmount'), 100)
  assert.equal(of('nowhere'), 0)
  assert.equal(of({ multiply: ['workDuration', 60] }), 5400)
  assert.equal(of({ add: ['totals.net', 'totals.vat', 1] }), 101)
  assert.equal(of({ subtract: ['totalAmount', 'totals.vat'] }), 80)
  assert.equal(of({ divide: ['workDuration', 60] }), 1.5)
  // by nothing there is nothing to say
  assert.equal(of({ divide: ['workDuration', 'billableTime'] }), 0)
  // the first that has something, and nought is something
  assert.equal(of({ first: ['billableTime', 'workDuration'] }), 90)
  assert.equal(of({ first: ['billableTime', 'workDuration'] }, { billableTime: 0, workDuration: 90 }), 0)
  assert.equal(of({ first: ['billableTime', 'nowhere'] }), 0)
})

test('a formula chooses by what a record has', () => {
  const signed: Formula = { when: { documentType: { equals: 'creditNote' } }, then: { multiply: ['totalAmount', -1] }, else: 'totalAmount' }
  assert.equal(of(signed), -100)
  assert.equal(of(signed, { documentType: 'invoice', totalAmount: 100 }), 100)
  assert.equal(of({ when: { isBillable: { equals: false } }, then: 'workDuration' }), 0)

  const get = (path: string) => at(invoice, path)
  assert.equal(holds({ documentType: { in: ['invoice', 'creditNote'] }, totalAmount: { greater_than: 50, less_than_equal: 100 } }, get), true)
  assert.equal(holds({ or: [{ documentType: { equals: 'offer' } }, { and: [{ isBillable: { equals: true } }, { billableTime: { exists: false } }] }] }, get), true)
  // what is pointed at is compared by its id
  assert.equal(holds({ client: { equals: 7 } }, get), true)
  assert.equal(holds({ client: { not_in: [7, 8] } }, get), false)
  // what has nothing is equal to nothing, is unlike anything, and is neither more nor less
  assert.equal(holds({ billableTime: { equals: 0 } }, get), false)
  assert.equal(holds({ billableTime: { not_equals: 0 } }, get), true)
  assert.equal(holds({ billableTime: { less_than: 5 } }, get), false)
})

test('a number in the rows of an array is all the rows of a record added up', () => {
  assert.deepEqual(valuesAt(invoice, 'items.price'), [10.5, 4, null])
  assert.equal(at(invoice, 'items.price'), undefined)
  assert.equal(numberOf('items.quantity', invoice), 6)
  assert.equal(numberOf({ multiply: ['items.quantity', 'items.price'] }, invoice), 25)
  // a row can be weighed with what the record around it has
  assert.equal(numberOf({ when: { 'items.kind': { equals: 'goods' } }, then: { multiply: ['items.quantity', 'totals.vat'] } }, invoice), 100)
  assert.equal(numberOf('items.quantity', { items: [] }), 0)
  assert.equal(numberOf('totals.net', invoice), 80)
  assert.deepEqual(fieldsIn({ when: { 'items.kind': { equals: 'goods' } }, then: { multiply: ['items.quantity', 'totals.vat'] } }),
    { numbers: ['items.quantity', 'totals.vat'], tested: [['items.kind', { equals: 'goods' }]] })
})

test('what adding fractions up leaves behind is taken off', () => {
  const cell = (sum: number, count = 1): Cell => ({ keys: [], currency: '', count, sum, min: sum, max: sum })
  assert.equal(0.1 + 0.2 === 0.3, false)
  assert.equal(made('sum', [cell(0.1), cell(0.2)]), 0.3)
  assert.equal(made('avg', [cell(0.1 + 0.2, 3)]), 0.1)
  assert.equal(combined('sum', [1222.815, 1222.815, 0.1, -0.1]), 2445.63)
  assert.equal(combined('avg', [0.1, 0.2]), 0.15)
  assert.equal(made('sum', [cell(1e15 + 0.5)]), 1e15 + 0.5)
})

const orders = [invoice, { id: 2, documentType: 'invoice', totalAmount: 50, totals: { net: 40, vat: 10, currency: null }, items: [{ quantity: 4, price: 2, kind: 'service' }] }, { id: 3, documentType: 'invoice', totalAmount: 5, totals: null, items: null }]
const asked: unknown[] = []
const context = {
  payload: { find: async (args: unknown) => (asked.push(args), { docs: orders }), db: { name: 'mongoose' } }, req: {},
  as: { depth: 0, overrideAccess: false, user: { id: 7, collection: 'users' } }, currency: 'EUR', date: (value: string) => value.slice(0, 10),
} as unknown as Context
const from = { slug: 'orders', filters: {}, measures: {} } as unknown as AnySource
const by = (cells: Cell[]) => Object.fromEntries(cells.map(one => [[...one.keys, ...(one.currency ? [one.currency] : [])].join('/'), [one.count, one.sum]]))

test('records are added up by what is in a group and in their rows', async () => {
  const net = await tallied(context, from, new Selection(), amountOf('totals.net', 'money', 'sum', 'totals.currency'), [{ field: 'documentType' }])
  // only what is read is asked for, as Payload takes a field inside another
  assert.deepEqual((asked.at(-1) as { select: unknown }).select, { totals: { net: true, currency: true }, documentType: true })
  assert.deepEqual(by(net.over(0)), { 'creditNote/USD': [1, 80], 'invoice/EUR': [2, 40] })

  const value = await tallied(context, from, new Selection(), amountOf({ multiply: ['items.quantity', 'items.price'] }, 'number'), [{ field: 'items.kind' }, { field: 'documentType' }, { field: 'totals.currency' }])
  // a record counts once, as all its rows come to
  assert.deepEqual(by(value.over()), { '': [3, 33] })
  assert.deepEqual(by(value.over(1)), { creditNote: [1, 25], invoice: [2, 8] })
  // told apart by what the rows have, it is the rows under each; a record without rows is under nothing
  assert.deepEqual(by(value.over(0)), { goods: [1, 21], service: [2, 12], '': [1, 0] })
  assert.deepEqual(by(value.over(0, 1)), { 'goods/creditNote': [1, 21], 'service/creditNote': [1, 4], 'service/invoice': [1, 8], '/invoice': [1, 0] })
  assert.deepEqual(by(value.over(2)), { USD: [1, 25], '': [2, 8] })

  // a number of the record itself, told apart by what its rows have: once under each
  const total = await tallied(context, from, new Selection(), amountOf('totalAmount', 'number'), [{ field: 'items.kind' }])
  assert.deepEqual(by(total.over(0)), { goods: [1, 100], service: [2, 150], '': [1, 5] })
})

const field = (name: string, type: string, more: object = {}) => ({ name, type, ...more }) as unknown as FlattenedField
const fields = [
  field('totalAmount', 'number'), field('documentType', 'select', { options: ['invoice', { label: 'Credit note', value: 'creditNote' }] }), field('issuedAt', 'date'),
  field('totals', 'group', { flattenedFields: [field('net', 'number'), field('currency', 'text')] }),
  field('items', 'array', { flattenedFields: [field('quantity', 'number'), field('price', 'number'), field('deliveredAt', 'date')] }),
  field('extras', 'array', { flattenedFields: [field('fee', 'number')] }),
  field('layout', 'blocks'),
]

test('a field is found by its path through groups and rows', () => {
  assert.equal(found(fields, 'totals.net')?.field.type, 'number')
  assert.equal(found(fields, 'totals.net')?.rows, undefined)
  assert.equal(found(fields, 'items.price')?.rows, 'items')
  assert.deepEqual(found(fields, 'items.price')?.way.map(one => one.name), ['items', 'price'])
  assert.equal(found(fields, 'totalAmount.net'), undefined)
  assert.equal(found(fields, 'layout.anything'), undefined)
  assert.deepEqual(pathsOf(fields, one => one.type === 'number'), ['totalAmount', 'totals.net', 'items.quantity', 'items.price', 'extras.fee'])
})

test('a formula that reads what is not there says so before anything is read', () => {
  const said = (formula: unknown) => formulaProblems('orders', fields, formula as Formula).map(problem => problem.text)
  assert.deepEqual(said({ multiply: ['items.quantity', 'items.price'] }), [])
  assert.deepEqual(said({ when: { documentType: { equals: 'creditNote' } }, then: { multiply: ['totalAmount', -1] }, else: 'totals.net' }), [])
  assert.match(said({ multiply: ['items.quantity', 'items.prize'] })[0], /has no number called/)
  assert.match(said({ add: ['totals.currency'] })[0], /has no number called/)
  assert.match(said({ when: { documentType: { equals: 'credit' } }, then: 'totalAmount' })[0], /has no choice called/)
  assert.match(said({ when: { documentTyp: { equals: 'invoice' } }, then: 'totalAmount' })[0], /has no field called/)
  assert.match(said({ when: { documentType: { like: 'invoice' } }, then: 'totalAmount' })[0], /is not a way to compare/)
  assert.match(said({ add: ['items.price', 'extras.fee'] })[0], /rows of one array/)
  assert.match(said({ subtract: ['totalAmount'] })[0], /A formula is a number/)
  assert.match(said({ times: ['totalAmount', 2] })[0], /A formula is a number/)

  const orders = { slug: 'orders', measures: {} } as unknown as AnySource
  assert.deepEqual(measureProblems(orders, fields, { sum: 'items.price' }), [])
  assert.deepEqual(measureProblems(orders, fields, { avg: { divide: ['totals.net', 'totalAmount'] } }), [])
  assert.equal(measureProblems(orders, fields, { sum: 'items.prize' }).length, 1)
  assert.deepEqual(dateProblems('orders', fields, 'issuedAt'), [])
  assert.match(dateProblems('orders', fields, 'items.deliveredAt')[0].text, /rows of an array/)
})

test('a collection offers what is inside its groups, named tabs and rows', () => {
  const collection: CollectionConfig = {
    slug: 'orders', fields: [
      { name: 'total', type: 'number' },
      { name: 'totals', type: 'group', label: 'Totals', fields: [
        { type: 'row', fields: [{ name: 'net', type: 'number', label: 'Net', custom: { widgets: { format: 'money', currency: 'currency' } } }, { name: 'currency', type: 'text' }] },
        { name: 'settledAt', type: 'date' },
      ] },
      { type: 'tabs', tabs: [
        { label: 'Shown', fields: [{ name: 'status', type: 'select', options: ['open', 'paid'] }] },
        { name: 'shipping', label: 'Shipping', fields: [{ name: 'cost', type: 'number', label: 'Cost' }, { name: 'carrier', type: 'relationship', relationTo: 'carriers' }] },
      ] },
      { name: 'items', type: 'array', label: 'Items', fields: [
        { name: 'price', type: 'number', label: 'Price' }, { name: 'kind', type: 'select', options: ['goods'] }, { name: 'deliveredAt', type: 'date' },
        { name: 'product', type: 'relationship', relationTo: 'products' }, { name: 'parts', type: 'array', fields: [{ name: 'weight', type: 'number' }] },
      ] },
      { name: 'layout', type: 'blocks', blocks: [{ slug: 'text', fields: [{ name: 'words', type: 'number' }] }] },
      { name: 'secret', type: 'group', admin: { hidden: true }, fields: [{ name: 'margin', type: 'number' }] },
    ],
  }
  const found = discovered(collection)
  assert.deepEqual(Object.keys(found.measures), ['count', 'total', 'totals.net', 'shipping.cost', 'items.price'])
  assert.equal(found.measures['totals.net'].label, 'Totals: Net')
  assert.deepEqual(found.measures['totals.net'].amount?.plain, { field: 'totals.net', currency: 'totals.currency' })
  assert.deepEqual(Object.keys(found.groups ?? {}), ['status', 'shipping.carrier', 'items.kind', 'items.product'])
  // a period goes by a date of the record itself, and a record is one of what it points at itself
  assert.deepEqual(Object.keys(found.dates ?? {}), ['createdAt', 'updatedAt', 'totals.settledAt'])
  assert.deepEqual(Object.keys(found.scopes ?? {}), ['shipping.carrier'])
  assert.deepEqual(found.scopes?.['shipping.carrier'](3), { 'shipping.carrier': { equals: 3 } })
})

test('a measure is declared as a formula, in a source and with sum', () => {
  const tasks = source('tasks' as never, { measures: { minutes: { sum: { multiply: ['estimatedTime', 60] } as never, format: 'number' } } }) as unknown as AnySource
  const { amount } = tasks.measures.minutes
  assert.deepEqual(amount?.plain, { formula: { multiply: ['estimatedTime', 60] } })
  assert.deepEqual(amount?.select, ['estimatedTime'])
  assert.equal(amount?.of({ estimatedTime: 2 } as never), 120)

  const signed = sum<never>('Amount', 'totalAmount' as never, 'money', { of: { when: { documentType: { equals: 'creditNote' } }, then: { multiply: ['totalAmount', -1] }, else: 'totalAmount' } as never }).amount
  assert.deepEqual(signed?.select, ['totalAmount', 'documentType'])
  assert.equal(signed?.plain?.field, 'totalAmount')
  assert.equal(signed?.of(invoice as never), -100)
  // what a function makes of a record the database cannot be asked
  assert.equal(sum<never>('Amount', 'totalAmount' as never, 'money', { of: () => 1 }).amount?.plain, undefined)
})
