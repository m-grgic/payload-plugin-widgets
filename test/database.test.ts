import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { after, before, test } from 'node:test'
import { postgresAdapter } from '@payloadcms/db-postgres'
import * as exported from 'payload'
import { buildConfig, getPayload, type Payload, type PayloadRequest, type Where } from 'payload'
import { contextFor } from '../src/context'
import { widgetsPlugin } from '../src/index'
import { settingsOf } from '../src/options'
import { readChart, readFigure, type ChartPick, type FigurePick } from '../src/read'
import { tallied, TimedOut } from '../src/tally'
import { amountOf, Selection } from '../src/types'

// What the database adds up has to come to what reading every record does. Each figure and chart below is read both
// ways from a real Postgres and compared, and the ones the database can answer must not have read a single record.
// Run where DATABASE_URI names a database that may be emptied: `DATABASE_URI=postgres://… pnpm test`.

// A request of the local API, as a server component is handed one. Payload 3 makes it with `createLocalReq(args,
// payload)`, which 4 no longer exports; 4 makes it with `createPayloadRequest({ ...args, payload })`. Payload 3 has a
// `createPayloadRequest` too, of another kind (out of a web Request), so the two are told apart by `createLocalReq`.
const createLocalReq = (args: { user?: PayloadRequest['user'] }, payload: Payload): Promise<PayloadRequest> => {
  const of = exported as unknown as Record<string, (...args: unknown[]) => Promise<PayloadRequest>>
  return typeof of.createLocalReq === 'function' ? of.createLocalReq(args, payload) : of.createPayloadRequest({ ...args, payload })
}

const uri = process.env.DATABASE_URI
const skip = uri ? false : 'DATABASE_URI is not set'

// a little shop: numbers with fractions and gaps, a group, a named tab, rows, and dates around midnight
const STATUSES = ['pending', 'paid', 'shipped', 'refunded'] as const
let seedOf = 7
const dice = (sides: number) => ((seedOf = (Math.imul(seedOf, 1103515245) + 12345) >>> 0) >>> 16) % sides
const some = <T>(value: T, gaps = 5): T | null => (dice(gaps) ? value : null)
const orders = (customers: number[]) => Array.from({ length: 60 }, (_, index) => ({
  number: `A-${index + 1}`,
  customer: some(customers[dice(customers.length)], 6),
  status: some(STATUSES[dice(STATUSES.length)], 8),
  paid: some(dice(2) === 1, 7),
  total: some(dice(40000) / 100),
  quantity: some(dice(9)),
  price: some(dice(1000) / 10),
  discount: some(dice(300) / 100, 2),
  placedAt: some(new Date(Date.UTC(2026, dice(3), 1 + dice(28), dice(4) ? dice(24) : 23, 30)).toISOString(), 9),
  totals: { net: some(dice(30000) / 100), vat: some(dice(7000) / 100), currency: some(['EUR', 'USD', 'eur'][dice(3)], 3), region: some(['north', 'south'][dice(2)], 4) },
  shipping: { cost: some(dice(2000) / 100), carrier: some(['post', 'courier'][dice(2)], 4) },
  items: Array.from({ length: dice(4) }, () => ({ quantity: some(1 + dice(5)), price: some(dice(5000) / 100), kind: some(['goods', 'service'][dice(2)], 4) })),
}))

let payload: Payload
let req: PayloadRequest
let seeded: ReturnType<typeof orders>
const reads = { count: 0 }
const warned: unknown[] = []

