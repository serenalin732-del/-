import { describe, it, expect } from 'vitest'
import { periodKey, periodRange, calendarYearOfPeriod } from '../src/utils/cycles.js'

const d = (s) => new Date(s + 'T12:00:00')

describe('periodKey', () => {
  it('keys monthly benefits by year-month', () => {
    expect(periodKey({ cadence: 'monthly' }, d('2026-05-31'))).toBe('2026-05')
    expect(periodKey({ cadence: 'monthly' }, d('2026-01-01'))).toBe('2026-01')
  })
  it('keys quarterly benefits', () => {
    expect(periodKey({ cadence: 'quarterly' }, d('2026-01-15'))).toBe('2026-Q1')
    expect(periodKey({ cadence: 'quarterly' }, d('2026-04-01'))).toBe('2026-Q2')
    expect(periodKey({ cadence: 'quarterly' }, d('2026-12-31'))).toBe('2026-Q4')
  })
  it('keys semiannual benefits', () => {
    expect(periodKey({ cadence: 'semiannual' }, d('2026-06-30'))).toBe('2026-H1')
    expect(periodKey({ cadence: 'semiannual' }, d('2026-07-01'))).toBe('2026-H2')
  })
  it('keys calendar-year annual benefits by year', () => {
    expect(periodKey({ cadence: 'annual', resetBasis: 'calendar' }, d('2026-05-31'))).toBe('2026')
  })
  it('keys anniversary annual benefits by membership-year start', () => {
    const open = d('2024-09-15')
    // Before the 2026 anniversary -> still in the year that started 2025-09-15
    expect(periodKey({ cadence: 'annual', resetBasis: 'anniversary' }, d('2026-05-31'), open)).toBe('2025-AY')
    // After the anniversary -> new membership year
    expect(periodKey({ cadence: 'annual', resetBasis: 'anniversary' }, d('2026-10-01'), open)).toBe('2026-AY')
  })
  it('treats one_time as a single bucket', () => {
    expect(periodKey({ cadence: 'one_time' }, d('2026-05-31'))).toBe('once')
  })
})

describe('periodRange', () => {
  it('returns an exclusive end equal to the next period start', () => {
    const { start, end } = periodRange({ cadence: 'monthly' }, d('2026-02-10'))
    expect(start.getMonth()).toBe(1) // Feb
    expect(end.getMonth()).toBe(2) // Mar 1
    expect(end.getDate()).toBe(1)
  })
  it('handles anniversary annual spanning the year boundary', () => {
    const open = d('2024-11-20')
    const { start, end } = periodRange({ cadence: 'annual', resetBasis: 'anniversary' }, d('2026-05-31'), open)
    expect(start.getFullYear()).toBe(2025)
    expect(start.getMonth()).toBe(10) // Nov
    expect(end.getFullYear()).toBe(2026)
  })
  it('returns nulls for one_time', () => {
    expect(periodRange({ cadence: 'one_time' }, d('2026-05-31'))).toEqual({ start: null, end: null })
  })
})

describe('calendarYearOfPeriod', () => {
  it('uses the period start year', () => {
    const open = d('2024-11-20')
    expect(calendarYearOfPeriod({ cadence: 'annual', resetBasis: 'anniversary' }, d('2026-05-31'), open)).toBe(2025)
  })
})
