import { describe, it, expect } from 'vitest'
import { annualValue, claimKey, benefitState, cardUtilization, cardYearSummary } from '../src/utils/benefits.js'
import { periodKey } from '../src/utils/cycles.js'

const d = (s) => new Date(s + 'T12:00:00')

describe('annualValue', () => {
  it('multiplies per-period value by occurrences', () => {
    expect(annualValue({ value: 10, cadence: 'monthly' })).toBe(120)
    expect(annualValue({ value: 50, cadence: 'quarterly' })).toBe(200)
    expect(annualValue({ value: 300, cadence: 'annual' })).toBe(300)
  })
})

describe('benefitState', () => {
  const benefit = { id: 'b1', value: 200, cadence: 'annual', resetBasis: 'calendar', trackingMode: 'amount' }
  it('reports partial usage in amount mode', () => {
    const key = claimKey('b1', periodKey(benefit, d('2026-05-01')))
    const st = benefitState(benefit, { [key]: { usedAmount: 50 } }, d('2026-05-01'))
    expect(st.usedAmount).toBe(50)
    expect(st.remaining).toBe(150)
    expect(st.pct).toBe(25)
    expect(st.used).toBe(false)
  })
  it('marks fully used when amount meets value', () => {
    const key = claimKey('b1', periodKey(benefit, d('2026-05-01')))
    const st = benefitState(benefit, { [key]: { usedAmount: 200 } }, d('2026-05-01'))
    expect(st.used).toBe(true)
    expect(st.pct).toBe(100)
  })
  it('starts empty in a fresh period (auto reset)', () => {
    const key = claimKey('b1', periodKey(benefit, d('2025-05-01')))
    const st = benefitState(benefit, { [key]: { usedAmount: 200 } }, d('2026-05-01'))
    expect(st.usedAmount).toBe(0) // 2026 period has no claim
  })
  it('handles check mode', () => {
    const b = { id: 'b2', value: 0, cadence: 'annual', trackingMode: 'check' }
    const key = claimKey('b2', periodKey(b, d('2026-05-01')))
    expect(benefitState(b, {}, d('2026-05-01')).used).toBe(false)
    expect(benefitState(b, { [key]: { used: true } }, d('2026-05-01')).used).toBe(true)
  })
})

describe('cardUtilization', () => {
  it('aggregates captured vs available for the current period', () => {
    const card = { id: 'c1' }
    const benefits = [
      { id: 'b1', cardId: 'c1', value: 100, cadence: 'monthly', trackingMode: 'amount' },
      { id: 'b2', cardId: 'c1', value: 200, cadence: 'monthly', trackingMode: 'amount' }
    ]
    const claims = { [claimKey('b1', periodKey(benefits[0], d('2026-05-01')))]: { usedAmount: 100 } }
    const u = cardUtilization(card, benefits, claims, d('2026-05-01'))
    expect(u.captured).toBe(100)
    expect(u.available).toBe(300)
    expect(u.pct).toBe(33)
  })
})

describe('cardYearSummary', () => {
  it('sums usage across all periods in a year and lists leftovers', () => {
    const card = { id: 'c1', annualFee: 95 }
    const benefits = [{ id: 'b1', cardId: 'c1', value: 10, cadence: 'monthly', trackingMode: 'amount' }]
    // used $10 in Jan and Feb 2026 only
    const claims = {
      [claimKey('b1', '2026-01')]: { usedAmount: 10 },
      [claimKey('b1', '2026-02')]: { usedAmount: 10 }
    }
    const s = cardYearSummary(card, benefits, claims, 2026)
    expect(s.available).toBe(120)
    expect(s.captured).toBe(20)
    expect(s.netValue).toBe(20 - 95)
    expect(s.leftovers[0].missed).toBe(100)
  })
})
