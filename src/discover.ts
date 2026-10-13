import type { Access, CollectionConfig, CollectionSlug, Config, Field, Where } from 'payload'
import { at } from './formula'
import { count, labelled, reckoned, rows, sum, type AnySource, type Format, type Label, type Measure } from './types'

// What a collection offers to the widgets without anybody declaring it, read out of its fields: how many there are,
// a sum for each number, a group for each select, checkbox and relationship, every date a period can go by, how to
// narrow it to one of what it points at, and a list of the latest. Fields inside a group, a named tab or the rows of
// an array are found as well, under their paths (`totals.net`, `items.price`); those in blocks are not. Which of its
// records is not found here: that is a filter as Payload takes them, which a widget is given (see `where` in ./read).
// Nothing here may import a component: this is read by the Payload config.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any

/**
 * What a field can say about itself to the widgets, under `custom.widgets`: `false` to be left out, or how its
 * number is written and, where that is money, the field that holds the currency.
 *
 *   { name: 'total', type: 'number', custom: { widgets: { format: 'money', currency: 'currency' } } }
 */
export type FieldHint = false | { format?: Format; currency?: string }

/**
 * What a collection can say about itself, under `custom.widgets`: `false` to be no source at all, or what it is
 * called, the date its periods go by, and who it is for where that is fewer than may read it.
 *
 *   { slug: 'audit-log', custom: { widgets: false }, fields: […] }
 *   { slug: 'tasks', custom: { widgets: { date: 'dueDate' } }, fields: […] }
 *
 * What the plugin is given under `sources` comes first: `true` there brings back a collection that says `false`.
 */
export type CollectionHint = false | { label?: Label; date?: string; access?: Access }

// so the editor offers both where a field or a collection is written
declare module 'payload' {
  interface FieldCustom { widgets?: FieldHint }
  interface CollectionCustom { widgets?: CollectionHint }
}

type Named = Field & { name: string }

/** A field with where it is: its path, what it is called with what it is in, whether a record has several of it, and what is beside it. */
interface Placed { field: Named; path: string; label: Label; rows: boolean; beside: string[] }

const hintOf = (field: Field): FieldHint | undefined => (field as { custom?: { widgets?: FieldHint } }).custom?.widgets
const saysOf = (collection: CollectionConfig): CollectionHint | undefined => collection.custom?.widgets

/** Kept in the database and meant to be seen: one the admin hides is the project's own bookkeeping. */
const usable = (field: Field) => {
  const { virtual, hidden, admin } = field as { virtual?: unknown; hidden?: unknown; admin?: { hidden?: unknown } }
  return !virtual && hidden !== true && admin?.hidden !== true && hintOf(field) !== false
}

/** The fields a record has under their names, seen through what only lays them out: rows, collapsibles and tabs and groups without a name. */
const named = (fields: Field[]): Named[] => fields.flatMap((field): Named[] => {
  if (field.type === 'row' || field.type === 'collapsible') return named(field.fields)
  if (field.type === 'tabs') return field.tabs.flatMap(tab => ('name' in tab && tab.name ? [{ ...tab, type: 'group' } as unknown as Named] : named(tab.fields)))
  if (field.type === 'group' && !('name' in field && field.name)) return named(field.fields)
  return 'name' in field && field.name ? [field as Named] : []
})

/**
 * Every field of a record with where it is: those at its top, and those inside a group, a named tab or the rows of
 * an array, which are called after both: "Totals: Net". Not what is in the rows of rows, and not what is in blocks.
 */
const flat = (fields: Field[], prefix = '', within?: Label, rows = false): Placed[] => {
  const here = named(fields).filter(usable)
  const beside = here.map(field => field.name)
  return here.flatMap((field): Placed[] => {
    const own = labelled((field as { label?: unknown }).label, field.name)
    const label = typeof within === 'string' && typeof own === 'string' ? `${within}: ${own}` : own
    const path = `${prefix}${field.name}`
    if (field.type === 'group') return flat(field.fields, `${path}.`, label, rows)
    if (field.type === 'array') return rows ? [] : flat(field.fields, `${path}.`, label, true)
    return [{ field, path, label, rows, beside }]
  })
}

const one = (field: Named): field is Named & { relationTo: string } =>
  (field.type === 'relationship' || field.type === 'upload') && typeof field.relationTo === 'string'

