import assert from 'node:assert/strict'
import * as nodeModule from 'node:module'
import { test } from 'node:test'
import type { Config, PayloadRequest } from 'payload'
import { inWords, problemsOf, timedOut } from '../src/check'
import { contextFor } from '../src/context'
import { figure, Misconfigured, TimedOut as RootTimedOut, Unavailable, widgetsPlugin } from '../src/index'
import { accessTo, KEY, type Settings } from '../src/options'
import { readChart, readFigure } from '../src/read'
import { REST, tallied, TimedOut, type Cell } from '../src/tally'
import { amountOf, Selection, type AnySource, type Context } from '../src/types'
import { dataFor, userMay } from '../src/users'

// What 0.6.0 lets a project hold the widgets to: how many records, how many groups, how long a read, and who may set
// up widgets of their own. None of it changes anything for a project that says nothing.

type Doc = Record<string, unknown>
const fields = [
  { name: 'shop', type: 'select', options: Array.from({ length: 12 }, (_, index) => `s${index}`) },
  { name: 'total', type: 'number' },
  { name: 'secret', type: 'text', access: { read: () => false } },
  { name: 'createdAt', type: 'date' },
]

const declared = (more: Doc = {}) => ({ slug: 'orders', filters: {}, measures: {}, groups: { shop: 'Shop' }, ...more })

/** A Payload with the plugin in it whose orders are `docs`, and what it was asked; `slow` never answers. */
const shop = async (docs: Doc[], options: Record<string, unknown> = {}, slow = false) => {
  const built = await widgetsPlugin({ discover: false, sources: { orders: declared() as never }, ...options } as never)({ collections: [{ slug: 'orders', fields }] } as unknown as Config)
  const asked: Doc[] = []
  const warned: unknown[] = []
  const answer = (args: Doc) => {
    asked.push(args)
    if (slow) return new Promise(() => {})
    return Promise.resolve({ docs: docs.slice(0, Number(args.limit) || docs.length), totalDocs: docs.length })
  }
  const payload = {
    config: { ...built, routes: { admin: '/admin' } },
    collections: { orders: { config: { slug: 'orders', fields, flattenedFields: fields, access: { read: () => true }, hooks: {} } } },
    db: { name: 'mongoose' },
    logger: { warn: (...args: unknown[]) => warned.push(args[0]), info: () => {}, error: () => {} },
    find: answer,
    count: (args: Doc) => answer(args).then(found => ({ totalDocs: (found as { totalDocs: number }).totalDocs })),
  }
  const req = { payload, user: { id: 1, collection: 'users' }, headers: new Headers() } as unknown as PayloadRequest
  const settings = (built.custom as Record<string, Settings>)[KEY]
  return { req, asked, warned, settings, built }
}

// thirty orders of twelve shops: s0 sold most, s11 least, and a few of none
const orders = Array.from({ length: 30 }, (_, index) => ({ id: index + 1, shop: index % 10 === 9 ? null : `s${index % 12}`, total: 30 - index, createdAt: '2026-11-01T10:00:00.000Z' }))
const by = (cells: Cell[]) => Object.fromEntries(cells.map(one => [one.keys.join('/'), one.sum]))

test('a field told apart by more values than are kept has the rest as one, and comes to the same', async () => {
  const { req } = await shop(orders)
  const source = { slug: 'orders', filters: {}, measures: {} } as unknown as AnySource
  const all = await tallied(contextFor(req), source, new Selection(), amountOf('total', 'number', 'sum'), [{ field: 'shop' }])
  const three = await tallied(contextFor(req), source, new Selection(), amountOf('total', 'number', 'sum'), [{ field: 'shop' }], [3])
  const kept = by(three.over(0))
  // the three that sold most, what has no shop, and all the others
  assert.deepEqual(Object.keys(kept).sort(), ['', REST, 's0', 's1', 's2'].sort())
  const sum = (cells: Cell[]) => cells.reduce((total, cell) => total + cell.sum, 0)
  assert.equal(sum(three.over(0)), sum(all.over(0)))
  assert.equal(kept[REST], sum(all.over(0).filter(cell => !['', 's0', 's1', 's2'].includes(cell.keys[0]))))
  // and those it was told to keep, whatever they come to
  assert.deepEqual(Object.keys(by((await tallied(contextFor(req), source, new Selection(), amountOf('total', 'number', 'sum'), [{ field: 'shop' }], [['s11']])).over(0))).sort(), ['', REST, 's11'].sort())
})

test('a chart by a field of many values draws the most of them and the rest as Other, at most as many as limits.groups', async () => {
  const { req } = await shop(orders)
  const labels = async (context: Context) => (await readChart(context, { source: 'orders', measure: { sum: 'total' }, by: 'shop' })).bars.map(bar => String(bar.label))
  const eight = await labels(contextFor(req))
  assert.equal(eight.length, 9)
  assert.equal(eight.at(-1), 'Other')
  const { req: few } = await shop(orders, { limits: { groups: 2 } })
  assert.deepEqual(await labels(contextFor(few)), ['s0', 's1', 'None', 'Other'])
})

