# Working on the plugin

Setting up, the demo, the checks and the conventions are in [CONTRIBUTING](../CONTRIBUTING.md). This page adds
what it leaves out.

## The demo

[`dev/`](../dev) is a small shop in a stock Payload admin, with made-up data. Every screenshot in these pages is
taken of it. It reads the plugin from its source, so it is also where to work on it:

```sh
git clone https://github.com/m-grgic/payload-plugin-widgets.git
cd payload-plugin-widgets
pnpm install
DATABASE_URI=postgres://postgres:postgres@127.0.0.1:5432/widgets_demo pnpm dev
```

See [`dev/README.md`](../dev/README.md).

## What the database test compares

`test/database.test.ts` compares what the database adds up with what the records come to, for the same widgets.
It runs where `DATABASE_URI` names a Postgres that may be emptied, as it does in CI.

## Releasing

A release is a tag. A tag `v1.2.3` on a commit whose `package.json` says `1.2.3` is checked, built and published
by `.github/workflows/release.yml`. npm trusts that workflow as the package's publisher, so no token is kept
anywhere. The workflow also makes a GitHub Release from the `## 1.2.3` section of the changelog.

By hand, it is `pnpm pack` and `npm publish` of the tarball. pnpm points the package's entries at `dist`
(`publishConfig`), and npm sends the README along.
