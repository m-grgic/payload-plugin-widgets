// Days in a time zone. A day is kept as YYYY-MM-DD, a moment as an ISO instant.

const formatters = new Map<string, Intl.DateTimeFormat>()
const formatter = (zone: string) => {
  if (!formatters.has(zone)) {
    formatters.set(zone, new Intl.DateTimeFormat('en-CA', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }))
  }
  return formatters.get(zone) as Intl.DateTimeFormat
}

const parts = (zone: string, at: Date) => Object.fromEntries(formatter(zone).formatToParts(at).map(part => [part.type, part.value]))

/** The day a moment falls on in the zone. */
export const dayIn = (zone: string, value: Date | string) => {
  const { year, month, day } = parts(zone, new Date(value))
  return `${year}-${month}-${day}`
}

/** The moment a day starts at in the zone. */
export const startOf = (zone: string, date: string) => {
  const day = date.slice(0, 10)
  const guess = Date.parse(`${day}T00:00:00Z`)
  // how far the zone's clock is ahead of UTC at a moment
  const ahead = (moment: number) => {
    const there = parts(zone, new Date(moment))
    return Date.UTC(Number(there.year), Number(there.month) - 1, Number(there.day), Number(there.hour), Number(there.minute), Number(there.second)) - moment
  }
  // the clock may be put forward or back between midnight in UTC and midnight there, so it is asked again at the
  // first answer; of the two, the earlier that is still on that day there. Where midnight is skipped, that is the
  // first moment the day has.
  const first = guess - ahead(guess)
  const second = guess - ahead(first)
  const on = [first, second].filter(moment => dayIn(zone, new Date(moment)) === day)
  return new Date(on.length ? Math.min(...on) : first).toISOString()
}

/** The day so many days after another, or before it where the number is negative. */
export const after = (date: string, days: number) => new Date(Date.parse(`${date.slice(0, 10)}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10)
