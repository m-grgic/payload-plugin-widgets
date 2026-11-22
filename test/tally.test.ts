import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Config, PayloadRequest } from 'payload'
import { contextFor } from '../src/context'
import { widgetsPlugin } from '../src/index'
import { readFigure } from '../src/read'
import { counted, fetched, forgotten, made, MANY, tallied, type Cell } from '../src/tally'
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

  // without a cache, what one request asks twice is read once for it, and again for the next request
  const plain = reading()
  await tallied(plain.context, source, selection, amount)
  await tallied(plain.context, source, selection, amount)
  assert.equal(plain.asked.times, 1)
  await tallied({ ...plain.context, req: {} } as unknown as Context, source, selection, amount)
  assert.equal(plain.asked.times, 2)
})

test('an average, a lowest and a highest of a field pass over the records that have nothing in it; a sum counts them as nought', async () => {
  const { context } = reading()
  const of = async (how: 'sum' | 'avg' | 'min' | 'max') => by((await tallied(context, source, new Selection(), amountOf('total', 'number', how))).over())
  assert.deepEqual(await of('sum'), { '': [3, 40, 0, 30] })
  for (const how of ['avg', 'min', 'max'] as const) assert.deepEqual(await of(how), { '': [2, 40, 10, 30] })
  const avg = await tallied(context, source, new Selection(), amountOf('total', 'number', 'avg'))
  assert.equal(made('avg', avg.over()), 20)
  assert.equal(made('min', avg.over()), 10)
  // a formula keeps nought for what has nothing
  const formula = await tallied(context, source, new Selection(), amountOf({ multiply: ['total', 1] }, 'number', 'avg'))
  assert.deepEqual(by(formula.over()), { '': [3, 40, 0, 30] })
})

test('the ways of telling records apart can be asked in any order', async () => {
  const { context } = reading()
  const { over } = await tallied(context, source, new Selection(), amountOf('total', 'number', 'sum'), [{ field: 'status' }, { field: 'tags' }])
  assert.deepEqual(by(over(1, 0)), Object.fromEntries(Object.entries(by(over(0, 1))).map(([name, value]) => [name.split('/').slice(0, 2).reverse().join('/') + '/', value])))
})

/** A context whose collection has so many records, and what it was asked. */
const many = (length: number, more: Partial<AnySource> = {}) => {
  const asked: Record<string, unknown>[] = []
  const docs = Array.from({ length }, (_, index) => ({ id: index + 1, total: 1 }))
  const answer = async (args: Record<string, unknown>) => {
    asked.push(args)
    return { docs: docs.slice(0, Number(args.limit) || docs.length), totalDocs: docs.length }
  }
  const context = { ...reading().context, payload: { find: answer, count: answer, db: { name: 'mongoose' } } } as unknown as Context
  return { context, asked, from: { ...source, ...more } as AnySource }
}

test('as many records as are read at once are all of them; one more is not', async () => {
  const exactly = many(MANY)
  const all = await tallied(exactly.context, exactly.from, new Selection(), amountOf('total', 'number', 'sum'))
  assert.equal(all.cut, false)
  assert.equal(made('sum', all.over()), MANY)
  assert.equal(exactly.asked[0].limit, MANY + 1)

  const more = many(MANY + 1)
  const some = await tallied(more.context, more.from, new Selection(), amountOf('total', 'number', 'sum'))
  assert.equal(some.cut, true)
  assert.equal(made('sum', some.over()), MANY)
  // what a measure of the project's own reads is still at most that many
  assert.equal((await fetched(more.context, more.from, new Selection(), ['total'])).length, MANY)
})

test('a collection with drafts is counted, however many there are, as the admin lists them', async () => {
  const drafts = many(12000, { draft: true })
  assert.equal(await counted(drafts.context, drafts.from, new Selection()), 12000)
  assert.equal(drafts.asked.length, 1)
  assert.equal(drafts.asked[0].draft, true)
  assert.equal(drafts.asked[0].limit, 1)
  // and what its sums read says it did not read them all
  assert.equal((await tallied(drafts.context, drafts.from, new Selection(), amountOf('total', 'number', 'sum'))).cut, true)
})

