// Date math for payment-due and benefit-expiry reminders.
// All calculations use the device's *local* current date so the app always
// agrees with the calendar the user is looking at.

import { periodRange } from './cycles.js'

export const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Midnight (local) of the given date. */
export function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

/** Whole-day difference (b - a), ignoring time-of-day. Positive => b is later. */
export function daysBetween(a, b) {
  return Math.round((startOfDay(b) - startOfDay(a)) / MS_PER_DAY)
}

/**
 * Build a date on `dueDay` of the given year/month, clamping to the last day of
 * short months (e.g. dueDay 31 in February becomes Feb 28/29).
 */
function dayInMonth(year, month, dueDay) {
  const lastDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(dueDay, lastDay), 0, 0, 0, 0)
}

/**
 * The next payment due date on/after `from` for a card whose payment is due on
 * `dueDay` each month. If today is the due day it still counts as today.
 */
export function nextDueDate(dueDay, from = new Date()) {
  if (!dueDay) return null
  const today = startOfDay(from)
  let candidate = dayInMonth(today.getFullYear(), today.getMonth(), dueDay)
  if (candidate < today) {
    candidate = dayInMonth(today.getFullYear(), today.getMonth() + 1, dueDay)
  }
  return candidate
}

/** When should we fire the "payment due soon" reminder. */
export function reminderDate(dueDate, daysBefore = 3) {
  if (!dueDate) return null
  return new Date(startOfDay(dueDate).getTime() - daysBefore * MS_PER_DAY)
}

/**
 * Status of a card's payment relative to today.
 * Returns { dueDate, daysUntil, state } where state is one of:
 *   'overdue' | 'due_today' | 'upcoming' | 'scheduled'
 */
export function paymentStatus(card, from = new Date()) {
  const cfg = card?.payment
  if (!cfg?.dueDay) return null
  const due = nextDueDate(cfg.dueDay, from)
  const diff = daysBetween(from, due)
  const remindBefore = cfg.remindDaysBefore ?? 3
  let state = 'scheduled'
  if (diff <= 0) state = diff === 0 ? 'due_today' : 'overdue'
  else if (diff <= remindBefore) state = 'upcoming'
  return { dueDate: due, daysUntil: diff, state }
}

/**
 * For an unused/partly-used benefit, how close is its current period to closing.
 * Returns { end, daysUntil, expiring } or null for one-time / no-deadline.
 */
export function benefitExpiry(benefit, from = new Date(), openDate = null, remindDaysBefore = 7) {
  const { end } = periodRange(benefit, from, openDate)
  if (!end) return null
  const lastUsableDay = new Date(end.getTime() - MS_PER_DAY)
  const diff = daysBetween(from, lastUsableDay)
  return { end: lastUsableDay, daysUntil: diff, expiring: diff >= 0 && diff <= remindDaysBefore }
}

/**
 * Produce the full list of reminders that are *active* as of `from`, merging
 * payment-due and benefit-expiry signals. Pure function -> easy to test and to
 * feed into the notification scheduler.
 */
export function activeReminders({ cards = [], benefits = [], claims = {} }, from = new Date()) {
  const out = []

  for (const card of cards) {
    const ps = paymentStatus(card, from)
    if (ps && (ps.state === 'overdue' || ps.state === 'due_today' || ps.state === 'upcoming')) {
      out.push({
        kind: 'payment',
        id: `pay-${card.id}`,
        cardId: card.id,
        state: ps.state,
        date: ps.dueDate,
        daysUntil: ps.daysUntil
      })
    }
  }

  for (const b of benefits) {
    const card = cards.find((c) => c.id === b.cardId)
    if (!card) continue
    if (b.cadence === 'one_time') continue
    const exp = benefitExpiry(b, from, card.openedDate, b.remindDaysBefore ?? 7)
    if (exp?.expiring) {
      // Only remind if not already fully used this period (caller passes claims).
      out.push({
        kind: 'benefit',
        id: `ben-${b.id}`,
        cardId: card.id,
        benefitId: b.id,
        date: exp.end,
        daysUntil: exp.daysUntil
      })
    }
  }

  return out.sort((a, b) => a.daysUntil - b.daysUntil)
}