before(async () => {
  if (!uri) return
  // an empty database every time, so that nothing has to be asked about what was there
  const { Client } = createRequire(import.meta.resolve('@payloadcms/db-postgres'))('pg') as { Client: new (options: object) => { connect(): Promise<void>; query(text: string): Promise<unknown>; end(): Promise<void> } }
  const client = new Client({ connectionString: uri })
  await client.connect()
  await client.query('drop schema if exists public cascade; create schema public;')
  await client.end()

  payload = await getPayload({
    config: buildConfig({
      secret: 'only-for-the-test',
      db: postgresAdapter({ pool: { connectionString: uri }, push: true }),
      telemetry: false,
      collections: [
        { slug: 'users', auth: true, fields: [] },
        { slug: 'customers', fields: [{ name: 'name', type: 'text' }] },
        // only those of the team the request says it is from, in a header
        {
          slug: 'tickets',
          access: { read: ({ req }) => { const team = req.headers?.get('x-team'); return team ? { team: { equals: team } } : false } },
          fields: [{ name: 'team', type: 'text' }, { name: 'hours', type: 'number' }],
        },
        // more shops and kinds than a chart has bars for, and sums that come out the same
        { slug: 'sales', fields: [
          { name: 'shop', type: 'select', options: Array.from({ length: 30 }, (_, index) => `shop-${String(index + 1).padStart(2, '0')}`) },
          { name: 'kind', type: 'select', options: Array.from({ length: 12 }, (_, index) => `kind-${index}`) },
          { name: 'amount', type: 'number' },
        ] },
        // what a hook does to a record, only reading it does
        { slug: 'notes', hooks: { beforeRead: [({ doc }) => doc] }, fields: [{ name: 'hours', type: 'number' }] },
        {
          slug: 'orders',
          fields: [
            { name: 'number', type: 'text' },
            { name: 'customer', type: 'relationship', relationTo: 'customers' },
            { name: 'status', type: 'select', options: [...STATUSES] },
            { name: 'paid', type: 'checkbox' },
            { name: 'total', type: 'number' },
            { name: 'quantity', type: 'number' },
            { name: 'price', type: 'number' },
            { name: 'discount', type: 'number' },
            { name: 'placedAt', type: 'date' },
            { name: 'totals', type: 'group', fields: [
              { name: 'net', type: 'number', custom: { widgets: { format: 'money', currency: 'currency' } } },
              { name: 'vat', type: 'number' },
              { name: 'currency', type: 'text' },
              { name: 'region', type: 'select', options: ['north', 'south'] },
            ] },
            { type: 'tabs', tabs: [{ name: 'shipping', fields: [{ name: 'cost', type: 'number' }, { name: 'carrier', type: 'select', options: ['post', 'courier'] }] }] },
            { name: 'items', type: 'array', fields: [{ name: 'quantity', type: 'number' }, { name: 'price', type: 'number' }, { name: 'kind', type: 'select', options: ['goods', 'service'] }] },
          ],
        },
      ],
      plugins: [widgetsPlugin({ timeZone: 'Europe/Zagreb', dashboard: false } as never)],
    }),
  })
  // the records are put in with the server's access, said out loud: Payload 4's local API no longer assumes it
  const user = await payload.create({ overrideAccess: true, collection: 'users', data: { email: 'test@example.com', password: 'test-only' } })
  const customers = await Promise.all(['Ana', 'Ben', 'Cy'].map(name => payload.create({ overrideAccess: true, collection: 'customers' as never, data: { name } as never })))
  seeded = orders(customers.map(customer => customer.id as number))
  for (const data of seeded) await payload.create({ overrideAccess: true, collection: 'orders' as never, data: data as never })
  req = await createLocalReq({ user: { ...user, collection: 'users' } as never }, payload)
  for (const [team, hours] of [['north', 2], ['north', null], ['north', 5], ['south', 40]] as const) await payload.create({ overrideAccess: true, collection: 'tickets' as never, data: { team, hours } as never })
  for (let index = 0; index < 240; index += 1) {
    const shop = index % 17 === 0 ? null : `shop-${String(1 + dice(30)).padStart(2, '0')}`
    await payload.create({ overrideAccess: true, collection: 'sales' as never, data: { shop, kind: some(`kind-${dice(12)}`, 9), amount: some(1 + dice(6), 7) } as never })
  }
  for (const hours of [1, 2, 4]) await payload.create({ overrideAccess: true, collection: 'notes' as never, data: { hours } as never })

  const { find } = payload
  payload.find = ((args: Parameters<typeof find>[0]) => {
    if ((args.collection as string) === 'orders') reads.count += 1
    return find.call(payload, args)
  }) as typeof find
  const { warn } = payload.logger
  payload.logger.warn = ((...args: unknown[]) => (warned.push(args[0]), (warn as (...all: unknown[]) => void).apply(payload.logger, args))) as typeof warn
})

after(async () => {
  await payload?.destroy()
  // Payload keeps a thing or two going that nothing here can close
  if (payload) setTimeout(() => process.exit(), 1000).unref()
})

/** The same read both ways, and how many times the records were read for the database's. */
const both = async <T>(read: (sums: 'database' | 'records') => Promise<T>) => {
  const records = await read('records')
  reads.count = 0
  const database = await read('database')
  return { records, database, reads: reads.count }
}
const figure = (pick: Omit<FigurePick, 'source'>) => both(sums => readFigure({ ...contextFor(req), sums }, { source: 'orders', ...pick }))
const chart = (pick: Omit<ChartPick, 'source'>) => both(sums => readChart({ ...contextFor(req), sums }, { source: 'orders', ...pick }))
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value))

