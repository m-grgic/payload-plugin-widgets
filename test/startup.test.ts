import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Config } from 'payload'
import { fieldProblems, misspelt, problemsOf, stamped } from '../src/check'
import { chart, figure, list, Misconfigured, source, Unavailable, widget, widgetsPlugin } from '../src/index'
import { KEY, type Settings } from '../src/options'

// What is wrong with the options is said as the config is built, all of it at once, each by where it is.

const config = () => ({
  collections: [
    { slug: 'posts', fields: [{ name: 'title', type: 'text' }, { name: 'status', type: 'select', options: ['draft', 'published'] }] },
    {
      slug: 'orders',
      fields: [
        { name: 'total', type: 'number' }, { name: 'number', type: 'text' }, { name: 'paid', type: 'checkbox' },
        { name: 'placedAt', type: 'date' }, { name: 'customer', type: 'text' },
      ],
    },
    { slug: 'users', auth: true, fields: [{ name: 'name', type: 'text' }] },
  ],
}) as unknown as Config

const problems = (build: () => unknown) => {
  try {
    build()
  } catch (error) {
    assert.ok(error instanceof Misconfigured)
    return (problemsOf(error) ?? []).map(({ code, path, hint }) => ({ code, path, ...(hint ? { hint } : {}) }))
  }
  return []
}

const orders = (more: object) => source('orders', { label: 'Orders', ...more } as never)

test('a declared source is checked against the fields of its collection as the config is built', () => {
  const built = (more: object) => () => widgetsPlugin({ sources: { orders: orders(more) } })(config())
  assert.deepEqual(problems(built({ measures: { revenue: { sum: 'totl' } } })), [{ code: 'no-number', path: 'sources.orders.measures.revenue', hint: 'total' }])
  assert.deepEqual(problems(built({ measures: { revenue: { sum: 'number' } } })), [{ code: 'not-a-number', path: 'sources.orders.measures.revenue' }])
  assert.deepEqual(problems(built({ date: 'placed' })), [{ code: 'no-field', path: 'sources.orders.date', hint: 'placedAt' }])
  assert.deepEqual(problems(built({ date: 'total' })), [{ code: 'not-a-date', path: 'sources.orders.date' }])
  assert.deepEqual(problems(built({ dates: { shippedAt: 'Shipped' } })), [{ code: 'no-field', path: 'sources.orders.dates.shippedAt' }])
  assert.deepEqual(problems(built({ groups: { custmer: 'Customer' } })), [{ code: 'no-field', path: 'sources.orders.groups.custmer', hint: 'customer' }])
  assert.deepEqual(problems(built({ scopes: { customer: (id: string) => ({ custmer: { equals: id } }) } })),
    [{ code: 'no-field', path: 'sources.orders.scopes.customer.custmer', hint: 'customer' }])
  assert.deepEqual(problems(built({ filters: { late: { where: { placedAt: { less_than: 'tody' } } } } })),
    [{ code: 'not-a-moment', path: 'sources.orders.filters.late.where.placedAt.less_than', hint: 'today' }])
  // what Payload adds itself is there
  assert.deepEqual(problems(built({ date: 'createdAt', dates: { updatedAt: 'Changed' }, filters: { late: { where: { createdAt: { less_than: '2026-01-01' } } } } })), [])
  assert.deepEqual(problems(built({ date: 'placedAt', measures: { revenue: { sum: 'total' } }, groups: { customer: 'Customer' } })), [])
})

test('a date in a filter is a date or a moment', () => {
  const built = (where: object) => () => widgetsPlugin({ widgets: [figure('late', 'orders', { label: 'x', where } as never)] })(config())
  for (const fine of ['today', 'startOfMonth-1m', 'now+7d', '2026-03-01', '2026-03-01T08:00:00Z']) assert.deepEqual(problems(built({ placedAt: { less_than: fine } })), [])
  assert.deepEqual(problems(built({ and: [{ paid: { equals: false } }, { placedAt: { greater_than: 'yesterdy' } }] })),
    [{ code: 'not-a-moment', path: 'widgets.late.where.and.1.placedAt.greater_than', hint: 'yesterday' }])
  assert.deepEqual(problems(built({ placedAt: { in: ['2026-02-30x'] } })).map(({ code }) => code), ['not-a-moment'])
})

