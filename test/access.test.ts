import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Config, PayloadRequest } from 'payload'
import { chart, figure, list, widget, widgetsPlugin } from '../src/index'
import { accessTo, mayUse, startsWith, type Settings } from '../src/options'
import type { AnySource } from '../src/types'

type User = { id: number; role: string }

/** A request by somebody, to a Payload whose orders only an admin may read. */
const by = (user: User | null) => ({
  user,
  payload: { collections: { orders: { config: { access: { read: ({ req }: { req: { user: User } }) => req.user.role === 'admin' } } } } },
}) as unknown as PayloadRequest

const orders = { slug: 'orders', filters: {}, measures: {} } as unknown as AnySource
const admin = { id: 1, role: 'admin' }
const sales = { id: 2, role: 'sales' }
const isSales = ({ req }: { req: PayloadRequest }) => (req.user as unknown as User).role === 'sales'

test('a source is for whoever its collection lets read it', async () => {
  assert.deepEqual(await accessTo(by(admin), orders), [])
  assert.equal(await accessTo(by(sales), orders), false)
  assert.equal(await accessTo(by(null), orders), false)
})

test('access is asked on top of the collection, of the source and of the widget', async () => {
  const mine = { ...orders, access: ({ req }: { req: PayloadRequest }) => ({ owner: { equals: (req.user as unknown as User).id } }) } as AnySource
  assert.deepEqual(await accessTo(by(admin), mine), [{ owner: { equals: 1 } }])
  assert.deepEqual(await accessTo(by(admin), mine, { access: () => ({ paid: { equals: true } }) }), [{ owner: { equals: 1 } }, { paid: { equals: true } }])
  assert.equal(await accessTo(by(admin), mine, { access: () => false }), false)
  // what the collection refuses, no access brings back
  assert.equal(await accessTo(by(sales), orders, { access: () => true }), false)
})

test('an access that fails lets nobody in', async () => {
  assert.equal(await accessTo(by(admin), orders, { access: () => { throw new Error('no') } }), false)
})

test('read with the server\'s access, the collection is not asked, and the widget still is', async () => {
  assert.deepEqual(await accessTo(by(sales), orders, { access: isSales, overrideAccess: true }), [])
  assert.equal(await accessTo(by(admin), orders, { access: isSales, overrideAccess: true }), false)
  assert.equal(await accessTo(by(null), orders, { access: () => true, overrideAccess: true }), false)
})

test('a widget read with the server\'s access has to say who it is for, and is no list', () => {
  const config = () => ({ collections: [{ slug: 'orders', fields: [{ name: 'total', type: 'number' }] }] }) as unknown as Config
  const build = (...widgets: ReturnType<typeof figure>[]) => () => widgetsPlugin({ widgets })(config())
  assert.throws(build(figure('sold', 'orders', { label: 'Sold', overrideAccess: true })), /"sold".*has to say who it is for/s)
  assert.throws(build(chart('sold', 'orders', { label: 'Sold', overrideAccess: true })), /has to say who it is for/)
  assert.doesNotThrow(build(figure('sold', 'orders', { label: 'Sold', overrideAccess: true, access: isSales })))
  assert.throws(build(list('latest', 'orders', { label: 'Latest', overrideAccess: true, access: isSales } as never)), /only a figure or a chart/)
})

test('somebody starts with the widgets that are for them, unless one says otherwise', async () => {
  const settings = { sources: { orders } } as unknown as Settings
  const sold = figure('sold', 'orders', { label: 'Sold' })
  assert.equal(await startsWith(settings, by(admin), sold), true)
  assert.equal(await startsWith(settings, by(sales), sold), false)
  assert.equal(await startsWith(settings, by(admin), figure('sold', 'orders', { label: 'Sold', home: false })), false)
  assert.equal(await startsWith(settings, by(admin), figure('sold', 'orders', { label: 'Sold', home: ({ req }) => (req.user as unknown as User).id === 7 })), false)
  // one of the project's own is anybody's unless it says who it is for
  const note = widget('note', { label: 'A note', Component: 'src/Note.tsx#Note' })
  assert.equal(await mayUse(settings, by(sales), note), true)
  assert.equal(await mayUse(settings, by(sales), widget('note', { label: 'A note', Component: 'src/Note.tsx#Note', access: () => false })), false)
  assert.equal(await mayUse(settings, by(null), note), false)
})