const FIGURES: Record<string, FigurePick['measure']> = {
  'how many': undefined,
  'a sum': 'total',
  'an average': { avg: 'total' },
  'the least': { min: 'price' },
  'the most': { max: 'price' },
  'a number in a group, in its own currency': 'totals.net',
  'a number in a named tab': { sum: 'shipping.cost' },
  'one number times another': { sum: { multiply: ['quantity', 'price'] } },
  'added, taken away and divided': { sum: { divide: [{ subtract: [{ add: ['totals.net', 'totals.vat'] }, 'discount'] }, 'quantity'] } },
  'times a number written out': { avg: { multiply: ['total', 1.25] } },
  'the first that has something': { sum: { first: ['discount', 'totals.vat', 'price'] } },
  'by a choice': { sum: { when: { status: { equals: 'refunded' } }, then: { multiply: ['total', -1] }, else: 'total' } },
  'by a tick': { sum: { when: { paid: { equals: true } }, then: { first: ['discount', 'total'] } } },
  'by not being something': { sum: { when: { status: { not_equals: 'paid' } }, then: 'total' } },
  'by being one of several': { max: { when: { status: { in: ['paid', 'shipped'] } }, then: 'total', else: 'price' } },
  'by being none of several': { sum: { when: { 'totals.region': { not_in: ['north'] } }, then: 'totals.net' } },
  'by having something at all': { sum: { when: { customer: { exists: false } }, then: 'total', else: 1 } },
  'by how much': { min: { when: { and: [{ quantity: { greater_than: 2 } }, { or: [{ price: { less_than_equal: 50 } }, { total: { greater_than_equal: 200 } }] }] }, then: 'total', else: 'quantity' } },
}

for (const [name, measure] of Object.entries(FIGURES)) {
  test(`the database comes to what the records do: ${name}`, { skip, timeout: 60000 }, async () => {
    for (const where of [undefined, { status: { equals: 'paid' } }, { 'customer.name': { equals: 'Ana' } }] as (Where | undefined)[]) {
      const { records, database, reads } = await figure({ measure, where })
      assert.deepEqual(plain(database), plain(records))
      assert.equal(reads, 0, 'the database was to be asked, and the records were read')
    }
  })
}

const span = { period: 'custom', from: '2026-01-01', to: '2026-03-31', date: 'placedAt' } as const
const CHARTS: Record<string, Omit<ChartPick, 'source'>> = {
  'by a choice': { by: 'status' },
  'by what it points at': { measure: 'total', by: 'customer' },
  'by a choice in a group': { measure: { avg: 'total' }, by: 'totals.region' },
  'by a choice in a named tab, and another': { measure: { sum: { multiply: ['quantity', 'price'] } }, by: 'shipping.carrier', series: 'status' },
  'by the month where the widgets are': { measure: 'totals.net', by: 'time', ...span },
  'by the month, several at once': { measure: ['count', { max: 'total' }, { sum: { subtract: ['total', 'discount'] } }], by: 'time', ...span },
  'by the month and a tick': { measure: 'total', by: 'time', series: 'paid', ...span },
}

for (const [name, pick] of Object.entries(CHARTS)) {
  test(`the database draws what the records do: ${name}`, { skip, timeout: 60000 }, async () => {
    const { records, database, reads } = await chart(pick)
    assert.deepEqual(plain(database), plain(records))
    assert.equal(reads, 0, 'the database was to be asked, and the records were read')
    assert.ok(records.bars.length > 1, JSON.stringify(records))
  })
}

test('what is in the rows of an array is read from the records, and comes to what they hold', { skip, timeout: 60000 }, async () => {
  const rows = seeded.flatMap(order => order.items)
  const value = rows.reduce((sum, row) => sum + (row.quantity ?? 0) * (row.price ?? 0), 0)

  const total = await figure({ measure: { sum: { multiply: ['items.quantity', 'items.price'] } } })
  assert.deepEqual(plain(total.database), plain(total.records))
  assert.ok(total.reads > 0)
  assert.equal(total.records.value, contextFor(req).number(Number(value.toFixed(10))))

  const kinds = await chart({ measure: { sum: 'items.quantity' }, by: 'items.kind' })
  assert.deepEqual(plain(kinds.database), plain(kinds.records))
  const goods = rows.filter(row => row.kind === 'goods').reduce((sum, row) => sum + (row.quantity ?? 0), 0)
  assert.equal(kinds.records.bars.find(bar => bar.label === 'goods')?.amount, goods)
})

test('what an access reads of the request, it reads the same both ways', { skip, timeout: 60000 }, async () => {
  const north = await createLocalReq({ user: req.user as never }, payload)
  north.headers.set('x-team', 'north')
  for (const [measure, value] of [[undefined, 3], [{ sum: 'hours' }, 7], [{ avg: 'hours' }, 3.5], [{ min: 'hours' }, 2]] as [FigurePick['measure'], number][]) {
    const { records, database } = await both(sums => readFigure({ ...contextFor(north), sums }, { source: 'tickets', measure }))
    assert.deepEqual(plain(database), plain(records))
    assert.equal(records.amount, value, JSON.stringify(measure))
  }
})

