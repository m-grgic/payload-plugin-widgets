import type { CollectionSlug, PayloadRequest, Where } from 'payload'
import { mayRead, settingsOf } from './options'
import { dayIn, startOf } from './time'
import type { Context, Viewer } from './types'

const query = (value: unknown, prefix: string): string[] => {
  if (Array.isArray(value) && value.every(item => typeof item !== 'object')) return [`${encodeURIComponent(prefix)}=${encodeURIComponent(value.join(','))}`]
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, inner]) => query(inner, `${prefix}[${key}]`))
  }
  return [`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`]
}

/** What the sources are read with: the person looking, today, and how to say things in their language. */
export const contextFor = (req: PayloadRequest, data: Record<string, unknown> = {}): Context => {
  const { payload } = req
  const settings = settingsOf(payload)
  const { t, plural, locale } = settings.words(req)
  const zone = settings.timeZone
  // the user handed to a widget has the fields they may not read taken out, and reading as that user
  // is refused everything. The one on the request is whole.
  const user = req.user as Viewer
  const admin = payload.config.routes.admin
  const today = dayIn(zone, new Date())
  const money = (amount: number, currency: string) => settings.format(amount, 'money', locale, currency.toUpperCase())
  return {
    payload,
    as: { depth: 0, overrideAccess: false, user },
    sources: settings.sources,
    mayRead: source => mayRead(settings, req, source),
    today,
    dayStart: startOf(zone, today),
    monthStart: startOf(zone, `${today.slice(0, 7)}-01`),
    yearStart: startOf(zone, `${today.slice(0, 4)}-01-01`),
    date: value => dayIn(zone, value),
    instant: date => startOf(zone, date),
    weekStartsOn: settings.weekStartsOn,
    currency: settings.currency,
    data,
    list: (slug: CollectionSlug, where?: Where) => `${admin}/collections/${slug}${where ? `?${query(where, 'where').join('&')}` : ''}`,
    edit: (slug: CollectionSlug, id: number | string) => `${admin}/collections/${slug}/${id}`,
    t,
    plural,
    number: value => settings.format(value, 'number', locale),
    hours: minutes => settings.format(minutes / 60, 'hours', locale),
    money,
    total: totals => [...totals].map(([currency, amount]) => money(amount, currency)).join(' + '),
    day: date => new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    month: date => new Date(`${date.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString(locale, { month: 'short', year: '2-digit', timeZone: 'UTC' }),
  }
}
