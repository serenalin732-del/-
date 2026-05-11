import { useState } from 'react'
import { useApp, CATEGORY_IDS, categoryStats, overallStats } from '../context/AppContext.jsx'

export default function Progress({ navigate }) {
  const { t, state, dispatch } = useApp()
  const overall = overallStats(state.items)
  const [confirming, setConfirming] = useState(false)
  const [resetFlash, setResetFlash] = useState(false)

  const keptWithPlace = state.items.filter((i) => i.status === 'kept' && i.place).length
  const keptTotal = overall.kept

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-2xl">{t.progress.title}</h1>
      </header>

      {overall.total === 0 ? (
        <div className="card p-8 text-center text-sm text-ink/55">
          {t.progress.noData}
          <div className="mt-4">
            <button onClick={() => navigate('categories')} className="btn-primary">
              {t.home.goCategories} →
            </button>
          </div>
        </div>
      ) : (
        <>
          <section className="card p-5">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-ink/65">{t.progress.overall}</span>
              <span className="font-serif text-3xl">{Math.round(overall.completion * 100)}%</span>
            </div>
            <div className="h-2 rounded-full bg-mist mt-2 overflow-hidden">
              <div
                className="h-full bg-rose transition-all"
                style={{ width: `${overall.completion * 100}%` }}
              />
            </div>
            <div className="grid grid-cols-4 gap-2 mt-4 text-center text-xs">
              <Stat label={t.progress.kept} value={overall.kept} color="text-sage" />
              <Stat label={t.progress.released} value={overall.released} color="text-rose" />
              <Stat label={t.progress.pending} value={overall.pending} color="text-ink/50" />
              <Stat label={t.progress.total} value={overall.total} />
            </div>
            {keptTotal > 0 && (
              <div className="mt-3 text-xs text-ink/60 text-center">
                {t.progress.keptHomes}: {keptWithPlace}/{keptTotal}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-ink/70">{t.progress.byCategory}</h2>
            {CATEGORY_IDS.map((id) => {
              const s = categoryStats(state.items, id)
              return (
                <div key={id} className="card p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{t.categories[id]}</span>
                    <span className="text-xs text-ink/55">
                      {s.total === 0 ? '—' : `${Math.round(s.completion * 100)}%`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-mist mt-2 overflow-hidden">
                    <div
                      className="h-full bg-rose transition-all"
                      style={{ width: `${s.completion * 100}%` }}
                    />
                  </div>
                  {s.total > 0 && (
                    <div className="flex gap-3 text-xs text-ink/60 mt-1.5">
                      <span className="text-sage">✓ {s.kept}</span>
                      <span className="text-rose/80">↟ {s.released}</span>
                      <span className="text-ink/40">◌ {s.pending}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </section>

          <section className="card p-4 bg-blush/20 border-blush/30">
            <h3 className="font-medium text-sm">{t.progress.reflection}</h3>
            <p className="text-sm text-ink/70 mt-2 leading-relaxed">{t.progress.reflectionBody}</p>
          </section>
        </>
      )}

      <section className="pt-2">
        {!confirming ? (
          <button
            onClick={() => setConfirming(true)}
            className="text-xs text-ink/45 hover:text-rose"
          >
            {t.progress.reset}
          </button>
        ) : (
          <div className="card p-4 bg-rose/10 border-rose/20">
            <p className="text-sm text-ink/80">{t.progress.resetConfirm}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => setConfirming(false)} className="btn-outline flex-1">
                {t.item.cancel}
              </button>
              <button
                onClick={() => {
                  dispatch({ type: 'RESET' })
                  setConfirming(false)
                  setResetFlash(true)
                  setTimeout(() => setResetFlash(false), 1600)
                }}
                className="btn flex-1 bg-rose text-cream"
              >
                {t.common.yes}
              </button>
            </div>
          </div>
        )}
        {resetFlash && <p className="text-xs text-rose mt-2">{t.progress.resetDone} ✓</p>}
      </section>
    </div>
  )
}

function Stat({ label, value, color = '' }) {
  return (
    <div>
      <div className={`font-serif text-xl ${color}`}>{value}</div>
      <div className="text-ink/55">{label}</div>
    </div>
  )
}
