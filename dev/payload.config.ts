import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { buildConfig } from 'payload'
import { chart, figure, list, source, widgetsPlugin } from 'payload-plugin-widgets'
import { seed } from './seed'

// A small shop to try the widgets on, and what the screenshots in the README are taken of. See ./README.md.

const dirname = path.dirname(fileURLToPath(import.meta.url))
export const DEMO = { email: 'demo@example.com', password: 'demo' }

// what cannot be found in the collection by itself: which orders are worth a look, and what else to tell of them
const orders = source('orders', {
  label: 'Orders',
  date: 'placedAt',
  filters: {
    unpaid: { label: 'Not paid yet', where: { status: { equals: 'pending' } } },
    sold: { label: 'Sold', where: { status: { in: ['paid', 'shipped'] } } },
  },
  measures: {
    revenue: { sum: 'total', format: 'money', label: 'Revenue' },
    average: { avg: 'total', format: 'money', label: 'Average order' },
  },
  groups: { status: 'Status', customer: 'Customer' },
})

export default buildConfig({
  secret: process.env.PAYLOAD_SECRET ?? 'only-for-the-demo',
  db: postgresAdapter({ pool: { connectionString: process.env.DATABASE_URI ?? 'postgres://postgres:postgres@127.0.0.1:5432/widgets_demo' } }),
  admin: {
    user: 'users',
    autoLogin: { ...DEMO, prefillOnly: false },
    importMap: { baseDir: dirname, importMapFile: path.resolve(dirname, 'app/(payload)/admin/importMap.js') },
  },
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  collections: [
    {
      slug: 'users',
      auth: true,
      admin: { useAsTitle: 'name' },
      fields: [
        { name: 'name', type: 'text' },
        { name: 'roles', type: 'select', hasMany: true, defaultValue: ['admin'], options: ['admin', 'sales', 'support'] },
      ],
    },
    {
      slug: 'customers',
      admin: { useAsTitle: 'name' },
      // the date its periods go by, where that is not when the record was made
      custom: { widgets: { date: 'since' } },
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'country', type: 'select', options: ['Germany', 'France', 'Italy', 'Spain', 'Croatia'] },
        { name: 'since', type: 'date' },
      ],
    },
    {
      slug: 'orders',
      admin: { useAsTitle: 'number' },
      fields: [
        { name: 'number', type: 'text', required: true },
        { name: 'customer', type: 'relationship', relationTo: 'customers' },
        { name: 'status', type: 'select', defaultValue: 'pending', options: [{ label: 'Pending', value: 'pending' }, { label: 'Paid', value: 'paid' }, { label: 'Shipped', value: 'shipped' }, { label: 'Refunded', value: 'refunded' }] },
        { name: 'total', type: 'number', custom: { widgets: { format: 'money' } } },
        { name: 'placedAt', type: 'date' },
      ],
    },
    {
      slug: 'tasks',
      admin: { useAsTitle: 'title' },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'status', type: 'select', defaultValue: 'todo', options: [{ label: 'To do', value: 'todo' }, { label: 'In progress', value: 'doing' }, { label: 'Done', value: 'done' }] },
        { name: 'priority', type: 'select', options: ['low', 'normal', 'high'] },
        { name: 'dueDate', type: 'date' },
        { name: 'assignee', type: 'relationship', relationTo: 'users' },
        // kept in minutes, written as hours
        { name: 'estimate', type: 'number', custom: { widgets: { format: 'hours' } } },
      ],
    },
  ],
  plugins: [
    widgetsPlugin({
      currency: 'EUR',
      sources: { orders },
      widgets: [
        figure('revenue-month', orders, { label: 'Revenue this month', filter: 'sold', measure: 'revenue', period: 'month', compare: 'previous' }),
        figure('revenue-year', orders, { label: 'Revenue this year', filter: 'sold', measure: 'revenue', period: 'year', goal: 80000, as: 'progress' }),
        figure('revenue-trend', orders, { label: 'The last 12 months', filter: 'sold', measure: 'revenue', period: 'last12', compare: 'previous', as: 'sparkline' }),
        figure('overdue-tasks', 'tasks', { label: 'Overdue tasks', where: { and: [{ dueDate: { less_than: 'today' } }, { status: { not_equals: 'done' } }] } }),
        chart('revenue-by-month', orders, { label: 'Revenue by month', filter: 'sold', measure: 'revenue', by: 'time', period: 'last12', as: 'columns' }),
        chart('orders-by-status', orders, { label: 'Orders by status', by: 'status', period: 'year' }),
        list('latest-tasks', 'tasks', { label: 'Latest tasks', limit: 5 }),
        chart('new-customers', 'customers', { label: 'New customers', by: 'time', period: 'last12', as: 'line' }),
      ],
    }),
  ],
  onInit: seed,
})
