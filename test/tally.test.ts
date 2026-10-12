import assert from 'node:assert/strict'
import { test } from 'node:test'
import { forgotten, made, tallied, type Cell } from '../src/tally'
import { amountOf, Selection, type AnySource, type Context } from '../src/types'

const cell = (keys: string[], count: number, sum: number, min: number, max: number): Cell => ({ keys, currency: '', count, sum, min, max })

test('what was added up apart is made one as the records would be', () => {
  const cells = [cell(['a'], 2, 10, 4, 6), cell(['b'], 1, 20, 20, 20), cell(['c'], 0, 0, 0, 0)]
  assert.equal(made('sum', cells), 30)
  assert.equal(made(undefined, cells), 30)
  // of all three records, not of the two averages
  assert.equal(made('avg', cells), 10)
  assert.equal(made('min', cells), 4)
  assert.equal(made('max', cells), 20)
  assert.equal(made('avg', []), 0)
  assert.equal(made('min', [cell(['c'], 0, 0, 0, 0)]), 0)
})

const orders = [
  { id: 1, total: 10, currency: 'eur', status: 'paid', tags: ['a', 'b'], placedAt: '2026-03-31T23:30:00.000Z' },
  { id: 2, total: 30, currency: null, status: 'paid', tags: [], placedAt: '2026-04-10T10:00:00.000Z' },
  { id: 3, total: null, currency: 'USD', status: null, tags: ['a'], placedAt: null },
]

/** A context that reads the records above, and counts how often it is asked for them. */
const reading = (more: Partial<Context> = {}) => {
  const asked = { times: 0 }
  const find = async () => {
    asked.times += 1
    return { docs: orders }
  }
  const context = {
    payload: { find, db: { name: 'mongoose' } }, req: {}, as: { depth: 0, overrideAccess: false, user: { id: 7, collection: 'users' } },
    currency: 'EUR', date: (value: string) => new Date(Date.parse(value) + 2 * 3600000).toISOString().slice(0, 10), ...more,
  } as unknown as Context
  return { context, asked }
}
const source = { slug: 'orders', filters: {}, measures: {} } as unknown as AnySource
const by = (cells: Cell[]) => Object.fromEntries(cells.map(one => [[...one.keys, one.currency].join('/'), [one.count, one.sum, one.min, one.max]]))

test('records are told apart by what they have in a field, by the day in the zone, and by their currency', async () => {
  const { context } = reading()
  const { over, cut } = await tallied(context, source, new Selection(), amountOf('total', 'money', 'sum', 'currency'), [{ field: 'status' }, { date: 'placedAt', daily: false }, { field: 'tags' }])
  assert.equal(cut, false)
  // one that says no currency is in the one the widgets were given, and one without the number counts as nought
  assert.deepEqual(by(over()), { EUR: [2, 40, 10, 30], USD: [1, 0, 0, 0] })
  assert.deepEqual(by(over(0)), { 'paid/EUR': [2, 40, 10, 30], '/USD': [1, 0, 0, 0] })
  // half past eleven at night is already April two hours east
  assert.deepEqual(by(over(1)), { '2026-04/EUR': [2, 40, 10, 30], '/USD': [1, 0, 0, 0] })
  // one with several counts under each, and one with none under nothing
  assert.deepEqual(by(over(2)), { 'a/EUR': [1, 10, 10, 10], 'b/EUR': [1, 10, 10, 10], '/EUR': [1, 30, 30, 30], 'a/USD': [1, 0, 0, 0] })
  assert.deepEqual(by(over(0, 2))['paid/a/EUR'], [1, 10, 10, 10])
})

test('what was read is kept for whoever asked, for as long as it was said, and until a record changes', async () => {
  const amount = amountOf('total', 'number', 'sum')
  const { context, asked } = reading({ cache: 60 })
  const selection = new Selection([[{ total: { greater_than: 0 } }]])
  await tallied(context, source, selection, amount)
  await tallied(context, source, selection, amount)
  assert.equal(asked.times, 1)
  // somebody else may read something else
  await tallied({ ...context, as: { ...context.as, user: { id: 8, collection: 'users' } } } as unknown as Context, source, selection, amount)
  assert.equal(asked.times, 2)
  await tallied(context, source, new Selection(), amount)
  assert.equal(asked.times, 3)
  forgotten('orders')
  await tallied(context, source, selection, amount)
  assert.equal(asked.times, 4)

  const plain = reading()
  await tallied(plain.context, source, selection, amount)
  await tallied(plain.context, source, selection, amount)
  assert.equal(plain.asked.times, 2)
})
