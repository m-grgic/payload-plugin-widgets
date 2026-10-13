# Changelog

What changed in each version that was published. The versions follow [semantic versioning](https://semver.org);
until 1.0.0 a minor version may change what a config is written like, and says so here.

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
