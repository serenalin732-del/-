import { useEffect, useState } from 'react'
import { useApp } from './context/AppContext.jsx'
import Dashboard from './screens/Dashboard.jsx'
import Cards from './screens/Cards.jsx'
import CardDetail from './screens/CardDetail.jsx'
import Points from './screens/Points.jsx'
import Summary from './screens/Summary.jsx'
import Settings from './screens/Settings.jsx'
import { activeReminders } from './utils/reminders.js'
import { benefitState } from './utils/benefits.js'
import { pendingUpdatesForCards } from './utils/catalog.js'
import { surfaceReminders } from './utils/notifications.js'

const TABS = ['dashboard', 'cards', 'points', 'summary', 'settings']
const ICONS = { dashboard: '🏠', cards: '💳', points: '⭐', summary: '📊', settings: '⚙️' }

export default function App() {
  const { state, t, fmt, lang } = useApp()
  const [view, setView] = useState({ tab: 'dashboard', cardId: null })

  // Keep the document language in sync for a11y / correct font rendering.
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  }, [lang])

  const navigate = (tab, cardId = null) => {
    setView({ tab, cardId })
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      try {
        window.scrollTo(0, 0)
      } catch {
        /* jsdom / unsupported env */
      }
    }
  }

  // On open, surface any due/expiring reminders as device notifications.
  useEffect(() => {
    if (!state.settings.notificationsEnabled) return
    const now = new Date()
    const reminders = activeReminders(state, now).filter((r) => {
      if (r.kind !== 'benefit') return true
      const b = state.benefits.find((x) => x.id === r.benefitId)
      const card = state.cards.find((c) => c.id === r.cardId)
      return b && !benefitState(b, state.claims, now, card?.openedDate).used
    })
    const pending = pendingUpdatesForCards(state.cards, state.benefits)
    if (pending.length > 0) reminders.push({ kind: 'update', id: 'catalog-updates', count: pending.length, daysUntil: 0 })
    surfaceReminders(reminders, (r) => {
      if (r.kind === 'update') {
        return { title: t.updates.title, body: fmt(t.updates.banner, { n: r.count }) }
      }
      const card = state.cards.find((c) => c.id === r.cardId)
      const name = card ? card.nickname || card.name : ''
      if (r.kind === 'payment') {
        const body =
          r.state === 'overdue'
            ? fmt(t.dashboard.overdue, { n: Math.abs(r.daysUntil) })
            : r.state === 'due_today'
              ? t.dashboard.dueToday
              : fmt(t.dashboard.dueIn, { n: r.daysUntil })
        return { title: `${t.dashboard.upcomingPayments}: ${name}`, body }
      }
      const b = state.benefits.find((x) => x.id === r.benefitId)
      return { title: `${t.dashboard.expiringPerks}: ${name}`, body: `${b?.name} · ${fmt(t.dashboard.expiresIn, { n: r.daysUntil })}` }
    })
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const screen = (() => {
    if (view.tab === 'cards' && view.cardId) return <CardDetail cardId={view.cardId} navigate={navigate} />
    switch (view.tab) {
      case 'cards':
        return <Cards navigate={navigate} />
      case 'points':
        return <Points navigate={navigate} />
      case 'summary':
        return <Summary navigate={navigate} />
      case 'settings':
        return <Settings />
      default:
        return <Dashboard navigate={navigate} />
    }
  })()

  return (
    <div className="min-h-full max-w-xl mx-auto flex flex-col">
      <main className="flex-1 pb-24 pt-safe">{screen}</main>

      <nav className="fixed bottom-0 inset-x-0 max-w-xl mx-auto bg-slate/95 backdrop-blur border-t border-steel/60 pb-safe">
        <div className="grid grid-cols-5">
          {TABS.map((tab) => {
            const active = view.tab === tab
            return (
              <button
                key={tab}
                onClick={() => navigate(tab)}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition ${active ? 'text-tealLight' : 'text-mist/50'}`}
              >
                <span className="text-lg leading-none">{ICONS[tab]}</span>
                {t.nav[tab]}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
