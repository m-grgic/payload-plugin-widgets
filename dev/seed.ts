import type { Payload } from 'payload'

// Two years of a made-up shop, the same every time, counted back from today so the demo never goes stale.

const DAY = 24 * 60 * 60 * 1000

/** The same "random" numbers every time. */
const dice = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

const CUSTOMERS = [
  'Northwind Bakery', 'Blue Harbor Books', 'Juniper & Sons', 'Atlas Cycles', 'Lumen Studio', 'Fieldnote Coffee', 'Marigold Florists', 'Copperline Tools',
  'Saltwater Ceramics', 'Pinecrest Outfitters', 'Hollow Oak Furniture', 'Paper Kite Toys', 'Greenhouse Supply', 'Larkspur Stationery', 'Tidewater Surf',
  'Old Mill Brewing', 'Foxglove Tailors', 'Quarry Lane Hardware', 'Sunday Bread Club', 'Kestrel Optics', 'Half Moon Records', 'Willow & Thread',
  'Brightside Pets', 'Cedar Row Kitchens', 'Harbour Lights Cafe', 'Mossy Rock Climbing', 'Violet Hour Wines', 'Ironbridge Bikes', 'Clementine Kids', 'Stonepath Gardens',
]
const COUNTRIES = ['Germany', 'France', 'Italy', 'Spain', 'Croatia']
const TASKS: [string, 'todo' | 'doing' | 'done', number][] = [
  ['Call back Atlas Cycles about the bulk order', 'todo', -6], ['Restock the gift boxes', 'doing', -3], ['Send the autumn newsletter', 'todo', -1],
  ['Photograph the new ceramics', 'doing', 2], ['Renew the shipping contract', 'todo', 5], ['Plan the holiday window', 'todo', 9],
  ['Update the returns page', 'done', -8], ['Reconcile last month\'s payouts', 'done', -4], ['Order packaging tape', 'todo', 1], ['Reply to the wholesale enquiry', 'doing', 0],
]

export const seed = async (payload: Payload) => {
  const { totalDocs } = await payload.count({ collection: 'users' })
  if (totalDocs) return
  payload.logger.info('demo: filling an empty database with a made-up shop')
  const roll = dice(7)
  const now = Date.now()
  const create = (collection: string, data: Record<string, unknown>) => payload.create({ collection, data, depth: 0 } as never) as Promise<{ id: number | string }>

  const user = await create('users', { email: 'demo@example.com', password: 'demo', name: 'Demo', roles: ['admin'] })

  const customers: (number | string)[] = []
  for (const [index, name] of CUSTOMERS.entries()) {
    // a few new ones every month, more of them lately
    const since = new Date(now - roll() ** 1.4 * 420 * DAY)
    customers.push((await create('customers', { name, country: COUNTRIES[index % COUNTRIES.length], since: since.toISOString() })).id)
  }

  let number = 1000
  for (let month = 25; month >= 0; month--) {
    // a shop that is growing, with a good December
    const busy = new Date(now - month * 30 * DAY).getMonth() === 11 ? 1.5 : 1
    const many = Math.round((12 + (25 - month) * 0.75) * busy * (0.8 + roll() * 0.4))
    for (let one = 0; one < many; one++) {
      const placedAt = new Date(now - month * 30 * DAY - roll() * 29 * DAY)
      if (placedAt.getTime() > now) continue
      const recent = now - placedAt.getTime() < 10 * DAY
      const chance = roll()
      const status = recent && chance < 0.45 ? 'pending' : chance < 0.05 ? 'refunded' : chance < 0.5 ? 'paid' : 'shipped'
      await create('orders', {
        number: `#${++number}`, customer: customers[Math.floor(roll() * customers.length)], status,
        total: Math.round((40 + roll() * roll() * 900) * 100) / 100, placedAt: placedAt.toISOString(),
      })
    }
  }

  for (const [title, status, due] of TASKS) {
    await create('tasks', {
      title, status, priority: ['low', 'normal', 'high'][Math.floor(roll() * 3)], assignee: user.id,
      dueDate: new Date(now + due * DAY).toISOString(), estimate: 30 + Math.floor(roll() * 8) * 30,
    })
  }
  payload.logger.info(`demo: ${number - 1000} orders, ${customers.length} customers and ${TASKS.length} tasks`)
}