test('limits.records is how many records are read at most where the database does not add up', async () => {
  const { req, asked } = await shop(orders, { limits: { records: 10 } })
  const source = { slug: 'orders', filters: {}, measures: {} } as unknown as AnySource
  const read = await tallied(contextFor(req), source, new Selection(), amountOf('total', 'number', 'sum'))
  assert.equal(read.cut, true)
  assert.equal(asked.at(-1)?.limit, 11)
  // nothing said is as before
  const plain = await shop(orders)
  await tallied(contextFor(plain.req), source, new Selection(), amountOf('total', 'number', 'sum'))
  assert.equal(plain.asked.at(-1)?.limit, 5001)
  // what is not a number above nought is no limit
  const { settings } = await shop(orders, { limits: { records: 0, groups: -3, timeoutMs: 'soon' } })
  assert.deepEqual(settings.limits, {})
})

test('a read that takes longer than limits.timeoutMs is given up on, and the tile says so', async () => {
  const { req, warned } = await shop(orders, { limits: { timeoutMs: 40 } }, true)
  const started = Date.now()
  const error = await readFigure(contextFor(req), { source: 'orders', measure: { sum: 'total' } }).catch((caught: unknown) => caught)
  assert.ok(error instanceof TimedOut)
  assert.ok(Date.now() - started < 2000)
  const [problem] = problemsOf(error) ?? []
  assert.equal(problem.code, 'timed-out')
  assert.equal(inWords(problem), 'This took longer to read than the 0.04 s it is given.')
  assert.equal(warned.length, 1)
  await assert.rejects(readChart(contextFor(req), { source: 'orders', measure: { sum: 'total' }, by: 'shop' }), TimedOut)
})

test('a read given up on is a TimedOut of its own, neither set up wrong nor refused, and the root exports it', async () => {
  const { req } = await shop(orders, { limits: { timeoutMs: 20 } }, true)
  const error = await readFigure(contextFor(req), { source: 'orders', measure: { sum: 'total' } }).catch((caught: unknown) => caught)
  assert.equal(RootTimedOut, TimedOut)
  assert.ok(error instanceof RootTimedOut)
  assert.equal((error as Error).name, 'TimedOut')
  assert.ok(!(error instanceof Misconfigured))
  assert.ok(!(error instanceof Unavailable))
  assert.ok(timedOut(error))
  // told by its name, as from another copy of the plugin
  const other = Object.assign(new Error('x'), { name: 'TimedOut', problems: [{ code: 'timed-out', vars: { seconds: 1 } }] })
  assert.ok(timedOut(other))
  assert.deepEqual(problemsOf(other)?.map(problem => problem.code), ['timed-out'])
  assert.equal(problemsOf(Object.assign(new Error('x'), { name: 'Other', problems: [] })), undefined)
})

// the components draw a tile of their own, whose stylesheet node cannot load: it is read as nothing
const styled = typeof nodeModule.registerHooks === 'function'
if (styled) nodeModule.registerHooks({ load: (url, context, next) => (url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context)) })

test('that a read took too long is said on the tile to anybody, in production as well', { skip: !styled && 'needs module.registerHooks (Node 22.15)' }, async () => {
  const { Figure, Chart } = await import('../src/components/index')
  const { req } = await shop(orders, { limits: { timeoutMs: 20 } }, true)
  const was = process.env.NODE_ENV
  const env = process.env as Record<string, string | undefined>
  try {
    for (const mode of ['production', 'development']) {
      env.NODE_ENV = mode
      for (const drawn of [
        await Figure({ req, source: 'orders', measure: { sum: 'total' }, label: { en: 'Sold', hr: 'Prodano' } }),
        await Chart({ req, source: 'orders', measure: { sum: 'total' }, by: 'shop', label: 'Sold' }),
      ]) {
        const { note, kind, label } = (drawn as { props: { note: string; kind: string; label: string } }).props
        // a label in several languages is said in the request's
        assert.equal(label, 'Sold')
        assert.equal(kind, 'error')
        assert.equal(note, 'This took longer to read than the 0.02 s it is given.')
      }
    }
  } finally {
    env.NODE_ENV = was
  }
})

test('without userWidgets, anybody signed in may set up widgets of every kind of every source, as before', async () => {
  const { built, settings, req } = await shop(orders)
  assert.deepEqual(built.admin?.dashboard?.widgets?.map(widget => widget.slug), ['figure', 'records', 'chart'])
  for (const kind of ['figure', 'list', 'chart'] as const) assert.equal(await userMay(settings, req, kind, 'orders'), true)
  assert.equal(await userMay(settings, { ...req, user: null } as unknown as PayloadRequest, 'figure', 'orders'), false)
})

