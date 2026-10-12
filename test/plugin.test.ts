import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Config } from 'payload'
import { chart, figure, list, source, widgetsPlugin } from '../src/index'

const config = () => ({
  collections: [
    { slug: 'posts', fields: [{ name: 'title', type: 'text' }, { name: 'status', type: 'select', options: ['draft', 'published'] }] },
    { slug: 'orders', fields: [{ name: 'total', type: 'number' }, { name: 'paid', type: 'checkbox' }] },
  ],
}) as unknown as Config

const dashboard = (built: Config) => built.admin?.dashboard as { widgets: { slug: string; Component: string; fields?: { name: string }[] }[]; defaultLayout: unknown }

test('without anything declared it adds a figure, a list and a chart to set up, and changes nothing else', async () => {
  const plugin = widgetsPlugin()
  assert.equal((plugin as { order?: number }).order, 100)
  const before = config()
  const built = await plugin(before)
  assert.deepEqual(built.collections, before.collections)
  const { widgets, defaultLayout } = dashboard(built)
  assert.deepEqual(widgets.map(widget => widget.slug).sort(), ['chart', 'figure', 'records'])
  assert.equal(typeof defaultLayout, 'function')
})

test('its components are found by the name of the package', async () => {
  const built = await widgetsPlugin({ widgets: [figure('all-posts', 'posts', { label: 'Posts' })] })(config())
  const paths = dashboard(built).widgets.map(widget => widget.Component)
  assert.equal(paths.length, 4)
  for (const path of paths) assert.match(path, /^payload-plugin-widgets\/rsc#\w+$/)
})

test('a ready-made widget comes before the ones to set up, and keeps what a dashboard already had', async () => {
  const mine = { slug: 'mine', Component: 'src/Mine.tsx#Mine' }
  const built = await widgetsPlugin({ widgets: [figure('all-posts', 'posts', { label: 'Posts' }), list('latest', 'posts', { label: 'Latest' })] })(
    { ...config(), admin: { dashboard: { widgets: [mine] } } } as unknown as Config)
  assert.deepEqual(dashboard(built).widgets.map(widget => widget.slug).slice(0, 3), ['mine', 'all-posts', 'latest'])
})

test('a view of the project is told to the import map, and offered in the drawer', async () => {
  const views = { donut: { kind: 'chart' as const, label: 'A donut', Component: 'src/Donut.tsx#Donut' } }
  const built = await widgetsPlugin({ views, widgets: [chart('by-status', 'posts', { label: 'By status', as: 'donut' })] })(config())
  assert.deepEqual(built.admin?.dependencies?.['widgets-view-donut'], { path: 'src/Donut.tsx#Donut', type: 'component' })
  const drawn = dashboard(built).widgets.find(widget => widget.slug === 'chart')?.fields?.find(field => field.name === 'as') as unknown as { options: { value: string }[] }
  assert.deepEqual(drawn.options.map(option => option.value), ['bars', 'columns', 'line', 'donut'])
})

test('a widget set up with what is not there stops the config from being built, and says what was meant', () => {
  const build = (widget: Parameters<typeof figure>[2] & { as?: string }, of = 'posts') => () => widgetsPlugin({ widgets: [figure('wrong', of, widget as never)] })(config())
  assert.throws(build({ label: 'x' }, 'post'), /"wrong".*Did you mean "posts"\?/s)
  assert.throws(build({ label: 'x', as: 'progres' }), /cannot be drawn as "progres".*Did you mean "progress"\?/s)
  assert.throws(build({ label: 'x', as: 'progress' }), /Progress is towards a goal/)
  assert.throws(build({ label: 'x', compare: 'previous' }), /nothing before this to compare/)
  assert.doesNotThrow(build({ label: 'x', as: 'progress', goal: 10, period: 'month', compare: 'previous' }))
})

test('a declared source checks the names a widget picks from it', () => {
  const orders = source('orders' as never, {
    label: 'Orders',
    filters: { unpaid: { where: { paid: { equals: false } } } },
    measures: { total: { sum: 'total', format: 'money' } },
  } as never)
  const build = (show: object) => () => widgetsPlugin({ sources: { orders }, widgets: [figure('f', orders as never, { label: 'x', ...show } as never)] })(config())
  assert.doesNotThrow(build({ filter: 'unpaid', measure: 'total' }))
  assert.throws(build({ filter: 'unpayd' }), /Did you mean "unpaid"\?/)
  assert.throws(build({ measure: 'totl' }), /Did you mean "total"\?/)
})

test('a collection left out is no source', () => {
  assert.throws(() => widgetsPlugin({ sources: { orders: false }, widgets: [figure('f', 'orders', { label: 'x' })] })(config()), /"f"/)
  assert.throws(() => widgetsPlugin({ discover: false, widgets: [figure('f', 'posts', { label: 'x' })] })(config()), /"f"/)
})
