# Changelog

What changed in each version that was published. The versions follow [semantic versioning](https://semver.org);
until 1.0.0 a minor version may change what a config is written like, and says so here.

## 0.6.0

Filters typed against the collections, a config that stops where it names what is not there, limits on what a
widget may ask of the database, and a say in who sets widgets up. Some configs need a change: see
[UPGRADING.md](https://github.com/m-grgic/payload-plugin-widgets/blob/main/UPGRADING.md#05--06).

- **Changed:** with `payload-types.ts` generated, a `where` is checked against its collection: in a widget, in a
  source's filter and in a formula's `when`. A field it does not have, a choice its select does not offer, an
  operator Payload has none of, or a number compared with text, no longer compiles. `raw(…)` says a filter the
  types cannot follow, such as a path through a relationship, as it is; it is still checked as the config is
  built.
- **Changed:** a field that is not there, in a `where`, a `date`, a measure or a formula, stops the config from
  being built, or Payload as it starts where the collection is only settled then. Before, it was logged. A
  declared source is checked whole: its dates, groups, scopes, measures and currency fields as well as its
  filters. `strict: false` has it logged as before.
- **Changed:** a figure read with `overrideAccess` hands `context.data` only the settings named in its new
  `trusted`; the rest are what its `data` starts them as. Before, whoever had it on their dashboard could set any
  of them to anything, and have it read with the server's access past what they may read.
- **Changed:** the drawer's widgets are "Figure", "List" and "Chart" (they were "A figure", "A list", "A chart"),
  and their settings are under three headings: What is counted, When, How it looks. A translation of the old
  names has to be given again; one that is nearly a string the widgets say is warned of as Payload starts.
- **Changed:** two widgets with one slug, or one with the slug of a widget of the dashboard's, of the drawer's
  (`figure`, `records`, `chart`) or of Payload's (`collections`), stop the config from being built.
- **Changed:** `Misconfigured` is no longer an `Unavailable`. Each problem has a `code` and a `path` in the
  options, and what the plugin throws as the config is built is a `Misconfigured` that says them.
- **Changed:** in production, a widget that cannot be read says "This widget could not be read", and the log says
  why. One somebody set up in the drawer still tells them what is wrong, in the admin's names. One that took
  longer than `limits.timeoutMs` says so to anybody.
- **Changed:** the root entry exports what is settled. `any` is `anyOf`; the type `ReadyWidget` is
  `WidgetDefinition`; `Selection`, `worded`, `labelled`, `nameOf`, `amountOf`, `shown`, `added`, `CALCS`,
  `combined`, `counted`, `fetched`, `currencyOf` and `MANY` are in the new `payload-plugin-widgets/advanced`,
  which may change in a minor version. `CALLED` and `calcOf` are gone.
- **Changed:** a measure said in place is typed as a number field of the collection, a figure drawn as progress
  needs a `goal` to compile, and `sources: { slug: false }` is only taken for a collection there is.
- **Changed:** a chart has eight series colours of its own, one set for the light theme and one for the dark,
  told apart with the common kinds of colour blindness. `--widgets-series-1` to `-8` set them.
- **Changed:** on Postgres a collection with a `beforeOperation`, `beforeRead`, `afterRead` or `afterOperation`
  hook is read record by record, as one with `afterRead` was, since its records may read otherwise than they are
  kept.
- **Changed:** `ListViewProps.words` has `submit` and `added` as well; the quick-add box has a button and says
  what it added.
- **Added:** `limits` in the options: `records` (5,000), how many are read where they are read one by one;
  `groups` (1,000), how many values of a field a tally keeps apart; `timeoutMs`, how long a widget may take,
  after which its tile says so and, on Postgres, the database gives up as well. A read given up on throws a
  `TimedOut`, exported from the root.
- **Added:** `userWidgets` in the options: which kinds the drawer offers, of which sources, and an `access` for who
  may have them, asked on every request. `false` offers none.
- **Added:** a chart's columns and points say what they come to on the pointer and on focus, a scale says what
  the top comes to, and a chart has a table of its figures for a screen reader. Series that are not read alike
  are each drawn to their own scale, and the legend says so.
- **Added:** a label of a ready-made widget and of an `action` may be given in several languages, as a source's
  can: `{ en: 'Orders', de: 'Bestellungen' }`.
- **Added:** `list` may be left out of a declared source: the first list it declares is drawn.
- **Added:** the types `FigureOptions`, `ListOptions`, `ChartOptions`, `Sources`, `ProblemCode`, `Series`,
  `WhereOf`, `FieldWhere`, `RawWhere`, `FigureReading` and `ReadFigureOptions`, `ReadListOptions` and
  `ReadChartOptions`.
- **Fixed:** a read made twice in one request, and a collection's access asked twice, is made once, also without
  `cache`; the previous period and the line under a figure are read at the same time.
- **Fixed:** what is wrong with a filter no longer names a field the person looking may not read, and the titles
  of what a chart's bars point at are read as that person, also under `overrideAccess`.
- **Fixed:** on Postgres a chart split by a field of many values has the database keep only the ones it draws.
- The package: the documentation is split into pages under `docs/`, and `UPGRADING.md` says what to change from
  one minor version to the next.
- **Added:** the Payload 4 beta is accepted beside Payload 3.90 and later. The same code is type-checked and tested
  on 4.0.0-beta.11, and the stylesheet falls back to its colours where the ones of Payload 3 are gone.
- The package: the demo and the tests are on Next.js 16.4.6, past the advisories against 16.4.0.

## 0.5.1

Figures that were wrong in some cases, charts a keyboard and a screen reader can use, and a package that is
tested on more than one version.

- **Fixed:** where the database does not add up for the widgets (MongoDB, SQLite, collections with drafts,
  `sums: 'records'`), records are now read with the request itself and its locale. An access function that
  reads headers, cookies or `req.context`, and a localized field, give what they give on Postgres.
- **Fixed:** an average, a lowest and a highest of a field pass over records where the field is empty; before,
  each counted as 0, so "Lowest price" showed 0. Their "N records" note counts the records that have a value.
  Sums and formulas are as they were.
- **Fixed:** "the last 30 days" was 31 days, and so was the period before it compares with.
- **Fixed:** the start of a day was an hour off on the days the clocks change in zones far east of UTC
  (Sydney, Auckland), and with it "today" and the start of a period.
- **Fixed:** a count on a collection with drafts stopped at 5,000; it is now the real number. A sum or a chart
  there still reads at most 5,000 records, and says so.
- **Fixed:** "Only the first 5,000" was shown when there were exactly 5,000 records.
- **Fixed:** with `cache`, what is kept is the figures, not the records they were added up from, which could
  come to a great deal of memory. A measure of your own that calls `records()` is no longer served from the
  cache.
- **Fixed:** a chart drawn as a line keeps its links: each point can be clicked or tabbed to. The columns of a
  chart are announced with their label and value.
- **Changed:** a tile that cannot show its figure (an error, not for this account, not set up yet) looks
  different from one that can: a dashed border and an icon for each case. `Notice` takes an optional `kind`.
- **Changed:** a figure drawn as progress without a goal is refused in the drawer when saved, in place of an
  error tile afterwards.
- **Changed:** a tile that wants attention says so to a screen reader, and a compared figure has ▲ or ▼ beside
  its change. Two new strings to translate: "Needs attention", "Urgent".
- **Changed:** Node 18 is no longer supported: `engines` is `>=20.9.0`.
- On a database other than Postgres the plugin says once, as Payload starts, that sums and charts are worked
  out from at most 5,000 records.
- The package: the types no longer import the stylesheet, which failed for projects that check library types;
  `./package.json` is exported.
- The package: the tests run on Payload 3.90.0 and the latest 3.x, Next.js 15.4 and 16, Node 22 and 24, and
  the packed tarball is checked with publint and arethetypeswrong. A release makes a GitHub Release out of
  this file. `SECURITY.md`, `CONTRIBUTING.md` and an issue form.

## 0.5.0

Measures worked out of several fields, and fields inside groups and rows.

- **Added:** formulas. A measure can be a little arithmetic over fields in place of one field, and a choice
  between two by what the record has: `{ sum: { multiply: ['quantity', 'price'] } }`,
  `{ sum: { when: { type: { equals: 'creditNote' } }, then: { multiply: ['total', -1] }, else: 'total' } }`. It is
  taken wherever a measure names a field, typed and checked as the config is built, and on Postgres worked out by
  the database, so a measure that had to be a function to say this no longer has every record read.
  `sum(…, { of })` takes one too.
- **Added:** fields inside a named group, a named tab and the rows of an array are found, and named by their
  path: `totals.net`, `items.price`. They can be measures and groups, and those in a group or a tab dates and
  scopes as well. A number in rows is all the rows of a record added up, and split by a field of the same rows
  it is the rows under each. On Postgres what is in a group or a tab is added up by the database; what is in
  rows is read record by record. Blocks are still not looked into.
- **Changed:** a collection with such fields offers more than it did: a number in a group is a new measure in
  the drawer, under the name "Group: Field". `custom: { widgets: false }` on a field or its group leaves it out.
- **Fixed:** a sum or an average added up from records no longer shows what adding fractions leaves behind
  (2445.6299999999997 for 2445.63), and comes to what the database says to the last digit.
- **Fixed:** two bars of a chart that come to the same are in the same order every time, the first by name
  first; before, it depended on the order the records were read in.
- **Fixed:** in the package's page on npm: it is now published in a way that sends the README along.
- The package: what the database adds up is compared with what the records come to against a real Postgres in
  CI, and a version is published by tagging it (`.github/workflows/release.yml`, with npm's trusted publishing).

## 0.4.0

Sums without a ceiling on Postgres, and reads that can be kept.

- **Changed:** on Postgres a sum, an average, a lowest, a highest and a chart of a field are added up by the
  database in one query, with the access of whoever asks: the 5,000 records a tile could count no longer apply
  there. A measure worked out by a function, a field with read access or an `afterRead` hook, a collection with
  drafts and every other database are read record by record as before. `sums: 'records'` keeps to that always.
- **Added:** `cache`: for how many seconds what a figure or a chart read is kept, for each person apart, and
  forgotten when a record of the collection changes.
- **Added:** `Amount.plain`, which `sum(…)` and a measure said in place set by themselves: what lets the
  database do the adding.

## 0.3.0

Charts with several series, and views that run in the browser.

- **Added:** `series` on a chart: a series for each of what is in a second field, stacked where it adds up.
  Offered in the drawer as "A series for each".
- **Added:** `measure` on a chart takes several, a series each: `measure: ['revenue', 'count']`.
- **Added:** a legend above a chart of several series, and `--widgets-series-1` to `-6` for their colours.
- **Added:** `readChart` and `ChartViewProps` give `series` and `stacked` where a chart has several.
- **Added:** a view may be a client component. `req` is handed to a server component only.
- The README shows a view drawn with a chart library.

## 0.2.0

Who a widget is for is asked the way Payload asks it of a collection.

- **Changed:** `roles` on a source, a widget and under `custom.widgets` is now `access`, Payload's own `Access`:
  `roles: ['admin']` becomes `access: ({ req }) => req.user?.role === 'admin'`. The `allowed` option is gone with
  it, and so is the `Role` type.
- **Changed:** `home` is `false` or an access function in place of a list of roles: `home: []` becomes
  `home: false`.
- **Changed:** "Not part of your role" is no longer said. "Not available to this account" is, for both.
- An `access` may return a `Where` in place of `true`: the widget then shows only those records.
- `<Figure>`, `<Records>`, `<Chart>`, `readFigure`, `readList` and `readChart` take an `access` as well.
- A figure or a chart given `overrideAccess` is read with the server's access, for a total of what its reader may
  not open. It has to say who it is for, and links to the list only for those the collection lets read.
- `context.req` is there for a filter, a measure and a list.

## 0.1.0

The first version.

- Every collection is a source as its fields describe it: how many there are, a sum for each number, a group for
  each select, checkbox and relationship, the dates a period can go by, and a list of the latest.
- "A figure", "A list" and "A chart" can be added to a dashboard and set up in a drawer by whoever is signed in,
  filtered with the admin's own filter builder.
- `figure`, `list`, `chart` and `widget` put widgets on the dashboard ready-made, checked as the config is built.
- `source` declares the filters, measures, lists, groups and scopes that cannot be found; their names are part of
  its type.
- A figure can be compared with the period before, set against a goal, and drawn as a number, as progress or over
  a sparkline; a chart as bars, columns or a line. A project can add views of its own.
- `Figure`, `Records` and `Chart` show the same on any page of the admin; `readFigure`, `readList` and `readChart`
  give the data alone.
- Moments in filters (`today`, `startOfMonth-1m`), a time zone, a currency, a number format and translations.
- A stylesheet in a cascade layer of its own, restyled by variables, classes and attributes.
