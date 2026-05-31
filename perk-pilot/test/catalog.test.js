import { describe, it, expect } from 'vitest'
import { slug, benefitMatchKey, diffCardAgainstTemplate, cardHasNewerCatalog, pendingUpdatesForCards, buildApplyActions } from '../src/utils/catalog.js'

const template = {
  id: 'tpl', version: 2, dataAsOf: '2026-05', annualFee: 325,
  benefits: [
    { key: 'dining', name: 'Dining credit', value: 25, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'dining' },
    { key: 'resy', name: 'Resy credit', value: 50, cadence: 'semiannual', resetBasis: 'calendar', trackingMode: 'amount', category: 'dining' },
    { key: 'new-perk', name: 'New shiny credit', value: 10, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'retail' }
  ]
}

const card = { id: 'c1', templateId: 'tpl', annualFee: 250, catalogVersionSeen: 1 }
const benefits = [
  // dining value changed 10 -> 25
  { id: 'b1', cardId: 'c1', templateKey: 'dining', name: 'Dining credit', value: 10, cadence: 'monthly', resetBasis: 'calendar', trackingMode: 'amount', category: 'dining' },
  // resy unchanged
  { id: 'b2', cardId: 'c1', templateKey: 'resy', name: 'Resy credit', value: 50, cadence: 'semiannual', resetBasis: 'calendar', trackingMode: 'amount', category: 'dining' },
  // a perk no longer in the template
  { id: 'b3', cardId: 'c1', templateKey: 'old-perk', name: 'Retired credit', value: 5, cadence: 'monthly' }
]

describe('slug / benefitMatchKey', () => {
  it('slugifies names', () => {
    expect(slug('Resy Dining Credit!')).toBe('resy-dining-credit')
  })
  it('prefers templateKey, falls back to name slug', () => {
    expect(benefitMatchKey({ templateKey: 'x', name: 'Y' })).toBe('x')
    expect(benefitMatchKey({ name: 'Free Night' })).toBe('free-night')
  })
})

describe('diffCardAgainstTemplate', () => {
  const diff = diffCardAgainstTemplate(card, benefits, template)
  it('detects fee changes', () => {
    expect(diff.feeChange).toEqual({ from: 250, to: 325 })
  })
  it('detects added perks', () => {
    expect(diff.added.map((b) => b.key)).toEqual(['new-perk'])
  })
  it('detects changed fields with from/to', () => {
    expect(diff.changed).toHaveLength(1)
    const ch = diff.changed[0]
    expect(ch.benefit.id).toBe('b1')
    expect(ch.fields).toEqual([{ field: 'value', from: 10, to: 25 }])
  })
  it('detects removed perks (only templated ones)', () => {
    expect(diff.removed.map((b) => b.id)).toEqual(['b3'])
  })
  it('flags hasChanges', () => {
    expect(diff.hasChanges).toBe(true)
  })
  it('returns empty diff when template missing', () => {
    expect(diffCardAgainstTemplate(card, benefits, null).hasChanges).toBe(false)
  })
})

describe('cardHasNewerCatalog', () => {
  it('is true when template version exceeds seen', () => {
    expect(cardHasNewerCatalog(card, template)).toBe(true)
  })
  it('is false when already reconciled', () => {
    expect(cardHasNewerCatalog({ ...card, catalogVersionSeen: 2 }, template)).toBe(false)
  })
})

describe('pendingUpdatesForCards', () => {
  it('includes cards with newer catalog and a real diff', () => {
    // findTemplate uses the real library, so use a real templateId here
    const realCard = { id: 'rc', templateId: 'amex-gold', annualFee: 0, catalogVersionSeen: 0 }
    const out = pendingUpdatesForCards([realCard], [])
    expect(out).toHaveLength(1)
    expect(out[0].card.id).toBe('rc')
    expect(out[0].diff.hasChanges).toBe(true)
  })
  it('skips custom (template-less) cards', () => {
    expect(pendingUpdatesForCards([{ id: 'x', templateId: null }], [])).toHaveLength(0)
  })
})

describe('buildApplyActions', () => {
  const diff = diffCardAgainstTemplate(card, benefits, template)
  it('applies only selected items and bumps the seen version', () => {
    const selection = { fee: true, added: new Set(['new-perk']), changed: new Set(['b1']), removed: new Set() }
    const actions = buildApplyActions(card, template, diff, selection)
    const types = actions.map((a) => a.type)
    expect(types).toContain('ADD_BENEFIT')
    expect(types).toContain('UPDATE_BENEFIT')
    expect(types).not.toContain('DELETE_BENEFIT') // removal not selected
    // last action bumps catalogVersionSeen to the template version
    const last = actions[actions.length - 1]
    expect(last).toEqual({ type: 'UPDATE_CARD', id: 'c1', patch: { catalogVersionSeen: 2 } })
  })
  it('honors deselected fee change', () => {
    const selection = { fee: false, added: new Set(), changed: new Set(), removed: new Set() }
    const actions = buildApplyActions(card, template, diff, selection)
    expect(actions.filter((a) => a.type === 'UPDATE_CARD' && 'annualFee' in (a.patch || {}))).toHaveLength(0)
  })
})
