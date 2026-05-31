// Catalog update detection.
//
// When the curated card catalog is updated (a card template's `version` is
// bumped in cardLibrary.js), each user card that was created from that template
// can be compared against the latest template to surface a reviewable diff:
// new perks, changed values, removed perks, and annual-fee changes. The user
// confirms each change before anything is applied (see UpdatesReview UI).

import { CARD_LIBRARY, findTemplate } from '../data/cardLibrary.js'

export function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Stable key used to line up a user benefit with a template benefit.
export function benefitMatchKey(b) {
  return b.templateKey || slug(b.name)
}

// Fields we compare when deciding a perk "changed", with the patch they map to.
const COMPARED_FIELDS = ['value', 'cadence', 'resetBasis', 'trackingMode', 'category', 'note']

/**
 * Diff a user's card (+ its benefits) against the latest version of its template.
 * Returns { feeChange, added, changed, removed, hasChanges }.
 *   added:   [templateBenefit]                      -> perks in catalog but not on card
 *   changed: [{ benefit, template, fields:[{field,from,to}] }]
 *   removed: [benefit]                              -> perks on card no longer in catalog
 *   feeChange: { from, to } | null
 */
export function diffCardAgainstTemplate(card, cardBenefits, template = findTemplate(card?.templateId)) {
  const empty = { feeChange: null, added: [], changed: [], removed: [], hasChanges: false }
  if (!template) return empty

  const mine = cardBenefits.filter((b) => b.cardId === card.id)
  const byKeyMine = new Map(mine.map((b) => [benefitMatchKey(b), b]))
  const byKeyTpl = new Map((template.benefits || []).map((b) => [b.key, b]))

  const added = []
  const changed = []
  for (const tplB of template.benefits || []) {
    const mineB = byKeyMine.get(tplB.key)
    if (!mineB) {
      added.push(tplB)
      continue
    }
    const fields = []
    for (const f of COMPARED_FIELDS) {
      const from = mineB[f] ?? null
      const to = tplB[f] ?? null
      if (String(from ?? '') !== String(to ?? '')) fields.push({ field: f, from, to })
    }
    if (fields.length) changed.push({ benefit: mineB, template: tplB, fields })
  }

  const removed = mine.filter((b) => b.templateKey && !byKeyTpl.has(b.templateKey))

  const feeFrom = Number(card.annualFee) || 0
  const feeTo = Number(template.annualFee) || 0
  const feeChange = feeFrom !== feeTo ? { from: feeFrom, to: feeTo } : null

  const hasChanges = Boolean(feeChange) || added.length > 0 || changed.length > 0 || removed.length > 0
  return { feeChange, added, changed, removed, hasChanges }
}

/** True when a card's template has a newer version than the card last reconciled. */
export function cardHasNewerCatalog(card, template = findTemplate(card?.templateId)) {
  if (!template) return false
  return (template.version || 1) > (card.catalogVersionSeen || 0)
}

/**
 * For all cards, return the ones with pending catalog updates:
 *   [{ card, template, diff }]
 * A card qualifies when its template is newer AND there is a non-empty diff.
 */
export function pendingUpdatesForCards(cards = [], benefits = []) {
  const out = []
  for (const card of cards) {
    if (!card.templateId) continue
    const template = findTemplate(card.templateId)
    if (!template || !cardHasNewerCatalog(card, template)) continue
    const diff = diffCardAgainstTemplate(card, benefits, template)
    if (diff.hasChanges) out.push({ card, template, diff })
  }
  return out
}

/**
 * Build the list of store actions to apply a reviewed update. `selection`
 * controls which items to apply:
 *   { fee: bool, added: Set<key>, changed: Set<benefitId>, removed: Set<benefitId> }
 * Always ends by bumping the card's catalogVersionSeen so it stops nagging.
 */
export function buildApplyActions(card, template, diff, selection) {
  const actions = []
  if (diff.feeChange && selection.fee) {
    actions.push({ type: 'UPDATE_CARD', id: card.id, patch: { annualFee: diff.feeChange.to } })
  }
  for (const tplB of diff.added) {
    if (!selection.added.has(tplB.key)) continue
    const { key, ...rest } = tplB
    actions.push({ type: 'ADD_BENEFIT', benefit: { cardId: card.id, templateKey: key, remindDaysBefore: 7, ...rest } })
  }
  for (const ch of diff.changed) {
    if (!selection.changed.has(ch.benefit.id)) continue
    const patch = {}
    for (const { field, to } of ch.fields) patch[field] = to
    actions.push({ type: 'UPDATE_BENEFIT', id: ch.benefit.id, patch })
  }
  for (const b of diff.removed) {
    if (!selection.removed.has(b.id)) continue
    actions.push({ type: 'DELETE_BENEFIT', id: b.id })
  }
  actions.push({ type: 'UPDATE_CARD', id: card.id, patch: { catalogVersionSeen: template.version || 1 } })
  return actions
}

export { CARD_LIBRARY }
