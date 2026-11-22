# Upgrading

What a project has to change from one minor version to the next, while the plugin is below 1.0.0. What changed
in each version is in the [changelog](./CHANGELOG.md).

## 0.5 → 0.6

**Most projects only need this:**

1. Run `tsc`. A `where` that the generated types cannot follow no longer compiles: wrap it in `raw(…)`.
2. Start Payload. A field that is not there, in a `where`, a `date` or a measure, now stops it: put the name right,
   or give the plugin `strict: false` for a while.
3. Translated "A figure", "A list" or "A chart"? They are now "Figure", "List" and "Chart".
4. A figure with `overrideAccess` and `fields`: list in `trusted` the fields people may set.
5. Imported `any` from the package? It is `anyOf`.

Everything else is below, the change most projects meet first at the top.

### Contents

1. [`where` is typed against your collections](#1-where-is-typed-against-your-collections)
2. [A field that is not there stops the config, or Payload as it starts](#2-a-field-that-is-not-there-stops-the-config-or-payload-as-it-starts)
3. [Translation keys](#3-translation-keys)
4. [Other type errors](#4-other-type-errors)
5. [`overrideAccess` widgets only take the settings they trust (security)](#5-overrideaccess-widgets-only-take-the-settings-they-trust-security)
6. [Exports moved or renamed](#6-exports-moved-or-renamed)
7. [Slugs a widget cannot have](#7-slugs-a-widget-cannot-have)
8. [What a tile says when it cannot be read](#8-what-a-tile-says-when-it-cannot-be-read)
9. [Errors: `Misconfigured` is no longer an `Unavailable`](#9-errors-misconfigured-is-no-longer-an-unavailable)
10. [Styles: classes, colours and markup](#10-styles-classes-colours-and-markup)
11. [Custom list views: `words`](#11-custom-list-views-words)
12. [What is read, and how](#12-what-is-read-and-how)
13. [The drawer](#13-the-drawer)

### 1. `where` is typed against your collections

**What changed.** With `payload-types.ts` generated, a `where` is checked against the collection. This applies to
widgets, to a source's filters and to a formula's `when`. Each field has to be one the collection has, and its
operator one Payload has. A select or radio takes only its own choices, and a number is compared with a number.
Paths go through groups, named tabs and arrays, two levels deep. A relationship is compared by its id, and the
types do not follow it into the collection it points at.

**Who is affected.** Any project with generated types whose filters use:

- a path through a relationship (`'customer.country'`),
- a field or a choice that is not there,
- an operator written as text that is not one of Payload's,
- or a value of the wrong kind.

Without generated types, or with a `Config` the plugin cannot read, a filter is a plain `Where`, as before.

**Before:**

```ts
figure('croatia', 'orders', { label: 'From Croatia', where: { 'customer.country': { equals: 'Croatia' } } })
```

**After:** the filter is the same, said as one the types do not follow. It is still checked as the config is built.

```ts
import { figure, raw } from 'payload-plugin-widgets'

figure('croatia', 'orders', { label: 'From Croatia', where: raw({ 'customer.country': { equals: 'Croatia' } }) })
```

**`where` on a component or a `read*` function by a slug.** `<Figure source="tasks" where={…}>`,
`<Records source="tasks" where={…}>`, and `readFigure(req, 'tasks', { where })` work out the collection from the
slug, so their `where`, `date` and formulas are checked against its fields, and a field that is not there no longer
compiles. Put the name right, or wrap a filter the types cannot follow in `raw(…)`. A name that is no collection's
slug is not checked.

**Find them:**

```sh
grep -rnE "where: *\{ *'[^']+\.[^']+'" src            # paths with a dot
```

Then let `tsc --noEmit` find the rest.

### 2. A field that is not there stops the config, or Payload as it starts

**What changed.** In 0.5, a field that is not there was only logged as an error when Payload started, and the
tile said so. This covers a field in a `where`, a `date`, a measure or a formula. In 0.6 it **throws**, in one of
two places:

- When the config is built, for the fields of collections that are in the config by then.
- In `onInit`, once Payload has settled the collections. This covers:
  - collections with `auth`, `upload` or `folders`,
  - fields a plugin adds later,
  - `createdAt` and `updatedAt`.

A declared source is checked more fully than before. In 0.5 only its filters and formulas were looked at. Now
each of these is checked against the collection too:

- its `date` and `dates`,
- its `groups`,
- its `scopes`, each called with an id of 0,
- its plain measure fields, which have to be numbers,
- the field a measure's `currency` names.

The message says where in the options each problem is:

```
widgetsPlugin: a widget is set up with what is not there
  - "overdue" at where.dueDat: tasks has no field called "dueDat". Did you mean "dueDate"?
```

**Who is affected.** A project whose config names a field that is not there. Until now such a config only
logged an error. This is more likely after a field was renamed.

**The way out.** Put the names right. To ship first and fix after, `strict: false` brings back 0.5's
behaviour: each such problem is logged as Payload starts, and the tile says the same. `strict: false` only
covers fields. These still stop the config, as they did in 0.5:

- a source, filter, measure, list, group or view that is not there,
- `overrideAccess` without an `access`,
- a slug taken twice (see 7).

```ts
widgetsPlugin({ strict: false, widgets: [/* … */] })
```

**Find them.** Start Payload once with 0.6. Every problem is said at once.

Also new as Payload starts: a warning where a key of `i18n.translations` is nearly, but not quite, one the widgets
say. For example:

```
widgetsPlugin: some translations are of what the widgets do not say
  - de "A figure": did you mean "Figure"?
```

### 3. Translation keys

**What changed.** The three widgets of the drawer are renamed, and there is new text to translate.

| 0.5 key | 0.6 key |
| --- | --- |
| `A figure` | `Figure` |
| `A list` | `List` |
| `A chart` | `Chart` |

New strings:

- the drawer's headings: `What is counted`, `When`, `How it looks`
- the quick-add box: `Add`, `Added`
- on a chart: `Each series is drawn to its own scale`
- on a tile in production: `This widget could not be read`
- what is wrong with a widget, said on its tile:
  - `"{name}" of {source} is not a number`
  - `{field} is a date: "{name}" is neither a date (YYYY-MM-DD) nor a moment such as "today" or "startOfMonth-1m"`
  - `In the formula, at "{at}": {way} takes two parts, not {count}`
  - `In the formula, at "{at}": {way} takes at least one part`
  - `In the formula, at "{at}": when takes what a record has to have, and a then`
  - `In the formula, at "{at}": a part is a number, a number field, or one of add, subtract, multiply, divide, first and when`
  - `There are two widgets called "{name}"`
  - `This took longer to read than the {seconds} s it is given`
  - `A widget cannot be called "{name}": {owner} has one called that`

`STRINGS` lists all of them.

**Who is affected.** Projects with `i18n.translations`, or with an `i18n.translate` of their own that keys on
these words.

**Before / after:**

```ts
// 0.5
translations: { de: { 'A figure': 'Eine Kennzahl', 'A list': 'Eine Liste', 'A chart': 'Ein Diagramm' } }
// 0.6
translations: { de: { Figure: 'Kennzahl', List: 'Liste', Chart: 'Diagramm', 'What is counted': 'Was gezählt wird', When: 'Wann', 'How it looks': 'Wie es aussieht' } }
```

**Find them:**

```sh
grep -rnE "'A (figure|list|chart)'" src
```

### 4. Other type errors

Each of these is a type error now, and most were already a config error in 0.5.

- **A measure said in place is of a number field.** `measure: { max: 'title' }` compiled before and failed as the
  config was built. It no longer compiles. The same goes for a measure of a declared source,
  `measures: { x: { sum: 'title' } }`.
- **Progress needs a goal.** A figure with `as: 'progress'` and no `goal` does not compile.
- **`sources: { name: false }` only for a collection there is.** With generated types, `false` is only taken for a
  real collection slug. Remove the entry for a collection the project no longer has:

  ```ts
  // a project without a media collection
  widgetsPlugin({ sources: { media: false } })   // 0.6: a type error
  ```

- **A label in several languages.** A ready-made widget's `label` and an `action`'s `label` now take
  `{ en: 'Orders', de: 'Bestellungen' }` as a source's could. This does not break anything, but a type of the
  project's own that copies `Action` as `{ label: string }` may need widening.
- **`list` may be left out of a declared source.** `list('x', tasks, { label })` takes the first list the source
  declares. Nothing breaks.

**Find them:** `tsc --noEmit`, and:

```sh
grep -rnE "sources: *\{[^}]*: *false" src
```

### 5. `overrideAccess` widgets only take the settings they trust (security)

**What could happen before.** A figure that a developer wrote with `overrideAccess: true` and settings of its own
(`fields` and `data`) handed `context.data` whatever the person with it on their dashboard had saved. Anybody
who could edit their dashboard could set any of those settings to any value, including through Payload's API for
preferences. They could set fields the drawer did not show, and values outside a select's options.

A measure or filter that read `context.data` then read with the server's access. For example, a figure of
"revenue of my team" read `context.data.team`. Anybody it was for could make it count another team's records, or
anything the measure could be pointed at, past what their own access lets them read.

**What changed.** For a widget with `overrideAccess`, the saved settings reach `context.data` only for the fields
listed in `trusted`. Every other setting is what the widget's `data` starts it as, whatever was saved. With no
`trusted`, nothing saved is used. A widget without `overrideAccess` is not affected: it reads as the person, so
what they set cannot show more than they may read.

**Who is affected.** A ready-made figure with both `overrideAccess` and `fields`. If it relied on people's
settings, those settings now stay at their defaults until they are listed in `trusted`.

**Before:**

```ts
figure('team-revenue', 'orders', {
  label: 'Revenue of the team', measure: 'total', overrideAccess: true, access: staff,
  fields: [{ name: 'team', type: 'select', options: ['north', 'south'] }],
  data: { team: 'north' },
})
```

**After:** say which settings may be trusted. Only list one whose every value is safe for everybody the widget is
for, since a value outside the field's options can still be saved.

```ts
figure('team-revenue', 'orders', {
  label: 'Revenue of the team', measure: 'total', overrideAccess: true, access: staff,
  fields: [{ name: 'team', type: 'select', options: ['north', 'south'] }],
  data: { team: 'north' },
  trusted: ['team'],
})
```

A measure that reads a trusted setting should still check the value it is given.

**Find them:**

```sh
grep -rn "overrideAccess" src | grep -v "overrideAccess: false"
```

Then look at those that also have `fields`. Only a figure has settings of its own, so only `figure(…)` takes
`trusted`.

### 6. Exports moved or renamed

The root entry, `payload-plugin-widgets`, no longer exports everything in its source files. It exports what is
settled. The less settled helpers are under a new entry, `payload-plugin-widgets/advanced`, which may change in a
minor version.

| 0.5 | 0.6 |
| --- | --- |
| `any(…)` | `anyOf(…)` |
| `type ReadyWidget` (the type of what `figure`, `list`, `chart` and `widget` return) | `type WidgetDefinition` |
| `Selection` (the class) | `payload-plugin-widgets/advanced`; the root keeps the type |
| `worded`, `labelled`, `nameOf`, `amountOf`, `shown`, `added`, `CALCS` | `payload-plugin-widgets/advanced` |
| `combined`, `counted`, `fetched`, `currencyOf`, `MANY` | `payload-plugin-widgets/advanced` |
| `CALLED`, `calcOf` | gone |

New at the root:

- the option types `FigureOptions`, `ListOptions`, `ChartOptions` and `Sources`,
- `ProblemCode`, `Series`, `FigureReading`,
- `ReadFigureOptions`, `ReadListOptions`, `ReadChartOptions`,
- `FieldWhere`, `WhereOf`, `RawWhere` and `raw`.

New in `/advanced`: `coded`, `inWords`, `problemsOf`, `Said` and `isMoment`. The component `ReadyWidget` in
`/rsc` keeps its name.

**Before / after:**

```ts
// 0.5
import { any, worded, type ReadyWidget } from 'payload-plugin-widgets'
// 0.6
import { anyOf, type WidgetDefinition } from 'payload-plugin-widgets'
import { worded } from 'payload-plugin-widgets/advanced'
```

**Find them:**

```sh
grep -rnE "import[^;]*\b(any|ReadyWidget|Selection|worded|labelled|nameOf|amountOf|shown|added|CALCS|CALLED|calcOf|combined|counted|fetched|currencyOf|MANY)\b[^;]*from 'payload-plugin-widgets'" src
```

### 7. Slugs a widget cannot have

**What changed.** These now stop the config from being built:

- Two ready-made widgets with the same slug.
- A widget called `figure`, `records` or `chart`, which are the drawer's widgets.
- A widget called `collections`, which is Payload's.
- A widget with the slug of one already under `admin.dashboard.widgets`.

`strict: false` does not change this.

**Find them:** start Payload, or:

```sh
grep -rhoE "(figure|list|chart|widget)\('[^']+'" src | cut -d"'" -f2 | sort | uniq -d   # slugs used twice
grep -rnE "(figure|list|chart|widget)\('(figure|records|chart|collections)'" src
```

### 8. What a tile says when it cannot be read

**What changed.** When `NODE_ENV` is `production`, a ready-made widget, or a `<Figure>`, `<Records>` or `<Chart>`
on a page of the project's own, now says only "This widget could not be read" in place of what is wrong. This
covers the field problems under `strict: false`. The full reason is logged, each time the tile is drawn, as
`widgets: "<label>" could not be read: …`. A read that took longer than `limits.timeoutMs` is not covered: its
tile says so to anybody, in production as well, and it is logged as a warning.

A widget somebody set up in the drawer still says what is wrong, in the admin's names for the collection and its
fields. A component can ask for the same with `owned`. "Not available to this account" is said as before.

**Who is affected.** Anybody who relied on the tile to show the problem in production. Read the log instead.

### 9. Errors: `Misconfigured` is no longer an `Unavailable`

**What changed.**

- `Misconfigured` extends `Error`, not `Unavailable`.
- Every `Problem` has a `code` (see [the problem codes](https://github.com/m-grgic/payload-plugin-widgets/blob/main/docs/errors.md#problem-codes))
  and, where it is known, a `path`, such as `widgets.overdue.where.dueDate`.
- What `widgetsPlugin` throws as the config is built is a `Misconfigured` too, with those paths. In 0.5 it was a
  plain `Error`, and each line of its message is now `  - "slug" at path: …` where it was `  - "slug": …`.

**Who is affected.** Code around `readFigure`, `readList` or `readChart` that catches `Unavailable` to handle
both. Tests that match the startup message exactly.

**Before / after:**

```ts
// 0.5: this caught both
catch (error) { if (error instanceof Unavailable) return null }
// 0.6
catch (error) { if (error instanceof Unavailable || error instanceof Misconfigured) return null }
```

**Find them:**

```sh
grep -rn "instanceof Unavailable\|name === 'Unavailable'" src
```

### 10. Styles: classes, colours and markup

Only a project that styles the tiles itself is affected. Class names that existed keep their names.

- **Eight series colours, not six.** The ninth series is drawn as the first again; before, the seventh was. When
  not set, the series are no longer the admin's theme colours. They are eight colours of the plugin's own, one set
  for the light theme and one for the dark, told apart with the common kinds of colour blindness. The first is
  still `--widgets-accent` where that is set. A project that set `--widgets-series-1` to `-6` keeps its colours,
  and may set `-7` and `-8`. See [theming](https://github.com/m-grgic/payload-plugin-widgets/blob/main/docs/theming.md#series-colours).
  To get 0.5's colours back:

  ```css
  :root {
    --widgets-series-1: var(--widgets-accent, var(--theme-success-500)); --widgets-series-2: var(--theme-warning-500);
    --widgets-series-3: var(--theme-elevation-800); --widgets-series-4: var(--theme-error-500);
    --widgets-series-5: var(--theme-success-300); --widgets-series-6: var(--theme-elevation-400);
  }
  ```

- **New classes:**
  - `.widgets-tip` with `__label`, `__value` and `__mark`: what a column or a point comes to, shown on the
    pointer and on focus.
  - `.widgets-scale` with `__tick`: the top of the columns or the line, and nought.
  - `.widgets-line__zero`, `.widgets-line__dot`.
  - `.widgets-legend__note`: "Each series is drawn to its own scale".
  - `.widgets-tile__field`, `__submit`, `__done`: the quick-add box now has a button and a line that says what was
    added.
- **New attributes:**
  - `data-signed` on a chart or a line with an amount below nought, and `data-below` on that bar or column.
  - `data-align` on a tooltip.
  - `data-ticks` and `data-tick` on the scale.
  - The internal variables are `--widgets-at`, `--widgets-gutter`, `--widgets-zero`, `--widgets-scale-*` and
    `--widgets-palette-*`. They are not for a project to set.
- **Markup:**
  - A chart has a hidden table of its figures for a screen reader, `table.widgets-hidden`.
  - A line's points that lead nowhere are a `span`, where before only those with a link were drawn.
  - A line's points have no `title` any more: the tooltip says it.
  - Side by side, series whose highest values differ are each drawn to their own scale, with a note under the
    legend. Before, each was drawn against its own highest without a note.

**Find them:**

```sh
grep -rnE "widgets-series-|widgets-line__point|widgets-legend|widgets-tile__add|widgets-hidden" src --include=*.css --include=*.scss
```

### 11. Custom list views: `words`

**What changed.** `ListViewProps.words` is `{ add, failed, submit, added }`; it was `{ add, failed }`. The
`QuickAdd` client component takes `submit` (default "Add") and `added` (default "Added").

**Who is affected.** A list view of the project's own that builds its own `words` object, or a test that types
one.

**Find them:**

```sh
grep -rn "ListViewProps\|QuickAdd" src
```

### 12. What is read, and how

None of these needs a change to the config, but a figure may come out differently or take a different path:

- **More is read record by record on Postgres.** A collection with a `beforeOperation`, `beforeRead`, `afterRead`
  or `afterOperation` hook is now read record by record. In 0.5 only an `afterRead` hook did this. Those hooks
  could change what a record reads as, so the database's sum might not have been what the records come to. Such a
  sum is now capped at `limits.records`, 5,000 when not set.
- **A tally keeps 1,000 values apart.** A field with more distinct values than `limits.groups` has the rest
  counted together as one. A chart still draws its first eight and "Other".
- **The titles of what a chart's bars point at are read as the person looking**, even under `overrideAccess`. A
  bar whose record they may not read is named by its id.
- **What is wrong with a filter names no field the person may not read.** A field they cannot read is not
  checked for them, unless the widget reads with `overrideAccess`.
- **Every read is made once a request.** Even without `cache`, a figure or a chart read twice in one request, and
  a collection's access asked twice, is asked once.

### 13. The drawer

- The drawer's widgets are called "Figure", "List" and "Chart".
- Their settings are under three headings: What is counted, When, How it looks. The Title is last, under "How it
  looks". A list has no "When". What is saved is as flat as before, so nothing set up before is lost.
- `userWidgets` (new) can narrow who may set them up, of which kinds and of which sources. Without it, everybody
  signed in may set up all three of any source that is for them, as before. It is asked on every request, so a
  widget set up before something was taken away shows "Not available to this account".
