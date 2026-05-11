import { useApp, overallStats } from '../context/AppContext.jsx'

export default function Home({ navigate }) {
  const { t, state } = useApp()
  const stats = overallStats(state.items)
  const hasVision = !!(state.vision?.ideal || state.vision?.atmosphere || state.vision?.timeFor)
  const hasItems = state.items.length > 0

  return (
    <div className="space-y-6">
      <section className="pt-4">
        <p className="text-ink/60 text-sm">
          {hasItems ? t.home.welcome : t.home.welcomeFirst}
        </p>
        <h1 className="font-serif text-3xl mt-1 leading-tight">{t.appName}</h1>
        <p className="text-ink/70 mt-1 text-sm">{t.tagline}</p>
      </section>

      <section className="card p-5">
        <p className="text-sm text-ink/75 leading-relaxed">{t.home.intro}</p>
      </section>

      {hasItems && (
        <section className="grid grid-cols-3 gap-3">
          <SummaryCard label={t.home.summaryKept} value={stats.kept} accent="bg-sage/30" />
          <SummaryCard label={t.home.summaryReleased} value={stats.released} accent="bg-blush/40" />
          <SummaryCard label={t.home.summaryPending} value={stats.pending} accent="bg-mist" />
        </section>
      )}

      <section className="space-y-3">
        <button
          onClick={() => navigate('vision')}
          className="w-full card p-4 text-left flex items-center justify-between hover:bg-white/90 transition"
        >
          <div>
            <div className="font-medium">{hasVision ? t.home.continueVision : t.home.startVision}</div>
            <div className="text-xs text-ink/55 mt-1">
              {hasVision ? state.vision.ideal : t.vision.subtitle}
            </div>
          </div>
          <span className="text-rose text-xl">→</span>
        </button>

        <button
          onClick={() => navigate('categories')}
          className="w-full card p-4 text-left flex items-center justify-between hover:bg-white/90 transition"
        >
          <div>
            <div className="font-medium">{t.home.goCategories}</div>
            <div className="text-xs text-ink/55 mt-1">
              {t.categories.clothes} → {t.categories.books} → {t.categories.papers} → {t.categories.komono} → {t.categories.sentimental}
            </div>
          </div>
          <span className="text-rose text-xl">→</span>
        </button>

        {hasItems && (
          <button
            onClick={() => navigate('progress')}
            className="w-full card p-4 text-left flex items-center justify-between hover:bg-white/90 transition"
          >
            <div>
              <div className="font-medium">{t.home.seeProgress}</div>
              <div className="text-xs text-ink/55 mt-1">
                {Math.round(stats.completion * 100)}%
              </div>
            </div>
            <span className="text-rose text-xl">→</span>
          </button>
        )}
      </section>
    </div>
  )
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className={`rounded-2xl p-3 text-center ${accent}`}>
      <div className="text-2xl font-serif">{value}</div>
      <div className="text-xs text-ink/60 mt-0.5">{label}</div>
    </div>
  )
}