test('everything that is wrong is said at once, and the error is no Unavailable', () => {
  let caught: unknown
  try {
    widgetsPlugin({
      widgets: [
        figure('a', 'orders', { label: 'x', where: { totl: { equals: 1 } } }),
        figure('a', 'posts', { label: 'x' }),
        list('chart', 'posts', { label: 'x' }),
        chart('b', 'orders', { label: 'x', as: 'pie' }),
      ],
    })(config())
  } catch (error) {
    caught = error
  }
  assert.ok(caught instanceof Misconfigured)
  assert.ok(!(caught instanceof Unavailable))
  assert.equal(caught.name, 'Misconfigured')
  assert.deepEqual(caught.problems.map(({ code, path }) => [code, path]), [
    ['duplicate-slug', 'widgets.a'],
    ['reserved-slug', 'widgets.chart'],
    ['no-view', 'widgets.b'],
    ['no-field', 'widgets.a.where.totl'],
  ])
  assert.match(caught.message, /^widgetsPlugin: some widgets are set up with what is not there, and some widgets are called by slugs that are taken\n/)
  assert.match(caught.message, /"a" at where\.totl: orders has no field called "totl"\. Did you mean "total"\?/)
  assert.match(caught.message, /A widget cannot be called "chart": the plugin has one called that/)
})

test('what is wrong with a widget\'s measure is said where in the measure it is', () => {
  const built = (...widgets: unknown[]) => () => widgetsPlugin({ widgets: widgets as never })(config())
  assert.deepEqual(problems(built(figure('x', 'orders', { label: 'x', measure: 'revenue' } as never))), [{ code: 'no-measure', path: 'widgets.x.measure' }])
  assert.deepEqual(problems(built(figure('x', 'orders', { label: 'x', measure: { sum: 'totl' } } as never))), [{ code: 'no-number', path: 'widgets.x.measure.sum', hint: 'total' }])
  assert.deepEqual(problems(built(figure('x', 'orders', { label: 'x', measure: { median: 'total' } } as never))), [{ code: 'bad-measure', path: 'widgets.x.measure' }])
  assert.deepEqual(problems(built(figure('x', 'orders', { label: 'x', measure: { sum: { when: { piad: { equals: true } }, then: 'total' } } } as never))),
    [{ code: 'no-field', path: 'widgets.x.measure.sum', hint: 'paid' }])
  // of a chart's several, by which of them
  assert.deepEqual(problems(built(chart('c', 'orders', { label: 'x', measure: ['total', { sum: 'totl' }] } as never))), [{ code: 'no-number', path: 'widgets.c.measure.1.sum', hint: 'total' }])
  assert.match(String((() => { try { built(figure('x', 'orders', { label: 'x', measure: { sum: 'totl' } } as never))() } catch (error) { return (error as Error).message } })()),
    /"x" at measure\.sum: orders has no number called "totl"/)
})

test('a slug that is taken is said as that, not as something set up with what is not there', () => {
  const message = (...widgets: unknown[]) => {
    try {
      widgetsPlugin({ widgets: widgets as never })(config())
    } catch (error) {
      return (error as Error).message
    }
    return ''
  }
  assert.match(message(figure('a', 'orders', { label: 'x' }), figure('a', 'posts', { label: 'y' })), /^widgetsPlugin: a widget is called by a slug that is taken\n {2}- "a": There are two widgets called "a"\.$/)
  assert.match(message(figure('a', 'orders', { label: 'x' }), figure('a', 'posts', { label: 'y' }), list('chart', 'posts', { label: 'z' })),
    /^widgetsPlugin: some widgets are called by slugs that are taken\n/)
  assert.match(message(figure('a', 'orders', { label: 'x', where: { totl: { equals: 1 } } })), /^widgetsPlugin: a widget is set up with what is not there\n/)
})

