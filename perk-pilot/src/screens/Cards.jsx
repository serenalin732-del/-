import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { cardUtilization } from '../utils/benefits.js'
import { paymentStatus } from '../utils/reminders.js'
import { ProgressBar, Badge, money, EmptyState } from '../components/ui.jsx'
import Modal from '../components/Modal.jsx'
import CardForm from '../components/CardForm.jsx'

export default function Cards({ navigate }) {
  const { state, dispatch, t } = useApp()
  const [adding, setAdding] = useState(false)
  const now = new Date()

  function handleNew(built) {
    if (!built) return
    dispatch({ type: 'ADD_CARD', card: built.card, benefits: built.benefits })
    setAdding(false)
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold text-mist">{t.cards.title}</h1>
        <button className="btn-primary" onClick={() => setAdding(true)}>+ {t.cards.add}</button>
      </div>

      {state.cards.length === 0 ? (
        <EmptyState action={<button className="btn-primary" onClick={() => setAdding(true)}>{t.cards.add}</button>}>
          {t.dashboard.noCards}
        </EmptyState>
      ) : (
        state.cards.map((c) => {
          const u = cardUtilization(c, state.benefits, state.claims, now)
          const ps = paymentStatus(c, now)
          const person = state.people.find((p) => p.id === c.personId)
          return (
            <button key={c.id} onClick={() => navigate('cardDetail', c.id)} className="w-full card-surface p-4 text-left">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold text-mist truncate">
                    {c.nickname || c.name}
                    {c.last4 && <span className="text-mist/40 font-normal"> ····{c.last4}</span>}
                  </div>
                  <div className="text-xs text-mist/50 truncate">
                    {c.issuer}{c.nickname ? ` · ${c.name}` : ''}{person ? ` · ${person.name}` : ''}
                  </div>
                </div>
                {ps && (ps.state === 'overdue' || ps.state === 'due_today' || ps.state === 'upcoming') && (
                  <Badge tone={ps.state === 'overdue' ? 'bad' : 'warn'}>
                    {ps.state === 'overdue' ? `overdue ${Math.abs(ps.daysUntil)}d` : ps.state === 'due_today' ? t.dashboard.dueToday : `${ps.daysUntil}d`}
                  </Badge>
                )}
              </div>
              {u.available > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-mist/50 mb-1">
                    <span>{money(u.captured)} / {money(u.available)}</span>
                    <span>{u.pct}%</span>
                  </div>
                  <ProgressBar pct={u.pct} />
                </div>
              )}
            </button>
          )
        })
      )}

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title={t.cards.add}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setAdding(false)}>{t.common.cancel}</button>
            <button className="btn-primary" type="submit" form="card-form">{t.common.save}</button>
          </>
        }
      >
        <CardForm mode="add" onSubmitNew={handleNew} />
      </Modal>
    </div>
  )
}
