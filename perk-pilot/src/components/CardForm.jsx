import { useMemo, useState } from 'react'
import { Field } from './ui.jsx'
import { CARD_LIBRARY, CARD_LIBRARY_AS_OF, CARD_TYPES, ISSUERS } from '../data/cardLibrary.js'
import { instantiateTemplate, blankCard, useApp } from '../context/AppContext.jsx'

// Build payment-config inputs shared by add + edit.
function PaymentFields({ payment, onChange, t }) {
  const set = (k) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    onChange({ ...payment, [k]: v })
  }
  return (
    <div className="card-surface p-3 mt-1">
      <p className="field-label !mb-2">{t.cards.payment}</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.cards.statementDay}>
          <input className="field-input" type="number" min="1" max="31" value={payment.statementDay ?? ''} onChange={set('statementDay')} />
        </Field>
        <Field label={t.cards.dueDay}>
          <input className="field-input" type="number" min="1" max="31" value={payment.dueDay ?? ''} onChange={set('dueDay')} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3 items-end">
        <Field label={t.cards.remindBefore}>
          <input className="field-input" type="number" min="0" value={payment.remindDaysBefore ?? 3} onChange={set('remindDaysBefore')} />
        </Field>
        <label className="flex items-center gap-2 mb-3 text-sm text-mist/80">
          <input type="checkbox" className="w-4 h-4 accent-teal" checked={!!payment.overdueReminder} onChange={set('overdueReminder')} />
          {t.cards.overdue}
        </label>
      </div>
    </div>
  )
}

export default function CardForm({ card, mode = 'add', onSubmitNew, onSubmitEdit }) {
  const { state, t, fmt } = useApp()
  const isEdit = mode === 'edit'
  const [source, setSource] = useState('library') // library | custom
  const [templateId, setTemplateId] = useState(null)
  const [query, setQuery] = useState('')

  const [meta, setMeta] = useState({
    nickname: card?.nickname || '',
    last4: card?.last4 || '',
    issuer: card?.issuer || '',
    name: card?.name || '',
    type: card?.type || 'personal',
    annualFee: card?.annualFee ?? 0,
    openedDate: card?.openedDate || '',
    personId: card?.personId || ''
  })
  const [payment, setPayment] = useState(
    card?.payment || { dueDay: null, statementDay: null, remindDaysBefore: 3, overdueReminder: true }
  )
  const setM = (k) => (e) => setMeta((m) => ({ ...m, [k]: e.target.value }))

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CARD_LIBRARY
    return CARD_LIBRARY.filter((c) => `${c.issuer} ${c.name}`.toLowerCase().includes(q))
  }, [query])

  function pickTemplate(tpl) {
    setTemplateId(tpl.id)
    setMeta((m) => ({ ...m, issuer: tpl.issuer, name: tpl.name, type: tpl.type, annualFee: tpl.annualFee }))
  }

  function submit(e) {
    e.preventDefault()
    const normPayment = {
      ...payment,
      statementDay: payment.statementDay ? Number(payment.statementDay) : null,
      dueDay: payment.dueDay ? Number(payment.dueDay) : null,
      remindDaysBefore: Number(payment.remindDaysBefore) || 0
    }
    if (isEdit) {
      onSubmitEdit?.({
        nickname: meta.nickname,
        last4: meta.last4,
        issuer: meta.issuer,
        name: meta.name,
        type: meta.type,
        annualFee: Number(meta.annualFee) || 0,
        openedDate: meta.openedDate || null,
        personId: meta.personId || null,
        payment: normPayment
      })
      return
    }
    const overrides = {
      nickname: meta.nickname,
      last4: meta.last4,
      openedDate: meta.openedDate || null,
      personId: meta.personId || null,
      payment: normPayment
    }
    let built
    if (source === 'library' && templateId) {
      built = instantiateTemplate(templateId, overrides)
    } else {
      built = blankCard({
        ...overrides,
        issuer: meta.issuer,
        name: meta.name,
        type: meta.type,
        annualFee: Number(meta.annualFee) || 0
      })
    }
    onSubmitNew?.(built)
  }

  return (
    <form id="card-form" onSubmit={submit}>
      {!isEdit && (
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setSource('library')} className={source === 'library' ? 'btn-primary flex-1' : 'btn-ghost flex-1'}>
            {t.cards.fromLibrary}
          </button>
          <button type="button" onClick={() => setSource('custom')} className={source === 'custom' ? 'btn-primary flex-1' : 'btn-ghost flex-1'}>
            {t.cards.custom}
          </button>
        </div>
      )}

      {!isEdit && source === 'library' && (
        <div className="mb-4">
          <input className="field-input mb-2" placeholder={t.cards.search} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="max-h-52 overflow-y-auto space-y-1.5">
            {filtered.map((c) => (
              <button
                type="button"
                key={c.id}
                onClick={() => pickTemplate(c)}
                className={`w-full text-left card-surface px-3 py-2.5 ${templateId === c.id ? 'border-tealLight/80' : ''}`}
              >
                <div className="font-medium text-mist">{c.name}</div>
                <div className="text-xs text-mist/50">
                  {c.issuer} · {t.cards.types[c.type]} · ${c.annualFee}/yr · {c.benefits.length} perks
                </div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-mist/40 mt-2">{fmt(t.cards.libraryNote, { date: CARD_LIBRARY_AS_OF })}</p>
        </div>
      )}

      {(isEdit || source === 'custom') && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t.cards.issuer}>
            <input className="field-input" list="issuers" value={meta.issuer} onChange={setM('issuer')} />
            <datalist id="issuers">
              {ISSUERS.map((i) => <option key={i} value={i} />)}
            </datalist>
          </Field>
          <Field label={t.cards.productName}>
            <input className="field-input" value={meta.name} onChange={setM('name')} />
          </Field>
          <Field label={t.cards.type}>
            <select className="field-input" value={meta.type} onChange={setM('type')}>
              {CARD_TYPES.map((ty) => <option key={ty} value={ty}>{t.cards.types[ty]}</option>)}
            </select>
          </Field>
          <Field label={t.cards.annualFee}>
            <input className="field-input" type="number" min="0" value={meta.annualFee} onChange={setM('annualFee')} />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={t.cards.nickname} hint={t.common.optional}>
          <input className="field-input" placeholder="e.g. 旅行卡" value={meta.nickname} onChange={setM('nickname')} />
        </Field>
        <Field label={t.cards.last4} hint={t.common.optional}>
          <input className="field-input" inputMode="numeric" maxLength="4" placeholder="1234" value={meta.last4} onChange={setM('last4')} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.cards.openedDate} hint={t.benefit.bases.anniversary}>
          <input className="field-input" type="date" value={meta.openedDate || ''} onChange={setM('openedDate')} />
        </Field>
        <Field label={t.cards.cardholder} hint={t.common.optional}>
          <select className="field-input" value={meta.personId} onChange={setM('personId')}>
            <option value="">{t.common.none}</option>
            {state.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>

      <PaymentFields payment={payment} onChange={setPayment} t={t} />
    </form>
  )
}
