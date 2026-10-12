import type { Field, Option, PayloadRequest, Widget } from 'payload'
import type { Settings } from './options'
import { PERIODS, VIEWS, worded, type AnySource, type Kind, type Label, type Measure } from './types'

// The widgets somebody sets up themselves, and the form each is set up with. A choice is kept as `source.name`, so
// the ones offered can follow the source that is chosen, and only the sources somebody has a use for are offered at all.
// Nothing here may import a component: this is read by the Payload config.

/** Where the components are, as the import map is told: by the name of the package, so it is found wherever it is installed. */
const COMPONENTS = 'payload-plugin-widgets/rsc'
export const component = (name: string) => `${COMPONENTS}#${name}`
/** The fields of the settings that are drawn by a component of their own. */
const FIELDS = 'payload-plugin-widgets/client'

const TILE = { minWidth: 'x-small', maxWidth: 'medium' } as const
const LIST = { minWidth: 'small', maxWidth: 'full' } as const
export const sized = (kind: 'figure' | 'list' | 'chart') => (kind === 'figure' ? TILE : LIST)

type Narrow = { options: Option[]; siblingData: Record<string, unknown>; req: PayloadRequest }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = Record<string, any>

/** Fields written in English, said in the admin's languages; a label that already is in several is left as it is. They are flat: the form of a widget cannot draw fields inside a row. */
export const said = (fields: Field[], label: (english: Label) => Label): Field[] => fields.map(original => {
  const field: Loose = { ...original }
  if (typeof field.label === 'string') field.label = label(field.label)
  if (typeof field.admin?.description === 'string') field.admin = { ...field.admin, description: label(field.admin.description) }
  if (Array.isArray(field.options)) {
    field.options = field.options.map((option: Loose) => ({ ...option, label: typeof option.label === 'string' ? label(option.label) : option.label }))
  }
  return field as Field
})

