# Contributing

Issues and pull requests are welcome. For a security problem, do not open an issue; see [SECURITY.md](./SECURITY.md).

## Setting up

The package uses pnpm (the version is in `package.json` under `packageManager`) and Node 22 or 24, which is what CI
runs.

```sh
pnpm install
```

## The demo

`dev/` is a small Payload admin with the plugin read straight from `src`. It needs a Postgres it may fill; one in
Docker does:

```sh
docker run -d --name widgets-demo -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=widgets_demo -p 5432:5432 postgres:16
pnpm dev          # http://localhost:3000/admin
```

`DATABASE_URI` says where the database is, where that is not
`postgres://postgres:postgres@127.0.0.1:5432/widgets_demo`. See [`dev/README.md`](./dev/README.md) for what it
seeds and how to sign in.

## Checks

```sh
pnpm typecheck   # the source, strictly
pnpm test        # node --test; with DATABASE_URI also against a Postgres, which it empties first
pnpm build       # dist: JavaScript, types and the stylesheet
```

`test/database.test.ts` only runs where `DATABASE_URI` is set, and it empties that database, so point it at one
kept for the purpose, not the demo's. CI runs it against Postgres 16, on Node 22 and 24, with Next 15 and 16 and
with the lowest and the newest Payload 3 the plugin supports.

## Conventions

- The source imports its own files without an extension; the build says them in full, so what is published is
  read by Node as it is.
- Nothing the Payload config reads (`src/index.ts` and what it imports) may import a component.
- Everything a tile says is in `src/strings.ts`; a test fails where one is said that is not listed there.
- A change someone using the plugin would notice goes into `CHANGELOG.md`, under the next version.

## Pull requests

Keep one change to a pull request, with a test where the change is in what the plugin reads or works out. Run the
checks above before opening it.