test('userWidgets: false offers none, and refuses any set up before', async () => {
  const { built, settings, req } = await shop(orders, { userWidgets: false })
  assert.deepEqual(built.admin?.dashboard?.widgets?.map(widget => widget.slug), [])
  assert.equal(await userMay(settings, req, 'figure', 'orders'), false)
})

test('userWidgets.kinds offers those kinds only, and refuses the others', async () => {
  const { built, settings, req } = await shop(orders, { userWidgets: { kinds: ['figure', 'list'] } })
  assert.deepEqual(built.admin?.dashboard?.widgets?.map(widget => widget.slug), ['figure', 'records'])
  assert.equal(await userMay(settings, req, 'list', 'orders'), true)
  assert.equal(await userMay(settings, req, 'chart', 'orders'), false)
})

test('userWidgets.sources offers those sources only, by name or by collection, and refuses the others', async () => {
  const both = { sources: { orders: declared(), refunds: declared({ label: 'Refunds' }) } }
  const { built, settings, req } = await shop(orders, { ...both, userWidgets: { sources: ['refunds'] } })
  const offered = built.admin?.dashboard?.widgets?.find(widget => widget.slug === 'figure')
  const flat = (list: unknown[]): Doc[] => (list as Doc[]).flatMap(field => [field, ...flat((field.fields as unknown[]) ?? [])])
  const source = flat(offered?.fields ?? []).find(field => field.name === 'source') as unknown as { options: { value: string }[] }
  assert.deepEqual(source.options.map(option => option.value), ['refunds'])
  assert.equal(await userMay(settings, req, 'figure', 'refunds'), true)
  assert.equal(await userMay(settings, req, 'figure', 'orders'), false)
  const bySlug = await shop(orders, { ...both, userWidgets: { sources: ['orders'] } })
  assert.equal(await userMay(bySlug.settings, bySlug.req, 'figure', 'refunds'), true)
})

test('userWidgets.access is asked once a request; one that says no, or throws, refuses', async () => {
  const calls = { times: 0 }
  const role = (req: PayloadRequest) => (req.headers.get('x-role') ?? 'sales')
  const { settings, req } = await shop(orders, { userWidgets: { access: async ({ req }: { req: PayloadRequest }) => (calls.times += 1, role(req) === 'admin') } })
  assert.equal(await userMay(settings, req, 'figure', 'orders'), false)
  assert.equal(await userMay(settings, req, 'chart', 'orders'), false)
  assert.equal(calls.times, 1)
  const admin = { ...req, headers: new Headers({ 'x-role': 'admin' }) } as unknown as PayloadRequest
  assert.equal(await userMay(settings, admin, 'figure', 'orders'), true)
  assert.equal(calls.times, 2)
  const throwing = await shop(orders, { userWidgets: { access: () => { throw new Error('no') } } })
  assert.equal(await userMay(throwing.settings, throwing.req, 'figure', 'orders'), false)
})

test('a widget read with the server\'s access is handed only what it trusts whoever set it with', () => {
  const sold = figure('sold', 'orders', { label: 'Sold', overrideAccess: true, access: () => true, data: { shop: 's0' }, trusted: ['period'] } as never) as never
  // a filter of somebody's own is no way past what it was made to read
  assert.deepEqual(dataFor(sold, { shop: 's1', period: 'month', where: { secret: { exists: true } } }), { shop: 's0', period: 'month' })
  assert.deepEqual(dataFor(sold, undefined), { shop: 's0' })
  // one read as whoever looks is handed all of it, as before
  assert.deepEqual(dataFor({}, { shop: 's1' }), { shop: 's1' })
})

test('what a collection lets somebody read is asked once a request', async () => {
  const calls = { times: 0 }
  const req = {
    user: { id: 1 },
    payload: { collections: { orders: { config: { access: { read: () => (calls.times += 1, true) } } } } },
  } as unknown as PayloadRequest
  const source = { slug: 'orders', filters: {}, measures: {} } as unknown as AnySource
  await accessTo(req, source)
  await accessTo(req, source)
  assert.equal(calls.times, 1)
  await accessTo({ ...req } as PayloadRequest, source)
  assert.equal(calls.times, 2)
})

test('what is wrong with a filter names no field the person looking may not read', async () => {
  const { req } = await shop(orders)
  const error = await readFigure(contextFor(req), { source: 'orders', where: { secrets: { equals: 'x' } } }).catch((caught: unknown) => caught)
  const problems = problemsOf(error) ?? []
  assert.ok(problems.length, String(error))
  assert.ok(problems.every(problem => problem.hint !== 'secret'), JSON.stringify(problems))
  // a field they may not read is as good as none
  const hidden = await readFigure(contextFor(req), { source: 'orders', where: { secret: { equals: 'x' } } }).catch((caught: unknown) => caught)
  assert.ok(problemsOf(hidden)?.length, String(hidden))
})
