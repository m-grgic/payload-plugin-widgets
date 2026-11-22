import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import type { PayloadRequest } from 'payload'
import type { Figure } from '../src/components/index'
import { figure, raw, readChart, readFigure, readList, source, widgetsPlugin, type Narrowing } from '../src/index'

// The filters with the generated types are compiled with the demo's (dev/where.types.ts, whose `@ts-expect-error`s
// fail the compile where one is not an error); here, without them, anything Payload takes goes.

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

test('with the generated types a filter is checked against the fields of its collection', () => {
  const tsc = createRequire(import.meta.url).resolve('typescript/bin/tsc')
  const run = spawnSync(process.execPath, [tsc, '--noEmit', '-p', resolve(root, 'dev/tsconfig.json')], { cwd: root, encoding: 'utf8' })
  assert.equal(run.status, 0, run.stdout + run.stderr)
})

test('without them anything Payload takes is taken', () => {
  const where: Narrowing[] = [{ anything: { equals: 'at all' } }, { and: [{ or: [{ 'a.b': { near: [1, 2] } }] }] }, raw({ x: { in: [1] } })]
  const plugin = widgetsPlugin({ sources: { anything: false, posts: source('posts', { label: 'Posts' }) } })
  const widget = figure('f', 'posts', { label: 'x', where: { whatever: { less_than: 'today' } }, as: 'progress', goal: 1 })
  assert.equal(where.length, 3)
  assert.equal(typeof plugin, 'function')
  assert.equal(widget.slug, 'f')
  // by a slug, the data alone and the components take anything as well (compiled by `pnpm typecheck`, never called)
  const unread = () => [
    readFigure({} as PayloadRequest, 'posts', { where: { whatever: { exists: true } }, date: 'any.path', measure: { sum: { when: { x: { equals: 1 } }, then: 'y' } } }),
    readList({} as PayloadRequest, 'posts', { where: { whatever: { exists: true } }, date: 'any' }),
    readChart({} as PayloadRequest, 'posts', { where: { whatever: { exists: true } }, measure: [{ avg: 'y' }], by: 'z' }),
    (null as unknown as typeof Figure)({ req: {} as PayloadRequest, source: 'posts', where: { whatever: { exists: true } }, date: 'any.path', label: { en: 'x' } }),
  ]
  assert.equal(typeof unread, 'function')
})
