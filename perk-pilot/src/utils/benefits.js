// Benefit utilization ("did we squeeze every perk?") calculations.
//
// Usage claims live in a flat map keyed by `${benefitId}::${periodKey}`:
//   { used: bool, usedAmount: number, note: string, updatedAt: number }
// Keeping every period's claim forever means the year-end summary is just a
// query, and a new period starts "empty" automatically.

import { periodKey } from './cycles.js'

export const OCCURRENCES_PER_YEAR = {
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
  one_time: 1
}

export function claimKey(benefitId, pKey) {
  return `${benefitId}::${pKey}`
}

/** Full notional dollar value a benefit can deliver across one year. */
export function annualValue(benefit) {
  const per = Number(benefit?.value) || 0
  return per * (OCCURRENCES_PER_YEAR[benefit?.cadence] ?? 1)
}

/**
 * State of a single benefit in the period containing `date`.
 *   trackingMode 'amount' -> partial dollar tracking (e.g. a $200 credit)
 *   trackingMode 'check'  -> simple used / not-used toggle
 */
export function benefitState(benefit, claims = {}, date = new Date(), openDate = null) {
  const pKey = periodKey(benefit, date, openDate)
  const claim = claims[claimKey(benefit.id, pKey)] || {}
  const value = Number(benefit.value) || 0
  const mode = benefit.trackingMode || (value > 0 ? 'amount' : 'check')

  let usedAmount = 0
  let used = false
  if (mode === 'amount') {
    usedAmount = Math.max(0, Number(claim.usedAmount) || 0)
    used = usedAmount >= value && value > 0
  } else {
    used = !!claim.used
    usedAmount = used ? value : 0
  }
  const remaining = Math.max(0, value - usedAmount)
  const pct = value > 0 ? Math.min(100, Math.round((usedAmount / value) * 100)) : used ? 100 : 0
  return { periodKey: pKey, mode, value, usedAmount, used, remaining, pct, note: claim.note || '' }
}

/**
 * Aggregate the *current period* utilization for a set of a card's benefits.
 * Returns captured vs available dollars and a per-benefit breakdown.
 */
export function cardUtilization(card, benefits = [], claims = {}, date = new Date()) {
  const mine = benefits.filter((b) => b.cardId === card.id)
  let captured = 0
  let available = 0
  const items = mine.map((b) => {
    const st = benefitState(b, claims, date, card.openedDate)
    captured += st.usedAmount
    available += st.value
    return { benefit: b, ...st }
  })
  const pct = available > 0 ? Math.round((captured / available) * 100) : 0
  return { captured, available, pct, items, annualValue: mine.reduce((s, b) => s + annualValue(b), 0) }
}

/**
 * Year summary across all of a card's benefits: how much value was captured vs
 * available over the calendar year, listing what was left on the table. Powers
 * the "is this card worth keeping?" archive view.
 */
export function cardYearSummary(card, benefits = [], claims = {}, year) {
  const mine = benefits.filter((b) => b.cardId === card.id)
  let captured = 0
  let available = 0
  const leftovers = []
  for (const b of mine) {
    const potential = annualValue(b)
    available += potential
    // Sum every claim for this benefit whose period falls in `year`.
    let got = 0
    for (const [k, claim] of Object.entries(claims)) {
      const [bid, pKey] = k.split('::')
      if (bid !== b.id) continue
      if (pKey === 'once' ? false : pKey.slice(0, 4) !== String(year)) continue
      const val = Number(b.value) || 0
      const mode = b.trackingMode || (val > 0 ? 'amount' : 'check')
      got += mode === 'amount' ? Math.max(0, Number(claim.usedAmount) || 0) : (claim.used ? val : 0)
    }
    captured += got
    const missed = Math.max(0, potential - got)
    if (missed > 0.5) leftovers.push({ benefit: b, potential, captured: got, missed })
  }
  leftovers.sort((a, b) => b.missed - a.missed)
  const pct = available > 0 ? Math.round((captured / available) * 100) : 0
  const fee = Number(card.annualFee) || 0
  return {
    year,
    captured,
    available,
    pct,
    annualFee: fee,
    netValue: captured - fee, // value squeezed minus the fee you paid
    leftovers
  }
}
