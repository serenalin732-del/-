// Period / reset logic for credit-card benefits.
//
// A benefit recurs on a cadence and resets on a basis:
//   cadence:    'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'one_time'
//   resetBasis: 'calendar'    -> resets on the Gregorian calendar (Jan 1, quarter starts, ...)
//               'anniversary' -> annual benefits reset on the card's open/anniversary date
//
// Usage is recorded against a *period key* (a stable string). When a new period
// begins there are simply no claims for it yet, so the benefit naturally shows
// as "not yet used" — no destructive reset is ever required, and historical
// periods stay queryable forever (that powers the year-end summary / archive).

export const CADENCES = ['monthly', 'quarterly', 'semiannual', 'annual', 'one_time']
export const RESET_BASES = ['calendar', 'anniversary']

const pad = (n) => String(n).padStart(2, '0')

function startOfMonth(year, month) {
  // month is 0-indexed
  return new Date(year, month, 1, 0, 0, 0, 0)
}

/**
 * Compute the membership-year start for an anniversary-based annual benefit.
 * Returns the most recent anniversary on or before `date`.
 */
function membershipYearStart(date, openDate) {
  const open = openDate ? new Date(openDate) : new Date(date.getFullYear(), 0, 1)
  const m = open.getMonth()
  const d = open.getDate()
  let year = date.getFullYear()
  const anniversaryThisYear = new Date(year, m, d, 0, 0, 0, 0)
  if (date < anniversaryThisYear) year -= 1
  return new Date(year, m, d, 0, 0, 0, 0)
}

/**
 * Range [start, end) of the period that `date` falls into for the given benefit.
 * `end` is exclusive (the first instant of the next period).
 */
export function periodRange(benefit, date = new Date(), openDate = null) {
  const cadence = benefit?.cadence || 'annual'
  const basis = benefit?.resetBasis || 'calendar'
  const y = date.getFullYear()
  const m = date.getMonth()

  if (cadence === 'one_time') {
    return { start: null, end: null }
  }

  if (cadence === 'annual') {
    if (basis === 'anniversary') {
      const start = membershipYearStart(date, openDate)
      const end = new Date(start.getFullYear() + 1, start.getMonth(), start.getDate(), 0, 0, 0, 0)
      return { start, end }
    }
    return { start: startOfMonth(y, 0), end: startOfMonth(y + 1, 0) }
  }

  // Sub-annual cadences always follow the calendar (the common real-world case
  // for monthly/quarterly statement credits).
  if (cadence === 'monthly') {
    return { start: startOfMonth(y, m), end: startOfMonth(y, m + 1) }
  }
  if (cadence === 'quarterly') {
    const qStart = Math.floor(m / 3) * 3
    return { start: startOfMonth(y, qStart), end: startOfMonth(y, qStart + 3) }
  }
  if (cadence === 'semiannual') {
    const hStart = m < 6 ? 0 : 6
    return { start: startOfMonth(y, hStart), end: startOfMonth(y, hStart + 6) }
  }
  return { start: startOfMonth(y, 0), end: startOfMonth(y + 1, 0) }
}

/**
 * Stable string key identifying the period `date` falls into. Used to bucket
 * usage claims so each cycle is tracked independently.
 */
export function periodKey(benefit, date = new Date(), openDate = null) {
  const cadence = benefit?.cadence || 'annual'
  const basis = benefit?.resetBasis || 'calendar'
  const y = date.getFullYear()
  const m = date.getMonth()

  if (cadence === 'one_time') return 'once'
  if (cadence === 'monthly') return `${y}-${pad(m + 1)}`
  if (cadence === 'quarterly') return `${y}-Q${Math.floor(m / 3) + 1}`
  if (cadence === 'semiannual') return `${y}-H${m < 6 ? 1 : 2}`
  // annual
  if (basis === 'anniversary') {
    const start = membershipYearStart(date, openDate)
    return `${start.getFullYear()}-AY` // anniversary year
  }
  return `${y}`
}

/** Human label for a period key, localized. */
export function periodLabel(benefit, date = new Date(), openDate = null, lang = 'en') {
  const cadence = benefit?.cadence || 'annual'
  const { start, end } = periodRange(benefit, date, openDate)
  if (cadence === 'one_time') return lang === 'zh' ? '一次性' : 'One-time'
  if (cadence === 'annual' && (benefit?.resetBasis === 'anniversary')) {
    const endLabel = end ? new Date(end.getTime() - 1) : null
    return lang === 'zh'
      ? `卡周年 ${start.getFullYear()}/${pad(start.getMonth() + 1)} – ${endLabel.getFullYear()}/${pad(endLabel.getMonth() + 1)}`
      : `Card year ${start.getFullYear()}/${pad(start.getMonth() + 1)} – ${endLabel.getFullYear()}/${pad(endLabel.getMonth() + 1)}`
  }
  return periodKey(benefit, date, openDate)
}

/** Which calendar years a given period touches (for the year-summary screen). */
export function calendarYearOfPeriod(benefit, date = new Date(), openDate = null) {
  const { start } = periodRange(benefit, date, openDate)
  return start ? start.getFullYear() : date.getFullYear()
}
