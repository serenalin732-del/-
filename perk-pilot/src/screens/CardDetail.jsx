import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { benefitState, claimKey, cardUtilization } from '../utils/benefits.js'
import { periodLabel } from '../utils/cycles.js'
import { paymentStatus, benefitExpiry } from '../utils/reminders.js'
import { cardHasNewerCatalog, diffCardAgainstTemplate } from '../utils/catalog.js'
import { findTemplate } from '../data/cardLibrary.js'
import { ProgressBar, Badge, money, Field } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import BenefitForm from '../components/BenefitForm.jsx'
import CardForm from '../components/CardForm.jsx'
import UpdatesReview from '../components/UpdatesReview.jsx'

export default function CardDetail({ cardId, navigate }) {
  const { state, dispatch, t, fmt, lang } = useApp()
  const now = new Date()
  const card = state.cards.find((c) => c.id === cardId)
  const [editingCard, setEditingCard] = useState(false)
  const [benefitModal, setBenefitModal] = useState(null) // {benefit} | {} for new | null
  const [reviewing, setReviewing] = useState(false)

  if (!card) {
    return (
      <div className="p-4">
        <button className="btn-ghost" onClick={() => navigate('cards')}>← {t.common.back}</button>
        <p className="text-mist/60 mt-4">—</p>
      </div>
    )
  }

  const u = cardUtilization(card, state.benefits, state.claims, now)
  const ps = paymentStatus(card, now)
  const person = state.people.find((p) => p.id === card.personId)

  const template = findTemplate(card.templateId)
  const cardDiff = template && cardHasNewerCatalog(card, template) ? diffCardAgainstTemplate(card, state.benefits, template) : null
  const hasUpdate = cardDiff?.hasChanges

  function saveBenefit(data) {
    if (benefitModal?.benefit) {
      dispatch({ type: 'UPDATE_BENEFIT', id: benefitModal.benefit.id, patch: data })
    } else {
      dispatch({ type: 'ADD_BENEFIT', benefit: { cardId: card.id, ...data } })
    }
    setBenefitModal(null)
  }

  function setUsage(benefit, patch) {
    const st = benefitState(benefit, state.claims, now, card.openedDate)
    dispatch({ type: 'SET_CLAIM', key: claimKey(benefit.id, st.periodKey), patch })
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <button className="btn-ghost" onClick={() => navigate('cards')}>← {t.common.back}</button>
        <button className="btn-ghost" onClick={() => setEditingCard(true)}>{t.common.edit}</button>
      </div>

      {/* Card header */}
      <div className="card-surface p-4">
        <div className="text-xl font-bold text-mist">
          {card.nickname || card.name}
          {card.last4 && <span className="text-mist/40 font-normal text-base"> ····{card.last4}</span>}
        </div>
        <div className="text-sm text-mist/50">
          {card.issuer} · {card.name} · {t.cards.types[card.type]}
          {person ? ` · ${person.name}` : ''}
        </div>
        <div className="text-xs text-mist/40 mt-1">{t.cards.annualFee}: {money(card.annualFee)}</div>
        {u.available > 0 && (
          <div className="mt-3">
            <div className="flex justify-between text-xs text-mist/50 mb-1">
              <span>{t.dashboard.capturedThisCycle}: {money(u.captured)} / {money(u.available)}</span>
              <span>{u.pct}%</span>
            </div>
            <ProgressBar pct={u.pct} />
          </div>
        )}
      </div>

      {hasUpdate && (
        <button
          onClick={() => setReviewing(true)}
          className="w-full rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3 flex items-center justify-between text-left"
        >
          <span className="text-sm text-gold">🔔 {t.updates.title}</span>
          <span className="chip bg-gold/20 text-gold">{t.updates.review}</span>
        </button>
      )}

      {/* Payment */}
      {ps && (
        <div className="card-surface p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-mist">{t.cards.payment}</div>
            <div className="text-xs text-mist/50">
              {ps.dueDate.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
          <Badge tone={ps.state === 'overdue' ? 'bad' : ps.state === 'scheduled' ? 'neutral' : 'warn'}>
            {ps.state === 'overdue'
              ? fmt(t.dashboard.overdue, { n: Math.abs(ps.daysUntil) })
              : ps.state === 'due_today'
                ? t.dashboard.dueToday
                : fmt(t.dashboard.dueIn, { n: ps.daysUntil })}
          </Badge>
        </div>
      )}

      {/* Multipliers */}
      {card.multipliers?.length > 0 && (
        <div className="card-surface p-4">
          <div className="text-sm font-medium text-mist mb-2">{t.cards.multipliers}</div>
          <div className="flex flex-wrap gap-1.5">
            {card.multipliers.map((m, i) => (
              <span key={i} className="chip bg-teal/15 text-tealLight">{m.rate}× {m.category}</span>
            ))}
          </div>
        </div>
      )}

      {/* Benefits */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-mist/70">{t.cards.benefits}</h2>
        <button className="btn-ghost !py-1.5 !px-3 text-sm" onClick={() => setBenefitModal({})}>+ {t.cards.addBenefit}</button>
      </div>

      {u.items.length === 0 ? (
        <p className="text-sm text-mist/50 px-1">{t.cards.noBenefits}</p>
      ) : (
        <div className="space-y-2">
          {u.items.map(({ benefit, ...st }) => (
            <BenefitRow
              key={benefit.id}
              benefit={benefit}
              st={st}
              card={card}
              now={now}
              t={t}
              fmt={fmt}
              lang={lang}
              onEdit={() => setBenefitModal({ benefit })}
              onDelete={() => dispatch({ type: 'DELETE_BENEFIT', id: benefit.id })}
              onSetUsage={(patch) => setUsage(benefit, patch)}
            />
          ))}
        </div>
      )}

      <button
        className="btn-danger w-full mt-4"
        onClick={() => {
          dispatch({ type: 'DELETE_CARD', id: card.id })
          navigate('cards')
        }}
      >
        {t.cards.deleteCard}
      </button>

      {/* Edit card modal */}
      <Modal
        open={editingCard}
        onClose={() => setEditingCard(false)}
        title={t.common.edit}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditingCard(false)}>{t.common.cancel}</button>
            <button className="btn-primary" type="submit" form="card-form">{t.common.save}</button>
          </>
        }
      >
        <CardForm
          mode="edit"
          card={card}
          onSubmitEdit={(patch) => {
            dispatch({ type: 'UPDATE_CARD', id: card.id, patch })
            setEditingCard(false)
          }}
        />
      </Modal>

      {/* Add/edit benefit modal */}
      <Modal
        open={!!benefitModal}
        onClose={() => setBenefitModal(null)}
        title={benefitModal?.benefit ? t.common.edit : t.cards.addBenefit}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setBenefitModal(null)}>{t.common.cancel}</button>
            <button className="btn-primary" type="submit" form="benefit-form">{t.common.save}</button>
          </>
        }
      >
        {benefitModal && <BenefitForm benefit={benefitModal.benefit} onSave={saveBenefit} />}
      </Modal>

      <Modal open={reviewing && hasUpdate} onClose={() => setReviewing(false)} title={t.updates.title}>
        {hasUpdate && <UpdatesReview pending={[{ card, template, diff: cardDiff }]} onDone={() => setReviewing(false)} />}
      </Modal>
    </div>
  )
}

