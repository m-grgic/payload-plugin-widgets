// Everything the widgets say, in the English it is written in: what a project translates to have them speak another
// of the admin's languages. `{name}` and the like are filled in afterwards and stay as they are.
//
//   widgetsPlugin({ i18n: {
//     translations: { de: { 'Today': 'Heute', 'by {what}': 'nach {what}' } },
//     plurals: { de: { record: { one: 'Eintrag', other: 'Einträge' } } },
//   } })
//
// What a project writes itself (the label of a source, of a measure, of a widget) is said the same way, so it goes
// in the same dictionary. Nothing here may import a component: this is read by the Payload config.

export const STRINGS = [
  // what a widget is, before it is set up
  'Widget', 'A figure', 'A list', 'A chart',
  'Choose what it shows: the pencil on the widget while editing the dashboard',
  // its settings
  'Title', 'Leave empty to have it named after what it shows.',
  'Of what', 'Which ones', 'Leave empty for all of them.', 'Only those where',
  'What about them', 'Leave empty for how many there are.',
  'Worked out as', 'Added up', 'On average', 'The lowest', 'The highest',
  'Which list', 'How many rows', 'What is drawn', 'Split by', 'Over time',
  'Drawn as', 'A number', 'Progress towards a goal', 'A number over a line', 'Rows', 'Bars', 'Columns', 'A line',
  'Compared with', 'The period before', 'Leave empty for no comparison.', 'Goal', 'What it is set against. Leave empty for none.',
  'Line under it', 'Leave empty for the usual one. It can use {value}, {note}, {previous}, {change}, {goal}, {percent} and {left}.',
  'Period', 'Going by', 'Leave empty for the usual date.',
  'From', 'Leave empty for no beginning.', 'Until', 'Leave empty for until now.',
  // periods
  'A series for each', 'Leave empty for one.',
  'Any time', 'Today', 'Before today', 'From today on', 'This month', 'This year', 'The last 30 days', 'The last 12 months', 'Between two dates',
  // what a collection has without declaring it
  'How many', 'Average {what}', 'Lowest {what}', 'Highest {what}', 'Created', 'Updated', 'The latest', 'Nothing here yet',
  // on a tile
  '+ New', 'That could not be added.', 'Nothing recorded yet', 'Nothing to show yet',
  '{count} in all', '{count} in another currency left out', 'Only the first {count} are counted',
  '{change} on the period before', 'Nothing in the period before', '{percent} of {goal}', 'by {what}', 'Yes', 'No', 'None', 'Other',
  // what cannot be shown
  'Not available to this account', 'This could not be read',
  // what is set up wrong
  'There is no source called "{name}"',
  '{source} has no filter called "{name}"',
  '{source} has no measure called "{name}"',
  '{source} has no measure called "{name}" that can be drawn',
  '{source} has no number called "{name}"',
  'A measure said in place is the sum, avg, min or max of a number',
  '{source} has no list called "{name}"',
  '{source} has no list to show',
  '{source} cannot be split by "{name}"',
  '{source} cannot be narrowed to a "{name}"',
  '{source} has no field called "{name}"',
  '"{name}" is not a way to compare {field}',
  '{field} has no choice called "{name}": it is one of {choices}',
  '"{name}" of {source} is not a date',
  'A {kind} cannot be drawn as "{name}"',
  'A list is read as whoever looks at it: only a figure or a chart takes overrideAccess',
  'What is read with overrideAccess has to say who it is for: give it or its source an access',
  'A chart tells apart its measures or what is in a field, not both', 'A chart cannot be split by "{name}" twice',
  'Progress is towards a goal: give it one',
  'There is nothing before this to compare it with: give it a period that has a beginning',
  '"{name}" of {source} gives no number to compare or to set against a goal',
  'Did you mean "{name}"?',
] as const

/** What is counted, as it is called for one and for more of it. */
export const PLURALS = [['record', 'records']] as const

export type WidgetString = typeof STRINGS[number]

/** The widgets' words in one language, and the project's own next to them. */
export type Dictionary = Partial<Record<WidgetString, string>> & Record<string, string>

/** What something counted is called in one language, by how the language counts it: `{ one: 'zapis', few: 'zapisa', other: 'zapisa' }`. */
export type Plurals = Record<string, Partial<Record<Intl.LDMLPluralRule, string>>>
