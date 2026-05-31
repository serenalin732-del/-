import { useMemo, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Field, Badge, money, EmptyState } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'

// Find the card+multiplier that best rewards a free-text spend category.
function bestCardFor(category, cards) {
  const q = category.trim().toLowerCase()
  if (!q) return null
  let best = null
  for (const c of cards) {
    for (const m of c.multipliers || []) {
      const cat = m.category.toLowerCase()
      const matches = cat.includes(q) || q.includes(cat.split(' ')[0])
      if (!matches) continue
      if (!best || m.rate > best.rate) best = { card: c, rate: m.rate, category: m.category }
    }
  }
  return best
}

export default function Points({ navigate }) {
  const { state, dispatch, t, fmt } = useApp()
  const [adding, setAdding] = useState(false)
  const { cards, pointsTx } = state

  const totalPoints = useMemo(() => pointsTx.reduce((s, tx) => s + (Number(tx.points) || 0), 0), [pointsTx])

  const cardName = (id) => {
    const c = cards.find((x) => x.id === id)
    return c ? c.nickname || c.name : '—'
  }

  if (cards.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-mist mb-3">{t.points.title}</h1>
        <EmptyState action={<button className="btn-primary" onClick={() => navigate('cards')}>{t.dashboard.addCard}</button>}>
          {t.dashboard.noCards}
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-mist">{t.points.title}</h1>
        <button className="btn-primary" onClick={() => setAdding(true)}>+ {t.points.add}</button>
      </div>

      <div className="card-surface p-4 text-center">
        <div className="text-3xl font-bold text-gold">{totalPoints.toLocaleString()}</div>
        <div className="text-xs text-mist/50">{t.points.points}</div>
      </div>

      {pointsTx.length === 0 ? (
        <p className="text-sm text-mist/50 px-1">{t.points.noTx}</p>
      ) : (
        pointsTx.map((tx) => (
          <div key={tx.id} className="card-surface p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-mist truncate">{tx.merchant || tx.category || '—'}</div>
                <div className="text-xs text-mist/50">
                  {tx.date} · {cardName(tx.cardId)} · {tx.category}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-gold font-semibold">+{Number(tx.points || 0).toLocaleString()}</div>
                {tx.multiplier ? <div className="text-xs text-mist/40">{tx.multiplier}×</div> : null}
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge tone={tx.optimal ? 'good' : 'warn'}>{tx.optimal ? t.points.optimalYes : t.points.optimalNo}</Badge>
              {tx.image && <img src={tx.image} alt="" className="h-10 w-10 rounded object-cover ml-auto" />}
              <button className="text-rose/70 text-xs ml-auto hover:text-rose" onClick={() => dispatch({ type: 'DELETE_POINTS_TX', id: tx.id })}>
                {t.common.delete}
              </button>
            </div>
          </div>
        ))
      )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t.points.add}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setAdding(false)}>{t.common.cancel}</button>
            <button className="btn-primary" type="submit" form="points-form">{t.common.save}</button>
          </>
        }
      >
        <PointsForm
          cards={cards}
          t={t}
          fmt={fmt}
          onSave={(tx) => {
            dispatch({ type: 'ADD_POINTS_TX', tx })
            setAdding(false)
          }}
        />
      </Modal>
    </div>
  )
}

function PointsForm({ cards, t, fmt, onSave }) {
  const [form, setForm] = useState({
    cardId: cards[0]?.id || '',
    date: new Date().toISOString().slice(0, 10),
    merchant: '',
    category: '',
    amountSpent: '',
    points: '',
    multiplier: '',
    image: ''
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const best = bestCardFor(form.category, cards)
  const chosen = cards.find((c) => c.id === form.cardId)
  const optimal = !best || (chosen && best.card.id === chosen.id)

  function onImage(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, image: String(reader.result) }))
    reader.readAsDataURL(file)
  }

  return (
    <form
      id="points-form"
      onSubmit={(e) => {
        e.preventDefault()
        onSave({
          cardId: form.cardId,
          date: form.date,
          merchant: form.merchant,
          category: form.category,
          amountSpent: Number(form.amountSpent) || 0,
          points: Number(form.points) || 0,
          multiplier: Number(form.multiplier) || 0,
          optimal,
          image: form.image || null
        })
      }}
    >
      <Field label={t.points.whichCard}>
        <select className="field-input" value={form.cardId} onChange={set('cardId')}>
          {cards.map((c) => (
            <option key={c.id} value={c.id}>{c.nickname || c.name}{c.last4 ? ` ····${c.last4}` : ''}</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.points.merchant}>
          <input className="field-input" value={form.merchant} onChange={set('merchant')} />
        </Field>
        <Field label="Date">
          <input className="field-input" type="date" value={form.date} onChange={set('date')} />
        </Field>
      </div>
      <Field label={t.points.category}>
        <input className="field-input" placeholder="dining / grocery / gas / hotel…" value={form.category} onChange={set('category')} />
      </Field>
      {best && (
        <p className={`text-xs mb-3 ${optimal ? 'text-good' : 'text-gold'}`}>
          {optimal ? t.points.optimalYes : fmt(t.points.suggestion, { cat: form.category, card: best.card.nickname || best.card.name, rate: best.rate })}
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Field label={t.points.amountSpent}>
          <input className="field-input" type="number" min="0" value={form.amountSpent} onChange={set('amountSpent')} />
        </Field>
        <Field label={t.points.points}>
          <input className="field-input" type="number" min="0" value={form.points} onChange={set('points')} />
        </Field>
        <Field label={t.points.multiplier}>
          <input className="field-input" type="number" min="0" step="0.5" value={form.multiplier} onChange={set('multiplier')} />
        </Field>
      </div>
      <Field label={t.points.upload} hint={t.points.uploadHint}>
        <input className="field-input" type="file" accept="image/*" onChange={onImage} />
      </Field>
      {form.image && <img src={form.image} alt="" className="h-20 rounded object-cover" />}
    </form>
  )
}