test('what is kept is what the records come to, not the records', async () => {
  const kept = (globalThis as Record<symbol, Map<string, { value: Promise<unknown> }>>)[Symbol.for('payload-plugin-widgets.kept')]
  kept?.clear()
  const { context, asked } = reading({ cache: 60 })
  const amount = amountOf('total', 'number', 'avg')
  const first = await tallied(context, source, new Selection(), amount, [{ field: 'status' }])
  const again = await tallied(context, source, new Selection(), amount, [{ field: 'status' }])
  assert.equal(asked.times, 1)
  assert.deepEqual(by(again.over(0)), by(first.over(0)))
  const store = (globalThis as Record<symbol, Map<string, { value: Promise<unknown> }>>)[Symbol.for('payload-plugin-widgets.kept')]
  for (const { value } of store.values()) {
    const held = await value
    assert.ok(!Array.isArray(held), 'records were kept')
  }
  // the records a measure of the project's own reads are not kept at all
  await fetched(context, source, new Selection(), ['total'])
  await fetched(context, source, new Selection(), ['total'])
  assert.equal(asked.times, 3)
})

// A Payload whose orders are only those of the team the request says it is from, in a header: as Payload reads with
// a request of its own where none is passed, one without the header sees none of them.
const TEAM = ({ req }: { req: PayloadRequest }) => ({ team: { equals: req.headers?.get('x-team') ?? null } })
const teams = [
  { id: 1, team: 'north', total: 10, createdAt: '2026-11-01T10:00:00.000Z' },
  { id: 2, team: 'south', total: 5, createdAt: '2026-11-01T10:00:00.000Z' },
  { id: 3, team: 'north', total: null, createdAt: '2026-11-01T10:00:00.000Z' },
]
const shop = async () => {
  const fields = [{ name: 'team', type: 'text' }, { name: 'total', type: 'number' }, { name: 'createdAt', type: 'date' }]
  const built = await widgetsPlugin({ sources: { orders: source as never } })({ collections: [{ slug: 'orders', fields }] } as unknown as Config)
  const asked: Record<string, unknown>[] = []
  const visible = (args: Record<string, unknown>) => {
    asked.push(args)
    const req = (args.req ?? { headers: new Headers() }) as PayloadRequest
    return teams.filter(doc => doc.team === TEAM({ req }).team.equals)
  }
  const payload = {
    config: { ...built, routes: { admin: '/admin' } },
    collections: { orders: { config: { slug: 'orders', fields, flattenedFields: fields, access: { read: TEAM }, hooks: {} } } },
    db: { name: 'mongoose' },
    find: async (args: Record<string, unknown>) => ({ docs: visible(args), totalDocs: visible(args).length }),
    count: async (args: Record<string, unknown>) => ({ totalDocs: visible(args).length }),
  }
  const req = { payload, user: { id: 1, collection: 'users' }, headers: new Headers({ 'x-team': 'north' }), locale: 'hr' } as unknown as PayloadRequest
  return { req, asked }
}

test('records read one by one are read with the request itself, as the database adds them up', async () => {
  const { req, asked } = await shop()
  const context = contextFor(req)
  assert.equal((await readFigure(context, { source: 'orders' })).value, '2')
  assert.equal((await readFigure(context, { source: 'orders', measure: { sum: 'total' } })).amount, 10)
  assert.equal((await readFigure(context, { source: 'orders', measure: { avg: 'total' } })).amount, 10)
  assert.ok(asked.length >= 3)
  for (const args of asked) {
    assert.equal(args.req, req)
    assert.equal(args.locale, 'hr')
  }
})

test('the last 30 days are thirty, today the last of them', async () => {
  const { req, asked } = await shop()
  await readFigure({ ...contextFor(req), today: '2026-11-22' }, { source: 'orders', period: 'last30' })
  assert.match(JSON.stringify(asked.at(-1)?.where), /"greater_than_equal":"2026-10-24T00:00:00.000Z"/)
})
