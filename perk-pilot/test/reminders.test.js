import { describe, it, expect } from 'vitest'
import { daysBetween, nextDueDate, reminderDate, paymentStatus, benefitExpiry, activeReminders } from '../src/utils/reminders.js'

const d = (s) => new Date(s + 'T12:00:00')

describe('daysBetween', () => {
  it('ignores time-of-day', () => {
    expect(daysBetween(new Date('2026-05-01T23:00:00'), new Date('2026-05-02T01:00:00'))).toBe(1)
  })
  it('is negative when b precedes a', () => {
    expect(daysBetween(d('2026-05-10'), d('2026-05-05'))).toBe(-5)
  })
})

describe('nextDueDate', () => {
  it('returns this month when the due day is still ahead', () => {
    const due = nextDueDate(20, d('2026-05-10'))
    expect(due.getMonth()).toBe(4)
    expect(due.getDate()).toBe(20)
  })
  it('rolls to next month when the due day has passed', () => {
    const due = nextDueDate(5, d('2026-05-10'))
    expect(due.getMonth()).toBe(5)
    expect(due.getDate()).toBe(5)
  })
  it('clamps to the last day of short months', () => {
    const due = nextDueDate(31, d('2026-02-01'))
    expect(due.getMonth()).toBe(1) // Feb
    expect(due.getDate()).toBe(28) // 2026 not a leap year
  })
})

describe('reminderDate', () => {
  it('subtracts the lead days', () => {
    const r = reminderDate(d('2026-05-20'), 3)
    expect(r.getDate()).toBe(17)
  })
})

describe('paymentStatus', () => {
  const card = (cfg) => ({ id: 'c1', payment: cfg })
  it('flags upcoming within the reminder window', () => {
    const s = paymentStatus(card({ dueDay: 12, remindDaysBefore: 3 }), d('2026-05-10'))
    expect(s.state).toBe('upcoming')
    expect(s.daysUntil).toBe(2)
  })
  it('flags due today', () => {
    const s = paymentStatus(card({ dueDay: 10, remindDaysBefore: 3 }), d('2026-05-10'))
    expect(s.state).toBe('due_today')
  })
  it('returns null when no due day configured', () => {
    expect(paymentStatus(card({}), d('2026-05-10'))).toBeNull()
  })
  it('is scheduled when far away', () => {
    const s = paymentStatus(card({ dueDay: 28, remindDaysBefore: 3 }), d('2026-05-01'))
    expect(s.state).toBe('scheduled')
  })
})

describe('benefitExpiry', () => {
  it('flags expiring when within the lead window', () => {
    // monthly benefit, last usable day is end of May
    const exp = benefitExpiry({ cadence: 'monthly' }, d('2026-05-28'), null, 7)
    expect(exp.expiring).toBe(true)
    expect(exp.daysUntil).toBe(3) // 28 -> 31
  })
  it('does not flag early in the period', () => {
    const exp = benefitExpiry({ cadence: 'monthly' }, d('2026-05-01'), null, 7)
    expect(exp.expiring).toBe(false)
  })
  it('returns null for one_time', () => {
    expect(benefitExpiry({ cadence: 'one_time' }, d('2026-05-28'))).toBeNull()
  })
})

describe('activeReminders', () => {
  it('collects payment and benefit reminders sorted by urgency', () => {
    const cards = [{ id: 'c1', payment: { dueDay: 12, remindDaysBefore: 3 } }]
    const benefits = [{ id: 'b1', cardId: 'c1', cadence: 'monthly', remindDaysBefore: 7 }]
    const out = activeReminders({ cards, benefits }, d('2026-05-28'))
    expect(out.length).toBeGreaterThanOrEqual(1)
    // sorted ascending by daysUntil
    for (let i = 1; i < out.length; i++) expect(out[i].daysUntil).toBeGreaterThanOrEqual(out[i - 1].daysUntil)
  })
})
