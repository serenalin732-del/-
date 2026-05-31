import { useState } from 'react'
import { Field } from './ui.jsx'
import { CADENCES, RESET_BASES } from '../utils/cycles.js'
import { useApp } from '../context/AppContext.jsx'

const CATEGORIES = ['travel', 'dining', 'entertainment', 'retail', 'wellness', 'business', 'statement_credit', 'free_night', 'points', 'other']

export default function BenefitForm({ benefit, onSave }) {
  const { t } = useApp()
  const [form, setForm] = useState({
    name: benefit?.name || '',
    value: benefit?.value ?? 0,
    cadence: benefit?.cadence || 'monthly',
    resetBasis: benefit?.resetBasis || 'calendar',
    trackingMode: benefit?.trackingMode || 'amount',
    category: benefit?.category || 'travel',
    note: benefit?.note || '',
    remindDaysBefore: benefit?.remindDaysBefore ?? 7
  })
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <form
      id="benefit-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!form.name.trim()) return
        onSave({
          ...form,
          value: Number(form.value) || 0,
          remindDaysBefore: Number(form.remindDaysBefore) || 0
        })
      }}
    >
      <Field label={t.benefit.name}>
        <input className="field-input" value={form.name} onChange={set('name')} autoFocus required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.benefit.value}>
          <input className="field-input" type="number" min="0" step="0.01" value={form.value} onChange={set('value')} />
        </Field>
        <Field label={t.benefit.tracking}>
          <select className="field-input" value={form.trackingMode} onChange={set('trackingMode')}>
            <option value="amount">{t.benefit.modes.amount}</option>
            <option value="check">{t.benefit.modes.check}</option>
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.benefit.cadence}>
          <select className="field-input" value={form.cadence} onChange={set('cadence')}>
            {CADENCES.map((c) => (
              <option key={c} value={c}>{t.benefit.cadences[c]}</option>
            ))}
          </select>
        </Field>
        <Field label={t.benefit.resetBasis}>
          <select className="field-input" value={form.resetBasis} onChange={set('resetBasis')}>
            {RESET_BASES.map((b) => (
              <option key={b} value={b}>{t.benefit.bases[b]}</option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.benefit.category}>
          <select className="field-input" value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label={t.benefit.remindBefore}>
          <input className="field-input" type="number" min="0" value={form.remindDaysBefore} onChange={set('remindDaysBefore')} />
        </Field>
      </div>
      <Field label={t.benefit.note}>
        <textarea className="field-input" rows="2" value={form.note} onChange={set('note')} />
      </Field>
    </form>
  )
}