function BenefitRow({ benefit, st, card, now, t, fmt, lang, onEdit, onDelete, onSetUsage }) {
  const [open, setOpen] = useState(false)
  const exp = benefit.cadence !== 'one_time' ? benefitExpiry(benefit, now, card.openedDate, benefit.remindDaysBefore ?? 7) : null
  const label = periodLabel(benefit, now, card.openedDate, lang)

  return (
    <div className="card-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <button className="text-left min-w-0 flex-1" onClick={() => setOpen((o) => !o)}>
          <div className="flex items-center gap-2">
            <span className="font-medium text-mist truncate">{benefit.name}</span>
            {st.used && <Badge tone="good">✓</Badge>}
          </div>
          <div className="text-xs text-mist/40">
            {t.benefit.cadences[benefit.cadence]}{benefit.value > 0 ? ` · ${money(benefit.value)}` : ''} · {label}
          </div>
        </button>
        <div className="text-right shrink-0">
          {st.value > 0 && <div className="text-xs text-mist/50">{st.pct}%</div>}
          {exp?.expiring && !st.used && <Badge tone={exp.daysUntil <= 3 ? 'bad' : 'warn'}>{fmt(t.dashboard.expiresIn, { n: exp.daysUntil })}</Badge>}
        </div>
      </div>

      {st.value > 0 && (
        <div className="mt-2">
          <ProgressBar pct={st.pct} />
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-2 animate-fade-in">
          {st.mode === 'amount' ? (
            <div className="flex items-end gap-2">
              <Field label={t.benefit.usedAmount}>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={st.usedAmount}
                  onChange={(e) => onSetUsage({ usedAmount: Math.max(0, Number(e.target.value) || 0) })}
                />
              </Field>
              <button className="btn-ghost mb-3 whitespace-nowrap" onClick={() => onSetUsage({ usedAmount: st.value })}>
                {fmt('{n}', { n: money(st.value) })} ✓
              </button>
            </div>
          ) : (
            <button
              className={st.used ? 'btn-ghost w-full' : 'btn-primary w-full'}
              onClick={() => onSetUsage({ used: !st.used })}
            >
              {st.used ? t.benefit.markUnused : t.benefit.markUsed}
            </button>
          )}
          {st.remaining > 0 && st.value > 0 && (
            <p className="text-xs text-gold/80">{fmt(t.benefit.remaining, { n: money(st.remaining) })}</p>
          )}
          {benefit.note && <p className="text-xs text-mist/40">{benefit.note}</p>}
          <div className="flex gap-2 pt-1">
            <button className="btn-ghost !py-1.5 text-sm flex-1" onClick={onEdit}>{t.common.edit}</button>
            <button className="btn-danger !py-1.5 text-sm flex-1" onClick={onDelete}>{t.common.delete}</button>
          </div>
        </div>
      )}
    </div>
  )
}