test('a widget may not be called as one the dashboard already has, nor as Payload\'s own', () => {
  const mine = { slug: 'mine', Component: 'src/Mine.tsx#Mine' }
  const built = (slug: string) => () => widgetsPlugin({ widgets: [widget(slug, { label: 'x', Component: 'src/X.tsx#X' })] })(
    { ...config(), admin: { dashboard: { widgets: [mine] } } } as unknown as Config)
  assert.deepEqual(problems(built('mine')), [{ code: 'reserved-slug', path: 'widgets.mine' }])
  assert.deepEqual(problems(built('collections')), [{ code: 'reserved-slug', path: 'widgets.collections' }])
  assert.deepEqual(problems(built('shortcuts')), [])
})

const started = async (built: Config, fields: Record<string, { name: string; type: string }[]> = {}) => {
  const said: Record<string, unknown[]> = { info: [], warn: [], error: [] }
  const logger = Object.fromEntries(Object.keys(said).map(level => [level, (message: unknown) => said[level].push(message)]))
  const collections = Object.fromEntries((built.collections ?? []).map(collection =>
    [collection.slug, { config: { ...collection, flattenedFields: [...collection.fields, ...(fields[collection.slug] ?? [])] } }]))
  await built.onInit?.({ db: { name: 'postgres' }, logger, collections } as never)
  return said
}

test('what Payload adds as it settles a collection is checked once it has started', async () => {
  // a collection that logs in is given its email by Payload: not known as the config is built
  const plugin = (where: object, strict?: boolean) => widgetsPlugin({ strict, widgets: [figure('people', 'users', { label: 'x', where } as never)] })
  const fine = await plugin({ email: { like: 'example.com' } })(config())
  assert.deepEqual(await started(fine, { users: [{ name: 'email', type: 'email' }] }), { info: [], warn: [], error: [] })
  const wrong = await plugin({ emial: { like: 'example.com' } })(config())
  await assert.rejects(started(wrong, { users: [{ name: 'email', type: 'email' }] }), (error: unknown) =>
    error instanceof Misconfigured && error.problems[0].code === 'no-field' && error.problems[0].path === 'widgets.people.where.emial' && error.problems[0].hint === 'email')
  const loose = await plugin({ emial: { like: 'example.com' } }, false)(config())
  const said = await started(loose, { users: [{ name: 'email', type: 'email' }] })
  assert.equal(said.error.length, 1)
  assert.match(String(said.error[0]), /"people" at where\.emial: users has no field called "emial"\. Did you mean "email"\?/)
})

test('with strict: false nothing about the fields stops the config, and it is said as Payload starts', async () => {
  const options = { strict: false, sources: { orders: orders({ groups: { custmer: 'Customer' } }) } }
  const built = await widgetsPlugin(options)(config())
  const said = await started(built)
  assert.equal(said.error.length, 1)
  assert.match(String(said.error[0]), /a source is set up with what is not there\n {2}- "orders" at groups\.custmer: orders has no field called "custmer"\. Did you mean "customer"\?/)
  // what is wrong by name stops it all the same
  assert.throws(() => widgetsPlugin({ strict: false, widgets: [figure('f', 'post', { label: 'x' })] })(config()), Misconfigured)
})

test('a translation of what the widgets do not say, but nearly do, is said as Payload starts', async () => {
  const built = await widgetsPlugin({ i18n: { translations: { de: { 'Todya': 'Heute', 'Yes': 'Ja', 'Sold this quarter': 'Verkauft' } } } })(config())
  const said = await started(built)
  assert.equal(said.warn.length, 1)
  assert.match(String(said.warn[0]), /de "Todya": did you mean "Today"\?/)
  assert.deepEqual(misspelt({ hr: { 'Sold this quarter': 'Prodano', 'Revenue': 'Prihod' } }), [])
})

test('the demo boots as it is: its config is built and every widget in it checks out', async () => {
  const dev = await (await import('../dev/payload.config')).default
  const settings = (dev.custom as Record<string, Settings>)[KEY]
  assert.ok(settings.widgets.length > 0)
  // as Payload has settled them: with the fields it adds to log in
  const fields = (slug: string) => {
    const collection = dev.collections.find(one => one.slug === slug)
    return collection && stamped(collection, collection.flattenedFields)
  }
  assert.deepEqual(fieldProblems(settings, fields), [])
})
