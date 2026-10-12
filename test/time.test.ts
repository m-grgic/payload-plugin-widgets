import assert from 'node:assert/strict'
import { test } from 'node:test'
import { after, dayIn, startOf } from '../src/time'
import { momentAt, months, type Clock } from '../src/when'

const ZONE = 'Europe/Zagreb'
const clockAt = (now: string, weekStartsOn?: number): Clock => ({
  today: dayIn(ZONE, now), instant: date => startOf(ZONE, date), date: value => dayIn(ZONE, value), weekStartsOn,
})

test('a day is the one it is in the zone, not in UTC', () => {
  assert.equal(dayIn(ZONE, '2026-03-14T23:30:00Z'), '2026-03-15')
  assert.equal(dayIn('UTC', '2026-03-14T23:30:00Z'), '2026-03-14')
})

test('a day starts at midnight there, in winter and in summer', () => {
  assert.equal(startOf(ZONE, '2026-01-15'), '2026-01-14T23:00:00.000Z')
  assert.equal(startOf(ZONE, '2026-07-15'), '2026-07-14T22:00:00.000Z')
})

test('days are moved across months and years', () => {
  assert.equal(after('2026-12-31', 1), '2027-01-01')
  assert.equal(after('2026-03-01', -1), '2026-02-28')
})

test('a day moved by months stays within the month it lands in', () => {
  assert.equal(months('2026-01-31', 1), '2026-02-28')
  assert.equal(months('2024-01-31', 1), '2024-02-29')
  assert.equal(months('2026-10-12', -12), '2025-10-12')
  assert.equal(months('2026-01-15', -1), '2025-12-15')
})

test('a moment is the instant its day starts at', () => {
  const now = new Date('2026-10-14T10:00:00Z') // a Wednesday
  const clock = clockAt(now.toISOString())
  assert.equal(momentAt(clock, 'today', now), startOf(ZONE, '2026-10-14'))
  assert.equal(momentAt(clock, 'tomorrow', now), startOf(ZONE, '2026-10-15'))
  assert.equal(momentAt(clock, 'today+7d', now), startOf(ZONE, '2026-10-21'))
  assert.equal(momentAt(clock, 'startOfMonth-1m', now), startOf(ZONE, '2026-09-01'))
  assert.equal(momentAt(clock, 'startOfYear', now), startOf(ZONE, '2026-01-01'))
  assert.equal(momentAt(clock, 'now', now), now.toISOString())
})

test('a week starts on Monday unless it is given another day', () => {
  const now = new Date('2026-10-14T10:00:00Z')
  assert.equal(momentAt(clockAt(now.toISOString()), 'startOfWeek', now), startOf(ZONE, '2026-10-12'))
  assert.equal(momentAt(clockAt(now.toISOString(), 0), 'startOfWeek', now), startOf(ZONE, '2026-10-11'))
})

test('what is no moment is left alone', () => {
  const clock = clockAt('2026-10-14T10:00:00Z')
  assert.equal(momentAt(clock, '2026-10-14'), undefined)
  assert.equal(momentAt(clock, 'someday'), undefined)
  assert.equal(momentAt(clock, 5), undefined)
})
