import { useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { cardUtilization, cardYearSummary, benefitState as bState } from '../utils/benefits.js'
import { activeReminders } from '../utils/reminders.js'
import { ProgressBar, Badge, money, EmptyState } from '../components/ui.jsx'

export default function Dashboard({ navigate }) {
  const { state, t, fmt, lang } = useApp()
  const now = new Date()
  const { cards, benefits, claims } = state

  const totals = useMemo(() => {
    let captured = 0
    let available = 0
    let leftThisYear = 0
    for (const c of cards) {
      const u = cardUtilization(c, benefits, claims, now)
      captured += u.captured
      available += u.available
      const ys = cardYearSummary(c, benefits, claims, now.getFullYear())
      leftThisYear += ys.leftovers.reduce((s, l) => s + l.missed, 0)
    }
    return { captured, available, leftThisYear, pct: available > 0 ? Math.round((captured / available) * 100) : 0 }
  }, [cards, benefits, claims])

  // Active reminders, but drop benefit reminders that are already fully used.
  const reminders = useMemo(() => {
    const all = activeReminders({ cards, benefits, claims }, now)
    return all.filter((r) => {
      if (r.kind !== 'benefit') return true
      const b = benefits.find((x) => x.id === r.benefitId)
      const card = cards.find((c) => c.id === r.cardId)
      const st = bState(b, claims, now, card?.openedDate)
      return !st.used
    })
  }, [cards, benefits, claims])

  const payments = reminders.filter((r) => r.kind === 'payment')
  const expiring = reminders.filter((r) => r.kind === 'benefit')

  const cardName = (id) => {
    const c = cards.find((x) => x.id === id)
    if (!c) return ''
    return [c.nickname, c.name, c.last4 ? `····${c.last4}` : ''].filter(Boolean).join(' · ')
  }

  if (cards.length === 0) {
    return (
      <div className="p-4">
        <Header t={t} />
        <EmptyState action={<button className="btn-primary" onClick={() => navigate('cards')}>{t.dashboard.addCard}</button>}>
          {t.dashboard.noCards}
        </EmptyState>
      </div>
    )
  }

  const paymentTone = (s) => (s === 'overdue' ? 'bad' : s === 'due_today' ? 'warn' : 'warn')
  const paymentLabel = (r) =>
    r.state === 'overdue'
      ? fmt(t.dashboard.overdue, { n: Math.abs(r.daysUntil) })
      : r.state === 'due_today'
        ? t.dashboard.dueToday
        : fmt(t.dashboard.dueIn, { n: r.daysUntil })

  return (
    <div className="p-4 space-y-4">
      <Header t={t} />

      <div className="card-surface p-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm text-mist/60">{t.dashboard.capturedThisCycle}</span>
          <span className="text-mist font-semibold">
            {money(totals.captured)} <span className="text-mist/40 font-normal">{t.dashboard.of} {money(totals.available)}</span>
          </span>
        </div>
        <ProgressBar pct={totals.pct} />
        {totals.leftThisYear > 0 && (
          <p className="text-xs text-gold/90 mt-3">
            💰 {money(totals.leftThisYear)} {t.dashboard.valueLeft}
          </p>
        )}
      </div>

      <Section title={t.dashboard.upcomingPayments}>
        {payments.length === 0 ? (
          <p className="text-sm text-mist/50 px-1">{t.dashboard.nothingDue}</p>
        ) : (
          payments.map((r) => (
            <button key={r.id} onClick={() => navigate('cardDetail', r.cardId)} className="w-full card-surface px-4 py-3 flex items-center justify-between text-left">
              <span className="text-mist text-sm">{cardName(r.cardId)}</span>
              <Badge tone={paymentTone(r.state)}>{paymentLabel(r)}</Badge>
            </button>
          ))
        )}
      </Section>

      <Section title={t.dashboard.expiringPerks}>
        {expiring.length === 0 ? (
          <p className="text-sm text-mist/50 px-1">{t.dashboard.nothingExpiring}</p>
        ) : (
          expiring.map((r) => {
            const b = benefits.find((x) => x.id === r.benefitId)
            return (
              <button key={r.id} onClick={() => navigate('cardDetail', r.cardId)} className="w-full card-surface px-4 py-3 flex items-center justify-between text-left">
                <span className="text-mist text-sm">
                  {b?.name} <span className="text-mist/40">· {cardName(r.cardId)}</span>
                </span>
                <Badge tone={r.daysUntil <= 3 ? 'bad' : 'warn'}>{fmt(t.dashboard.expiresIn, { n: r.daysUntil })}</Badge>
              </button>
            )
          })
        )}
      </Section>
    </div>
  )
}

function Header({ t }) {
  return (
    <div className="mb-3">
      <h1 className="text-2xl font-bold text-mist">{t.dashboard.title}</h1>
      <p className="text-sm text-tealLight/70">{t.tagline}</p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-mist/70 mb-2 px-1">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}