/** A collection as a source, from its fields alone. */
export const discovered = (collection: CollectionConfig): AnySource => {
  const fields = flat(collection.fields)
  const stamped = collection.timestamps !== false

  // a period goes by a date of the record itself, not by one its rows have
  const dates: Record<string, Label> = {
    ...(stamped ? { createdAt: 'Created', updatedAt: 'Updated' } : {}),
    ...Object.fromEntries(fields.filter(({ field, rows }) => field.type === 'date' && !rows).map(({ path, label }) => [path, label])),
  }
  const says = saysOf(collection) || {}
  const date = says.date ?? (stamped ? 'createdAt' : Object.keys(dates)[0])

  const measures: Record<string, Measure> = { count: count() }
  for (const { field, path, label, rows, beside } of fields) {
    if (field.type !== 'number' || field.hasMany) continue
    const hint = hintOf(field) || {}
    // the currency is the field beside it where there is one of that name, as the hint is written beside it
    const currency = hint.currency && !rows && path.includes('.') && beside.includes(hint.currency) ? `${path.slice(0, path.lastIndexOf('.') + 1)}${hint.currency}` : hint.currency
    measures[path] = sum<Loose>(label, path, hint.format ?? 'number', currency ? { currency } : {})
  }

  const groups = Object.fromEntries(fields
    .filter(({ field }) => field.type === 'select' || field.type === 'radio' || field.type === 'checkbox' || one(field))
    .map(({ path, label }) => [path, label]))

  const scopes = Object.fromEntries(fields.filter(({ field, rows }) => one(field) && !rows).map(({ path }) => [path, (id: number | string): Where => ({ [path]: { equals: id } })]))

  const title = collection.admin?.useAsTitle && collection.admin.useAsTitle !== 'id' ? collection.admin.useAsTitle : undefined
  const select = [...(title ? [title] : []), ...(date ? [date] : [])]

  return {
    slug: collection.slug as CollectionSlug,
    label: says.label ?? labelled(collection.labels?.plural, collection.slug),
    ...(says.access ? { access: says.access } : {}),
    ...(collection.versions && typeof collection.versions === 'object' && collection.versions.drafts ? { draft: true } : {}),
    ...(date ? { date } : {}),
    dates,
    filters: {},
    measures,
    lists: {
      latest: rows<Loose, string>('The latest', {
        select, sort: date ? `-${date}` : '-id', empty: 'Nothing here yet',
        row: (doc: Record<string, unknown>, { day, date: dayOf }) => ({
          title: String((title && doc[title]) || `#${doc.id}`),
          detail: date && typeof at(doc, date) === 'string' ? day(dayOf(at(doc, date) as string)) : '',
        }),
      }),
    },
    groups,
    scopes,
  }
}

/** What is declared, with what was found in the collection for whatever it does not say itself. */
const merged = (declared: AnySource, found: AnySource): AnySource => {
  // a number that a declared measure already adds up is not offered a second time
  const own = declared.measures as Record<string, Measure>
  const summed = new Set(Object.values(own).map(({ amount }) => ((amount?.how ?? 'sum') === 'sum' ? (amount?.plain ? amount.plain.field : amount?.select[0]) : undefined)).filter(Boolean))
  const sums = Object.fromEntries(Object.entries(found.measures as Record<string, Measure>).filter(([name]) => !summed.has(name)))
  // one declared without saying how it is written is written as its field says
  const written = Object.fromEntries(Object.entries(own).map(([name, measure]) => {
    const like = measure.amount?.loose ? (found.measures as Record<string, Measure>)[measure.amount.select[0]]?.amount : undefined
    return [name, like ? reckoned(measure.label, { ...measure.amount, format: like.format, currency: like.currency, select: like.select } as never, { filter: measure.filter }) : measure]
  }))
  return {
    ...declared,
    label: declared.label ?? found.label,
    ...(declared.access ?? found.access ? { access: declared.access ?? found.access } : {}),
    ...(declared.draft ?? found.draft ? { draft: true } : {}),
    date: declared.date ?? found.date,
    dates: { ...found.dates, ...declared.dates },
    measures: { ...sums, ...written },
    lists: declared.lists && Object.keys(declared.lists).length ? declared.lists : found.lists,
    groups: { ...found.groups, ...declared.groups },
    scopes: { ...found.scopes, ...declared.scopes },
  }
}

/**
 * Every source the widgets read, by name: those the project declares, and every other collection of the config
 * under its slug. `false` leaves a collection out, here or in its own `custom.widgets`; one the admin hides from
 * everybody is left out too.
 */
export const sourcesOf = (given: Record<string, AnySource | boolean | undefined> = {}, config: Config, discover = true): Record<string, AnySource> => {
  const collections = new Map((config.collections ?? []).map(collection => [collection.slug as string, collection]))
  const declared = Object.entries(given).filter((entry): entry is [string, AnySource] => typeof entry[1] === 'object' && !!entry[1])
  const sources: Record<string, AnySource> = {}

  for (const [name, source] of declared) {
    const collection = collections.get(source.slug)
    sources[name] = collection && discover && source.discover !== false ? merged(source, discovered(collection)) : source
  }
  if (!discover) return sources

  const covered = new Set(declared.map(([, source]) => source.slug as string))
  for (const [slug, collection] of collections) {
    if (given[slug] === false || covered.has(slug) || slug in sources || collection.admin?.hidden === true) continue
    // what the collection says of itself, unless the plugin was told otherwise
    if (saysOf(collection) === false && given[slug] !== true) continue
    sources[slug] = discovered(collection)
  }
  return sources
}
