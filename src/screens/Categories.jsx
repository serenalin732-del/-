import { useApp, CATEGORY_IDS, categoryStats } from '../context/AppContext.jsx'

const CATEGORY_META = {
  clothes: { emoji: '👕', accent: 'bg-blush/40' },
  books: { emoji: '📚', accent: 'bg-sage/30' },
  papers: { emoji: '📄', accent: 'bg-mist' },
  komono: { emoji: '🧴', accent: 'bg-rose/20' },
  sentimental: { emoji: '🎁', accent: 'bg-blush/30' }
}

export default function Categories({ navigate }) {
  const { t, state, dispatch } = useApp()

  const enter = (id) => {
    dispatch({ type: 'SET_ACTIVE_CATEGORY', category: id })
    navigate('category')
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-serif text-2xl">{t.categories.title}</h1>
        <p className="text-sm text-ink/65 mt-1">{t.categories.subtitle}</p>
      </header>

      <ol className="space-y-3">
        {CATEGORY_IDS.map((id, index) => {
          const meta = CATEGORY_META[id]
          const stats = categoryStats(state.items, id)
          const prevId = CATEGORY_IDS[index - 1]
          const prevStats = prevId ? categoryStats(state.items, prevId) : null
          // Soft lock: previous category must have at least 1 item AND be 100% decided.
          // But always allow if user wants — we just show a hint.
          const softLocked = prevStats && prevStats.total > 0 && prevStats.completion < 1
          const isDone = stats.total > 0 && stats.completion === 1
          const inProgress = stats.total > 0 && !isDone

          return (
            <li key={id}>
              <button
                onClick={() => enter(id)}
                className={`w-full card p-4 text-left flex items-center gap-4 hover:bg-white/90 transition`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${meta.accent}`}>
                  {meta.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-ink/40 text-xs">{index + 1}</span>
                    <span className="font-medium">{t.categories[id]}</span>
                    {isDone && <span className="chip !bg-sage/30 !text-sage">✓ {t.categories.done}</span>}
                    {inProgress && <span className="chip">{t.categories.inProgress}</span>}
                  </div>
                  <p className="text-xs text-ink/55 mt-0.5 truncate">{t.categories[id + 'Desc']}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-ink/60">
                    <span>{t.categories.itemsCount(stats.total)}</span>
                    {stats.total > 0 && (
                      <div className="flex-1 h-1 rounded-full bg-mist overflow-hidden">
                        <div
                          className="h-full bg-rose transition-all"
                          style={{ width: `${stats.completion * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {softLocked && (
                    <p className="text-[11px] text-ink/40 mt-1.5 italic">↑ {t.categories.locked}</p>
                  )}
                </div>
                <span className="text-rose">→</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
