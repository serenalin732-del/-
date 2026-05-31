import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { buildApplyActions } from '../utils/catalog.js'
import { money, Badge } from './ui.jsx'

// Render a benefit field value in a human-friendly, localized way.
function fieldValue(field, val, t) {
  if (val == null || val === '') return t.common.none
  if (field === 'value') return money(val)
  if (field === 'cadence') return t.benefit.cadences[val] || val
  if (field === 'resetBasis') return t.benefit.bases[val] || val
  if (field === 'trackingMode') return t.benefit.modes[val] || val
  return String(val)
}

function defaultSelection(diff) {
  return {
    fee: true,
    added: new Set(diff.added.map((b) => b.key)),
    changed: new Set(diff.changed.map((c) => c.benefit.id)),
    removed: new Set() // never auto-select destructive removals
  }
}

export default function UpdatesReview({ pending, onDone }) {
  const { dispatch, t, fmt } = useApp()
  const [selections, setSelections] = useState(() =>
    Object.fromEntries(pending.map((p) => [p.card.id, defaultSelection(p.diff)]))
  )

  function toggle(cardId, group, key) {
    setSelections((s) => {
      const cur = s[cardId]
      if (group === 'fee') return { ...s, [cardId]: { ...cur, fee: !cur.fee } }
      const next = new Set(cur[group])
      next.has(key) ? next.delete(key) : next.add(key)
      return { ...s, [cardId]: { ...cur, [group]: next } }
    })
  }

  function apply(p) {
    const actions = buildApplyActions(p.card, p.template, p.diff, selections[p.card.id])
    actions.forEach((a) => dispatch(a))
    onDone?.(p.card.id)
  }

  function dismiss(p) {
    dispatch({ type: 'UPDATE_CARD', id: p.card.id, patch: { catalogVersionSeen: p.template.version || 1 } })
    onDone?.(p.card.id)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-mist/60">{t.updates.intro}</p>
      {pending.map((p) => {
        const sel = selections[p.card.id]
        const { diff } = p
        return (
          <div key={p.card.id} className="card-surface p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-mist">{p.card.nickname || p.card.name}{p.card.last4 ? ` ····${p.card.last4}` : ''}</div>
              <span className="text-[11px] text-mist/40">{fmt(t.updates.asOf, { date: p.template.dataAsOf || '' })}</span>
            </div>

            {diff.feeChange && (
              <Row checked={sel.fee} onToggle={() => toggle(p.card.id, 'fee')}>
                <Badge tone="warn">{t.updates.feeChange}</Badge>
                <span className="text-sm text-mist/80 ml-2">
                  {t.updates.from} {money(diff.feeChange.from)} → {t.updates.to} {money(diff.feeChange.to)}
                </span>
              </Row>
            )}

            {diff.added.length > 0 && (
              <Group title={t.updates.added}>
                {diff.added.map((b) => (
                  <Row key={b.key} checked={sel.added.has(b.key)} onToggle={() => toggle(p.card.id, 'added', b.key)}>
                    <Badge tone="good">+</Badge>
                    <span className="text-sm text-mist ml-2">{b.name}</span>
                    {b.value > 0 && <span className="text-xs text-mist/40 ml-1">{money(b.value)} · {t.benefit.cadences[b.cadence]}</span>}
                  </Row>
                ))}
              </Group>
            )}

            {diff.changed.length > 0 && (
              <Group title={t.updates.changed}>
                {diff.changed.map((c) => (
                  <Row key={c.benefit.id} checked={sel.changed.has(c.benefit.id)} onToggle={() => toggle(p.card.id, 'changed', c.benefit.id)}>
                    <div className="text-sm">
                      <div className="text-mist">{c.template.name}</div>
                      {c.fields.map((f) => (
                        <div key={f.field} className="text-xs text-mist/50">
                          {t.updates.fields[f.field] || f.field}: <span className="text-rose/70 line-through">{fieldValue(f.field, f.from, t)}</span>{' → '}
                          <span className="text-good">{fieldValue(f.field, f.to, t)}</span>
                        </div>
                      ))}
                    </div>
                  </Row>
                ))}
              </Group>
            )}

            {diff.removed.length > 0 && (
              <Group title={t.updates.removed}>
                {diff.removed.map((b) => (
                  <Row key={b.id} checked={sel.removed.has(b.id)} onToggle={() => toggle(p.card.id, 'removed', b.id)}>
                    <Badge tone="bad">–</Badge>
                    <span className="text-sm text-mist/70 ml-2 line-through">{b.name}</span>
                  </Row>
                ))}
              </Group>
            )}

            <div className="flex gap-2 mt-3">
              <button className="btn-ghost flex-1" onClick={() => dismiss(p)}>{t.updates.dismiss}</button>
              <button className="btn-primary flex-1" onClick={() => apply(p)}>{t.updates.applySelected}</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Group({ title, children }) {
  return (
    <div className="mt-3">
      <div className="text-[11px] font-medium text-mist/50 uppercase tracking-wide mb-1">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Row({ checked, onToggle, children }) {
  return (
    <label className="flex items-start gap-2 bg-ink/40 rounded-lg px-2.5 py-2 cursor-pointer">
      <input type="checkbox" className="w-4 h-4 mt-0.5 accent-teal shrink-0" checked={checked} onChange={onToggle} />
      <div className="flex items-center flex-wrap min-w-0">{children}</div>
    </label>
  )
}
