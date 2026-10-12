import assert from 'node:assert/strict'
import { test } from 'node:test'
import { closest, figureProblems, inWords, seriesProblems, viewProblems, viewsOf } from '../src/check'
import { combined } from '../src/types'

test('a name that is nearly right is offered', () => {
  assert.equal(closest('amountPayd', ['amountPaid', 'total', 'status']), 'amountPaid')
  assert.equal(closest('zzzzzz', ['amountPaid', 'total']), undefined)
})

test('a widget is drawn one of the ways there are for its kind', () => {
  const views = { donut: { kind: 'chart' as const, label: 'A donut', Component: 'x#Donut' } }
  assert.deepEqual(viewsOf('chart', views), ['bars', 'columns', 'line', 'donut'])
  assert.deepEqual(viewsOf('figure', views), ['number', 'progress', 'sparkline'])
  assert.deepEqual(viewProblems('chart', 'donut', views), [])
  assert.deepEqual(viewProblems('chart', undefined, views), [])
  const [problem] = viewProblems('figure', 'donut', views)
  assert.equal(inWords(problem), 'A figure cannot be drawn as "donut".')
  assert.match(inWords(viewProblems('chart', 'colums', views)[0]), /Did you mean "columns"\?/)
})

test('progress needs a goal, and a comparison a period that has a beginning', () => {
  assert.deepEqual(figureProblems({ as: 'progress', goal: 10 }), [])
  assert.equal(figureProblems({ as: 'progress' }).length, 1)
  assert.deepEqual(figureProblems({ compare: 'previous', period: 'month' }), [])
  assert.deepEqual(figureProblems({ compare: 'previous', period: 'custom', from: '2026-01-01' }), [])
  for (const pick of [{ compare: 'previous' }, { compare: 'previous', period: 'all' }, { compare: 'previous', period: 'past' }, { compare: 'previous', period: 'custom' }]) {
    assert.equal(figureProblems(pick).length, 1, JSON.stringify(pick))
  }
})

test('a chart has a series for each measure or for each of a group, and not the group it is already split by', () => {
  assert.deepEqual(seriesProblems({ measure: ['revenue', 'count'], by: 'time' }), [])
  assert.deepEqual(seriesProblems({ measure: 'revenue', by: 'time', series: 'status' }), [])
  assert.deepEqual(seriesProblems({ measure: ['revenue'], by: 'time', series: 'status' }), [])
  assert.equal(inWords(seriesProblems({ measure: ['revenue', 'count'], by: 'time', series: 'status' })[0]), 'A chart tells apart its measures or what is in a field, not both.')
  assert.equal(inWords(seriesProblems({ by: 'status', series: 'status' })[0]), 'A chart cannot be split by "status" twice.')
})

test('numbers are combined the way a measure says', () => {
  assert.equal(combined('sum', [1, 2, 6]), 9)
  assert.equal(combined(undefined, [1, 2, 6]), 9)
  assert.equal(combined('avg', [1, 2, 6]), 3)
  assert.equal(combined('min', [4, 2, 6]), 2)
  assert.equal(combined('max', [4, 2, 6]), 6)
  assert.equal(combined('avg', []), 0)
})
