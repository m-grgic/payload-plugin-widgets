# Limits and performance

- [Where the adding is done](#where-the-adding-is-done)
- [Kept for a while](#kept-for-a-while)
- [`limits`](#limits)
- [What the widgets do not do](#what-the-widgets-do-not-do)

## Where the adding is done

**On Postgres, by the database.** A sum, an average, a lowest, a highest and every chart of a field or of a
[formula](./sources-and-measures.md#formulas) are one query that groups and adds, however many records there are.

- A field inside a named group or a named tab is a column like any other.
- The query is built by Payload the way it builds one to count. It uses the collection's `access` for whoever
  asks, or no access under `overrideAccess`, so it comes to what reading the records would.
- A chart split by a field of many values has the database keep only the values it draws.

**Anywhere else, record by record**, at most `limits.records` of them (5,000 where it is left out). Beyond that the
tile says "Only the first 5,000 are counted". This covers MongoDB and SQLite. On Postgres it covers whatever the
database does not hold just as a record shows it:

- a measure worked out by a function (`sum(…, { of: doc => … })`, or a `read` of your own). Say it as a
  [formula](./sources-and-measures.md#formulas) where it can be;
- a number or a group in the rows of an array;
- a field that has:
  - `access.read`,
  - an `afterRead` hook,
  - is virtual or localized,
  - or holds several values (`hasMany`);
- any field of a collection with a `beforeOperation`, `beforeRead`, `afterRead` or `afterOperation` hook of its own;
- a collection read with its drafts (`draft: true` on its source).

Counts have no such limit. On a database other than Postgres, the plugin says once, as Payload starts, that sums
and charts are worked out from the records, and at most how many.

Nothing has to be said for either: each figure goes the way it can. `sums: 'records'` has everything read record
by record. That is the place to look first should a number ever differ.

## Kept for a while

**Within one request**, a figure or a chart read twice is read once, and what a collection lets somebody read is
asked once. Nothing has to be said for this.

**Across requests, where you say so.** With `cache: 60`, what a figure or a chart read is kept for a minute, so a
dashboard opened ten times asks the database once.

- It is kept for each person apart, as what they may read differs.
- What is read under `overrideAccess` is the same for everybody, and is kept once.
- A record of the collection that is created, changed or deleted through Payload has it forgotten at once.
- Lists are never kept, nor a measure of your own that calls `records()`.

```ts
widgetsPlugin({ cache: 60 })
```

It is kept in the memory of the server. On serverless hosting each instance keeps its own, and one instance does
not hear of a change made through another before the seconds are up.

## `limits`

How much a widget may ask of the database, so that one set up carelessly cannot hold up the rest:

```ts
widgetsPlugin({ limits: { records: 5000, groups: 1000, timeoutMs: 3000 } })
```

| | Where it is left out | |
| --- | --- | --- |
| `records` | 5,000 | How many records a widget reads at most where they are read one by one. |
| `groups` | 1,000 | How many values of a field a tally keeps apart at most. The rest are counted together as one. A chart only ever draws its first eight of them. |
| `timeoutMs` | none | How long, in milliseconds, a widget may take to read. Its tile then says it took too long, and the others are drawn as ever. On Postgres the database is told to give up as well. |

A value that is not above nought counts as left out, and `records` and `groups` are whole numbers of at least 1.

A read that takes too long is logged as a warning:

```
widgets: a figure of orders took longer to read than the 3000 ms it is given
```

Its problem code is `timed-out`. Whatever else is still being read for it is let run, and its answer passed
over. The tile says that it took too long, to anybody and in production as well, since that gives nothing away: see
[errors](./errors.md#on-a-tile).

## What the widgets do not do

- A list is drawn as rows, or another way only by a [view of your own](./advanced.md#a-view).
- Nothing inside a block is found, and nothing in the rows of rows.
- What is in the rows of an array is read record by record, and a period cannot go by a date there.
- A relationship to more than one collection is not a group.
- A chart of money is drawn in one currency, the one the plugin was given. Records in another are left out, and
  the tile says how many.
- A tile is read when the page is, unless the plugin is given a `cache`.
