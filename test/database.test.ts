import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { after, before, test } from 'node:test'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig, createLocalReq, getPayload, type Payload, type PayloadRequest, type Where } from 'payload'
import { contextFor } from '../src/context'
import { widgetsPlugin } from '../src/index'
import { readChart, readFigure, type ChartPick, type FigurePick } from '../src/read'

// What the database adds up has to come to what reading every record does. Each figure and chart below is read both
// ways from a real Postgres and compared, and the ones the database can answer must not have read a single record.
// Run where DATABASE_URI names a database that may be emptied: `DATABASE_URI=postgres://… pnpm test`.

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
  const user = await payload.create({ collection: 'users', data: { email: 'test@example.com', password: 'test-only' } })
  const customers = await Promise.all(['Ana', 'Ben', 'Cy'].map(name => payload.create({ collection: 'customers' as never, data: { name } as never })))
  seeded = orders(customers.map(customer => customer.id as number))
  for (const data of seeded) await payload.create({ collection: 'orders' as never, data: data as never })
  req = await createLocalReq({ user: { ...user, collection: 'users' } as never }, payload)

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

test('nothing was given up on along the way', { skip }, () => {
  assert.deepEqual(warned, [])
})
