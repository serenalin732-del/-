import { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { cardYearSummary } from '../utils/benefits.js'
import { ProgressBar, Badge, money, EmptyState } from '../components/ui.jsx'

export default function Summary({ navigate }) {
  const { state, t, fmt } = useApp()
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState(thisYear)
  const years = [thisYear, thisYear - 1, thisYear - 2]

  if (state.cards.length === 0) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold text-mist mb-3">{t.summary.title}</h1>
        <EmptyState action={<button className="btn-primary" onClick={() => navigate('cards')}>{t.dashboard.addCard}</button>}>
          {t.dashboard.noCards}
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-2xl font-bold text-mist">{t.summary.title}</h1>
      <p className="text-sm text-mist/50">{t.summary.intro}</p>

      <div className="flex gap-2">
        {years.map((y) => (
          <button key={y} onClick={() => setYear(y)} className={y === year ? 'btn-primary flex-1' : 'btn-ghost flex-1'}>
            {y}
          </button>
        ))}
      </div>

      {state.cards.map((c) => {
        const s = cardYearSummary(c, state.benefits, state.claims, year)
        if (s.available === 0 && s.annualFee === 0) return null
        const worth = s.netValue >= 0
        return (
          <div key={c.id} className="card-surface p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-mist">
                {c.nickname || c.name}
                {c.last4 && <span className="text-mist/40 font-normal"> ····{c.last4}</span>}
              </div>
              <Badge tone={worth ? 'good' : 'bad'}>{worth ? t.summary.worthIt : t.summary.reconsider}</Badge>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <Stat label={t.summary.captured} value={money(s.captured)} tone="text-good" />
              <Stat label={t.summary.annualFee} value={money(s.annualFee)} tone="text-mist/70" />
              <Stat label={t.summary.netValue} value={money(s.netValue)} tone={worth ? 'text-good' : 'text-rose'} />
            </div>

            {s.available > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-mist/50 mb-1">
                  <span>{money(s.captured)} / {money(s.available)}</span>
                  <span>{s.pct}%</span>
                </div>
                <ProgressBar pct={s.pct} />
              </div>
            )}

            {s.leftovers.length === 0 ? (
              <p className="text-xs text-good mt-3">{t.summary.allUsed}</p>
            ) : (
              <div className="mt-3">
                <p className="text-xs font-medium text-mist/60 mb-1">{t.summary.leftovers}</p>
                <ul className="space-y-1">
                  {s.leftovers.map((l) => (
                    <li key={l.benefit.id} className="flex justify-between text-xs text-mist/70">
                      <span className="truncate">{l.benefit.name}</span>
                      <span className="text-gold shrink-0 ml-2">{fmt(t.summary.missed, { n: money(l.missed) })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function Stat({ label, value, tone }) {
  return (
    <div className="bg-ink/50 rounded-xl py-2">
      <div className={`font-semibold ${tone}`}>{value}</div>
      <div className="text-[10px] text-mist/40">{label}</div>
    </div>
  )
}