export const setUp = (settings: Settings): Widget[] => {
  const { sources, label } = settings

  // a label that is already in several languages is taken as it is
  const choices = (pick: (from: AnySource) => Record<string, Label>): Option[] =>
    Object.entries(sources).flatMap(([name, from]) => Object.entries(pick(from)).map(([key, text]) => ({ label: label(text), value: `${name}.${key}` })))
  const labels = (parts: Record<string, { label: Label }> | undefined, keep: (part: never) => boolean = () => true) =>
    Object.fromEntries(Object.entries(parts ?? {}).filter(([, part]) => keep(part as never)).map(([key, part]) => [key, part.label]))

  /** Only what the chosen source has. */
  const ofSource = ({ options, siblingData }: Narrow) =>
    options.filter(option => typeof option !== 'string' && (!option.value.includes('.') || option.value.startsWith(`${String(siblingData?.source)}.`)))
  // who a source says it is for is settled here, where it says so at once: one that has to wait for its answer is
  // offered, and refused when it is read. What follows its collection's access is settled by the field itself.
  const forViewer = ({ options, req }: Narrow) => options.filter(option => {
    if (typeof option === 'string' || !sources[option.value]) return false
    try {
      return !!(sources[option.value].access?.({ req }) ?? true)
    } catch {
      return false
    }
  })
  const collections = Object.fromEntries(Object.entries(sources).map(([name, source]) => [name, source.slug as string]))
  /** Only where the chosen source has any of them. */
  const has = (pick: (from: AnySource) => object | undefined, more = 0) => (data: unknown, sibling: { source?: unknown } | undefined) =>
    Object.keys(pick(sources[String(sibling?.source)] ?? ({} as AnySource)) ?? {}).length > more

  const title: Field = { name: 'title', type: 'text', label: 'Title', admin: { description: 'Leave empty to have it named after what it shows.' } }
  const from: Field = {
    name: 'source', type: 'select', label: 'Of what', required: true,
    options: Object.entries(sources).map(([name, source]) => ({ label: label(source.label ?? worded(source.slug)), value: name })),
    filterOptions: forViewer as never,
    admin: { components: { Field: { path: `${FIELDS}#SourceField`, clientProps: { collections } } } },
  }
  const filter: Field = {
    name: 'filter', type: 'select', label: 'Which ones',
    options: choices(source => labels(source.filters)),
    filterOptions: ofSource as never,
    admin: { condition: has(source => source.filters), description: 'Leave empty for all of them.' },
  }
  // any filter the lists of the admin take, set up with their builder; the collection it asks for is kept beside it
  const where: Field[] = [
    { name: 'relatedCollection', type: 'text', admin: { components: { Field: `${FIELDS}#Unseen` } } },
    {
      name: 'where', type: 'json', label: 'Only those where',
      admin: { components: { Field: { path: `${FIELDS}#WhereField`, clientProps: { collections } } } },
    },
  ]
  const period: Field = { name: 'period', type: 'select', label: 'Period', defaultValue: 'all', options: PERIODS.map(option => ({ ...option })) }
  const between = (data: unknown, sibling: { period?: unknown } | undefined) => sibling?.period === 'custom'
  const dates: Field[] = [
    {
      name: 'date', type: 'select', label: 'Going by',
      options: choices(source => source.dates ?? {}),
      filterOptions: ofSource as never,
      admin: { condition: has(source => source.dates, 1), description: 'Leave empty for the usual date.' },
    },
    { name: 'from', type: 'date', label: 'From', admin: { condition: between, description: 'Leave empty for no beginning.' } },
    { name: 'to', type: 'date', label: 'Until', admin: { condition: between, description: 'Leave empty for until now.' } },
  ]

  // only for a measure that makes one figure of a number in each record, and is not just how many there are
  const reckons = (data: unknown, sibling: { source?: unknown; measure?: unknown } | undefined) => {
    const name = typeof sibling?.measure === 'string' && sibling.measure.startsWith(`${String(sibling.source)}.`) ? sibling.measure.slice(String(sibling.source).length + 1) : ''
    const measure = sources[String(sibling?.source)]?.measures[name] as Measure | undefined
    return !!measure?.amount && !measure.counts
  }
  const calc: Field = {
    name: 'calc', type: 'select', label: 'Worked out as', defaultValue: 'sum',
    options: [{ label: 'Added up', value: 'sum' }, { label: 'On average', value: 'avg' }, { label: 'The lowest', value: 'min' }, { label: 'The highest', value: 'max' }],
    admin: { condition: reckons },
  }

  // offered only where there is a choice: the plugin's own ways for the kind, and the project's
  const drawn = (kind: Kind): Field[] => {
    const options = [
      ...Object.entries(VIEWS[kind]).map(([value, text]) => ({ label: text as Label, value })),
      ...Object.entries(settings.views).filter(([, view]) => view.kind === kind).map(([value, view]) => ({ label: view.label, value })),
    ]
    return options.length > 1 ? [{ name: 'as', type: 'select', label: 'Drawn as', defaultValue: options[0].value, options: options.map(option => ({ ...option, label: label(option.label) })) } as Field] : []
  }

  const widgets: (Widget & { label: string })[] = [
    {
      slug: 'figure', label: 'A figure', Component: component('FigureWidget'), ...TILE,
      fields: [
        title, from, filter, ...where,
        {
          name: 'measure', type: 'select', label: 'What about them',
          options: choices(source => labels(source.measures)),
          filterOptions: ofSource as never,
          admin: { description: 'Leave empty for how many there are.' },
        },
        calc, period, ...dates,
        {
          name: 'compare', type: 'select', label: 'Compared with', options: [{ label: 'The period before', value: 'previous' }],
          admin: { condition: (data, sibling) => !!sibling?.period && !['all', 'past', 'upcoming'].includes(String(sibling.period)), description: 'Leave empty for no comparison.' },
        },
        { name: 'goal', type: 'number', label: 'Goal', min: 0, admin: { description: 'What it is set against. Leave empty for none.' } },
        ...drawn('figure'),
        {
          name: 'note', type: 'text', label: 'Line under it',
          admin: { description: 'Leave empty for the usual one. It can use {value}, {note}, {previous}, {change}, {goal}, {percent} and {left}.' },
        },
      ],
    },
    {
      slug: 'records', label: 'A list', Component: component('RecordsWidget'), ...LIST,
      fields: [
        title, from,
        {
          name: 'list', type: 'select', label: 'Which list',
          options: choices(source => labels(source.lists)),
          filterOptions: ofSource as never,
          admin: { condition: has(source => source.lists, 1) },
        },
        filter, ...where,
        { name: 'limit', type: 'number', label: 'How many rows', defaultValue: 6, min: 1, max: 20 },
        ...drawn('list'),
      ],
    },
    {
      slug: 'chart', label: 'A chart', Component: component('ChartWidget'), ...LIST,
      fields: [
        title, from, filter, ...where,
        {
          name: 'measure', type: 'select', label: 'What is drawn',
          options: choices(source => labels(source.measures, (measure: { amount?: unknown }) => !!measure.amount)),
          filterOptions: ofSource as never,
          admin: { description: 'Leave empty for how many there are.' },
        },
        calc,
        {
          name: 'by', type: 'select', label: 'Split by', defaultValue: 'time',
          options: [{ label: 'Over time', value: 'time' }, ...choices(source => (source.groups ?? {}) as Record<string, Label>)],
          filterOptions: ofSource as never,
        },
        {
          name: 'series', type: 'select', label: 'A series for each',
          options: choices(source => (source.groups ?? {}) as Record<string, Label>),
          filterOptions: ofSource as never,
          admin: { condition: has(source => source.groups, 1), description: 'Leave empty for one.' },
        },
        ...drawn('chart'), period, ...dates,
      ],
    },
  ]

  return widgets.map(widget => ({ ...widget, label: label(widget.label), ...(widget.fields ? { fields: said(widget.fields, label) } : {}) }))
}
