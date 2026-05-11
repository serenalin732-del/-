import { useMemo, useState } from 'react'
import { useApp, categoryStats, newId } from '../context/AppContext.jsx'
import ItemDecisionModal from '../components/ItemDecisionModal.jsx'
import AddItemModal from '../components/AddItemModal.jsx'

export default function CategoryDetail({ navigate }) {
  const { t, state, dispatch } = useApp()
  const categoryId = state.activeCategory || 'clothes'
  const ritualDone = !!state.ritualsDone[categoryId]
  const [filter, setFilter] = useState('all')
  const [adding, setAdding] = useState(false)
  const [deciding, setDeciding] = useState(null) // item id

  const stats = useMemo(
    () => categoryStats(state.items, categoryId),
    [state.items, categoryId]
  )

  const items = useMemo(() => {
    const all = state.items.filter((i) => i.category === categoryId)
    if (filter === 'all') return all
    return all.filter((i) => i.status === filter)
  }, [state.items, categoryId, filter])

  if (!ritualDone) {
    return (
      <div className="space-y-5 animate-fade-in">
        <button onClick={() => navigate('categories')} className="chip">← {t.common.back}</button>
        <div className="card p-6 text-center bg-blush/20 border-blush/30">
          <div className="text-4xl mb-3 animate-sparkle inline-block">✦</div>
          <h2 className="font-serif text-xl">{t.categories.ritual.title}</h2>
          <p className="text-sm text-ink/70 mt-3 leading-relaxed">{t.categories.ritual.body}</p>
          <button
            onClick={() => dispatch({ type: 'MARK_RITUAL', category: categoryId })}
            className="btn-primary mt-6"
          >
            {t.categories.ritual.ok}
          </button>
        </div>
      </div>
    )
  }

  const decidingItem = deciding ? state.items.find((i) => i.id === deciding) : null

  const addItem = (data) => {
    const item = {
      id: newId(),
      category: categoryId,
      name: data.name.trim(),
      note: data.note?.trim() || '',
      photo: data.photo || '',
      status: 'pending',
      place: '',
      createdAt: Date.now(),
      decidedAt: null
    }
    dispatch({ type: 'ADD_ITEM', item })
    setAdding(false)
    setDeciding(item.id)
  }

  const decide = (id, status, extra = {}) => {
    dispatch({
      type: 'UPDATE_ITEM',
      id,
      patch: { status, decidedAt: Date.now(), ...extra }
    })
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('categories')} className="chip">← {t.common.back}</button>

      <header>
        <h1 className="font-serif text-2xl">{t.categories[categoryId]}</h1>
        <p className="text-sm text-ink/60 mt-1">{t.categories[categoryId + 'Desc']}</p>
      </header>

      {stats.total > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between text-xs text-ink/65">
            <span>{Math.round(stats.completion * 100)}%</span>
            <div className="flex gap-3">
              <span className="text-sage">✓ {stats.kept}</span>
              <span className="text-rose/80">↟ {stats.released}</span>
              <span className="text-ink/40">◌ {stats.pending}</span>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-mist mt-2 overflow-hidden">
            <div
              className="h-full bg-rose transition-all"
              style={{ width: `${stats.completion * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
        {[
          ['all', t.item.filterAll, stats.total],
          ['kept', t.item.filterKept, stats.kept],
          ['released', t.item.filterReleased, stats.released],
          ['pending', t.item.filterPending, stats.pending]
        ].map(([key, label, n]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`chip whitespace-nowrap ${
              filter === key ? '!bg-rose !text-cream' : ''
            }`}
          >
            {label} · {n}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center text-sm text-ink/55">
          {t.item.empty}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onClick={() => setDeciding(item.id)}
              t={t}
            />
          ))}
        </ul>
      )}

      <button
        onClick={() => setAdding(true)}
        className="btn-primary w-full mt-2"
      >
        + {t.item.addTitle}
      </button>

      {adding && (
        <AddItemModal
          onCancel={() => setAdding(false)}
          onSave={addItem}
          t={t}
        />
      )}

      {decidingItem && (
        <ItemDecisionModal
          item={decidingItem}
          t={t}
          onClose={() => setDeciding(null)}
          onKeep={(place) => {
            decide(decidingItem.id, 'kept', { place })
            setDeciding(null)
          }}
          onRelease={() => {
            decide(decidingItem.id, 'released')
            setDeciding(null)
          }}
          onPending={() => {
            dispatch({ type: 'UPDATE_ITEM', id: decidingItem.id, patch: { status: 'pending' } })
            setDeciding(null)
          }}
          onDelete={() => {
            dispatch({ type: 'DELETE_ITEM', id: decidingItem.id })
            setDeciding(null)
          }}
        />
      )}
    </div>
  )
}

function ItemRow({ item, onClick, t }) {
  const statusStyle = {
    kept: 'border-l-sage',
    released: 'border-l-rose/70',
    pending: 'border-l-ink/15'
  }[item.status]

  const statusIcon = { kept: '✓', released: '↟', pending: '◌' }[item.status]

  return (
    <li>
      <button
        onClick={onClick}
        className={`w-full card p-3 flex items-center gap-3 border-l-4 ${statusStyle} text-left hover:bg-white/90 transition`}
      >
        {item.photo ? (
          <img src={item.photo} alt="" className="w-12 h-12 rounded-xl object-cover bg-mist" />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-mist flex items-center justify-center text-ink/30 text-lg">
            ◇
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{item.name}</div>
          {item.note && <div className="text-xs text-ink/50 truncate mt-0.5">{item.note}</div>}
          {item.status === 'kept' && item.place && (
            <div className="text-xs text-sage mt-0.5">📍 {item.place}</div>
          )}
        </div>
        <span className="text-sm text-ink/40">{statusIcon}</span>
      </button>
    </li>
  )
}
