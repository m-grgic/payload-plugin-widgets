# Changelog

What changed in each version that was published. The versions follow [semantic versioning](https://semver.org);
until 1.0.0 a minor version may change what a config is written like, and says so here.

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
