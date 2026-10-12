import type { Where } from 'payload'
import { after } from './time'

// Moments a filter can name where a date would stand still: "due before today" stays true tomorrow.
//
//   where: { dueDate: { less_than: 'today' } }                          // overdue
//   where: { createdAt: { greater_than_equal: 'startOfMonth-1m' } }     // since the start of last month
//
// A day is the moment it starts at, in the time zone the widgets were given; a week starts on Monday unless they
// were given another day.

type Anchor = 'now' | 'today' | 'tomorrow' | 'yesterday' | 'startOfWeek' | 'startOfMonth' | 'startOfYear'
/** A moment by name, on its own or so many days, weeks, months or years before or after it: `today+7d`, `startOfYear-1y`. */
export type Moment = Anchor | `${Anchor}${'+' | '-'}${number}${'d' | 'w' | 'm' | 'y'}`

const MOMENT = /^(now|today|tomorrow|yesterday|startOfWeek|startOfMonth|startOfYear)(?:([+-]\d+)([dwmy]))?$/

/** A day moved by whole months, kept within the month it lands in: a month after 31 January is the end of February. */
export const months = (date: string, count: number) => {
  const [year, month, day] = date.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1 + count, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return `${first.toISOString().slice(0, 8)}${String(Math.min(day, last)).padStart(2, '0')}`
}

const moved = (date: string, count: number, unit: string) =>
  unit === 'd' ? after(date, count) : unit === 'w' ? after(date, count * 7) : months(date, unit === 'y' ? count * 12 : count)

export interface Clock {
  /** Today where the widgets are, as YYYY-MM-DD, and the instant a day starts at there. */
  today: string
  instant: (date: string) => string
  /** The day an instant falls on there. */
  date: (value: Date | string) => string
  /** The day a week starts on: 0 for Sunday to 6 for Saturday. Monday where it is left out. */
  weekStartsOn?: number
}

/** The instant a moment stands for right now; nothing for what is not one. */
export const momentAt = (clock: Clock, text: unknown, now = new Date()): string | undefined => {
  const found = typeof text === 'string' ? MOMENT.exec(text) : null
  if (!found) return undefined
  const [, anchor, count, unit] = found
  const { today } = clock
  if (anchor === 'now') {
    if (!count) return now.toISOString()
    // the same time of day on the day it lands on
    const sinceStart = now.getTime() - Date.parse(clock.instant(today))
    return new Date(Date.parse(clock.instant(moved(today, Number(count), unit))) + sinceStart).toISOString()
  }
  const day = anchor === 'tomorrow' ? after(today, 1)
    : anchor === 'yesterday' ? after(today, -1)
      : anchor === 'startOfWeek' ? after(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() - (clock.weekStartsOn ?? 1) + 7) % 7))
        : anchor === 'startOfMonth' ? `${today.slice(0, 7)}-01`
          : anchor === 'startOfYear' ? `${today.slice(0, 4)}-01-01`
            : today
  return clock.instant(count ? moved(day, Number(count), unit) : day)
}

/** A filter with the moments it names on date fields put as the instants they are now. */
export const timed = (clock: Clock, where: Where, isDate: (path: string) => boolean): Where => {
  const at = (value: unknown): unknown => (Array.isArray(value) ? value.map(at) : momentAt(clock, value) ?? value)
  return Object.fromEntries(Object.entries(where).map(([key, condition]) => {
    if (key === 'and' || key === 'or') return [key, Array.isArray(condition) ? condition.map(inner => timed(clock, inner, isDate)) : condition]
    if (!condition || typeof condition !== 'object' || Array.isArray(condition) || !isDate(key)) return [key, condition]
    return [key, Object.fromEntries(Object.entries(condition).map(([operator, value]) => [operator, at(value)]))]
  })) as Where
}
