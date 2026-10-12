# The demo

A small shop in a stock Payload admin, to try the widgets on and to work on them: customers, orders and tasks,
with the plugin read straight from `../src`. The screenshots in the package's README are taken of it.

Nothing here is published: the package's `files` are `dist` alone.

## Running it

It needs a Postgres database it may fill. One in Docker does:

```sh
docker run -d --name widgets-demo -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=widgets_demo -p 5432:5432 postgres:16
```

Then, from the package's directory:

```sh
pnpm install
pnpm dev          # http://localhost:3000/admin
```

`DATABASE_URI` says where the database is, where that is not
`postgres://postgres:postgres@127.0.0.1:5432/widgets_demo`.

The first start makes the tables and fills them (see [`seed.ts`](./seed.ts)): 30 customers, 26 months of orders
and 10 tasks, all made up and dated back from today, so "this month" and "the last 12 months" always have
something in them. Nobody has to sign in: the admin opens as `demo@example.com` (password `demo`), an admin.

To start over, drop the database and start again.

## What is in it

[`payload.config.ts`](./payload.config.ts) is the whole of it:

- `customers` and `tasks` are sources as the plugin finds them; `customers` only says which date it goes by.
- `orders` is declared with `source(…)`: two filters, two measures of money and two groups.
- Eight ready-made widgets, one of every kind and every view: figures as a number, as progress and over a
  sparkline, a chart as columns, as bars and as a line, and a list.

After changing which widgets or views there are, write the import map again:

```sh
pnpm dev:importmap
```