const sales = (pick: Omit<ChartPick, 'source'>, limits?: { groups?: number }) =>
  both(sums => readChart({ ...contextFor(req), sums, ...(limits ? { limits } : {}) }, { source: 'sales', ...pick }))

const MANY_GROUPS: Record<string, [Omit<ChartPick, 'source'>, { groups?: number }?]> = {
  'a count by a field of thirty': [{ by: 'shop' }],
  'a sum by it': [{ measure: 'amount', by: 'shop' }],
  'an average by it, which ranks by the average': [{ measure: { avg: 'amount' }, by: 'shop' }],
  'the least by it': [{ measure: { min: 'amount' }, by: 'shop' }],
  'by it and a series of twelve': [{ measure: 'amount', by: 'shop', series: 'kind' }],
  'several measures by it, ranked by the first': [{ measure: ['amount', 'count', { max: 'amount' }], by: 'shop' }],
  'by it, kept to three groups': [{ measure: 'amount', by: 'shop' }, { groups: 3 }],
}

for (const [name, [pick, limits]] of Object.entries(MANY_GROUPS)) {
  test(`the database draws what the records do, of more than there are bars for: ${name}`, { skip, timeout: 60000 }, async () => {
    const { records, database, reads } = await sales(pick, limits)
    assert.deepEqual(plain(database), plain(records))
    assert.equal(reads, 0, 'the database was to be asked, and the records were read')
    // the most there are bars for, what has no shop among them if it comes to as much, and all the others as one
    const labels = records.bars.map(bar => String(bar.label))
    const named = labels.filter(label => /^shop-/.test(label))
    if (limits?.groups) assert.equal(named.length, limits.groups, JSON.stringify(labels))
    else assert.equal(labels.length, 9, JSON.stringify(labels))
    assert.equal(labels.at(-1), 'Other', JSON.stringify(labels))
  })
}

test('what the database is given back, many groups or few, is no more than is drawn', { skip, timeout: 60000 }, async () => {
  const source = settingsOf(payload).sources.sales
  const { over } = await tallied({ ...contextFor(req), sums: 'database' }, source, new Selection(), amountOf('amount', 'number', 'sum'), [{ field: 'shop' }, { field: 'kind' }], [8, 5])
  const cells = over(0, 1)
  // 8 shops, none and the rest; 5 kinds, none and the rest
  assert.ok(cells.length <= 10 * 7, String(cells.length))
  const all = await tallied({ ...contextFor(req), sums: 'records' }, source, new Selection(), amountOf('amount', 'number', 'sum'), [{ field: 'shop' }, { field: 'kind' }], [8, 5])
  assert.deepEqual(plain(over(0, 1).sort((a, b) => a.keys.join().localeCompare(b.keys.join()))), plain(all.over(0, 1).sort((a, b) => a.keys.join().localeCompare(b.keys.join()))))
})

test('the database gives up on a read that takes longer than it is given, and the records are not read instead', { skip, timeout: 60000 }, async () => {
  const { Client } = createRequire(import.meta.resolve('@payloadcms/db-postgres'))('pg') as { Client: new (options: object) => { connect(): Promise<void>; query(text: string): Promise<unknown>; end(): Promise<void> } }
  const holder = new Client({ connectionString: uri })
  await holder.connect()
  // the table is held by somebody else, so that the count waits on it
  await holder.query('begin; lock table sales in access exclusive mode;')
  try {
    const source = settingsOf(payload).sources.sales
    reads.count = 0
    await assert.rejects(
      tallied({ ...contextFor(req), sums: 'database', limits: { timeoutMs: 300 } }, source, new Selection(), amountOf('amount', 'number', 'sum'), [{ field: 'shop' }]),
      (error: unknown) => error instanceof TimedOut && error.problems[0].code === 'timed-out',
    )
  } finally {
    await holder.query('rollback;')
    await holder.end()
  }
  // and the pool's connections read as long as they like again
  const later = await tallied({ ...contextFor(req), sums: 'database' }, settingsOf(payload).sources.sales, new Selection(), amountOf('amount', 'number', 'sum'))
  assert.ok(later.over().length)
})

test('a collection with a hook that changes what is read is added up from the records', { skip, timeout: 60000 }, async () => {
  const counted = { notes: 0 }
  const { find } = payload
  payload.find = ((args: Parameters<typeof find>[0]) => {
    if ((args.collection as string) === 'notes') counted.notes += 1
    return find.call(payload, args)
  }) as typeof find
  try {
    const figure = await readFigure({ ...contextFor(req), sums: 'database' }, { source: 'notes', measure: { sum: 'hours' } })
    assert.equal(figure.amount, 7)
    assert.ok(counted.notes > 0, 'the records were to be read')
  } finally {
    payload.find = find
  }
})

test('nothing was given up on along the way', { skip }, () => {
  assert.deepEqual(warned, [])
})
