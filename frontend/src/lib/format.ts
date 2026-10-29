const DATETIME_FMT = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

const DATE_FMT = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  timeZone: 'UTC',
})

const TIME_FMT = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: 'UTC',
})

/** Format an ISO timestamp as a UTC date-time, e.g. "01 Jan 2026, 09:30 UTC". */
export function formatUtcDateTime(iso: string): string {
  return `${DATETIME_FMT.format(new Date(iso))} UTC`
}

/** Format an ISO date (or date-time) as a UTC date, e.g. "01 Jan 2026". */
export function formatUtcDate(iso: string): string {
  return DATE_FMT.format(new Date(iso))
}

/** Format an ISO timestamp as a UTC time-of-day, e.g. "09:30". */
export function formatUtcTime(iso: string): string {
  return TIME_FMT.format(new Date(iso))
}

/** Integer with locale thousands separators. */
export function formatInt(n: number): string {
  return n.toLocaleString('en-GB')
}

/** Integer with an explicit sign, e.g. "+3,471" / "-120". */
export function formatSignedInt(n: number): string {
  return (n > 0 ? '+' : '') + n.toLocaleString('en-GB')
}
