import { useEffect, useState } from 'react'
import Modal from './Modal.jsx'

export default function ItemDecisionModal({ item, t, onClose, onKeep, onRelease, onPending, onDelete }) {
  // phases: 'ask' | 'place' (when keep) | 'thank' (when release)
  const [phase, setPhase] = useState(item.status === 'kept' ? 'detail' : item.status === 'released' ? 'detail' : 'ask')
  const [place, setPlace] = useState(item.place || '')

  useEffect(() => {
    setPhase(item.status === 'kept' || item.status === 'released' ? 'detail' : 'ask')
    setPlace(item.place || '')
  }, [item.id, item.status])

  return (
    <Modal onClose={onClose}>
      {item.photo && (
        <img src={item.photo} alt="" className="w-full h-48 object-cover rounded-2xl mb-4" />
      )}
      <h3 className="font-serif text-xl">{item.name}</h3>
      {item.note && <p className="text-sm text-ink/60 mt-1">{item.note}</p>}

      {phase === 'ask' && (
        <div className="mt-5 animate-fade-in">
          <p className="text-sm text-ink/65">{t.item.decidePrompt}</p>
          <p className="font-serif text-2xl mt-2">{t.item.sparkQuestion}</p>

          <div className="mt-6 space-y-2">
            <button onClick={() => setPhase('place')} className="btn w-full bg-sage/30 text-ink hover:bg-sage/40">
              ✦ {t.item.keep}
            </button>
            <button onClick={() => setPhase('thank')} className="btn w-full bg-blush/40 text-ink hover:bg-blush/60">
              ↟ {t.item.release}
            </button>
            <button onClick={onPending} className="btn-outline w-full">
              ◌ {t.item.undecided}
            </button>
          </div>
        </div>
      )}

      {phase === 'place' && (
        <div className="mt-5 animate-fade-in">
          <p className="text-sm font-medium">{t.item.placeQuestion}</p>
          <input
            autoFocus
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            placeholder={t.item.placePh}
            className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm focus:outline-none focus:border-rose"
          />
          <div className="flex gap-2 mt-5">
            <button onClick={() => setPhase('ask')} className="btn-outline flex-1">
              {t.common.back}
            </button>
            <button onClick={() => onKeep(place.trim())} className="btn-primary flex-1">
              ✦ {t.item.keep}
            </button>
          </div>
        </div>
      )}

      {phase === 'thank' && (
        <div className="mt-5 animate-fade-in text-center">
          <div className="text-4xl animate-sparkle inline-block">🙏</div>
          <p className="font-serif text-lg mt-3">{t.item.thank}</p>
          <p className="text-sm text-ink/65 mt-2 leading-relaxed">{t.item.thankBody}</p>
          <div className="flex gap-2 mt-6">
            <button onClick={() => setPhase('ask')} className="btn-outline flex-1">
              {t.common.back}
            </button>
            <button onClick={onRelease} className="btn-primary flex-1">
              {t.item.done}
            </button>
          </div>
        </div>
      )}

      {phase === 'detail' && (
        <div className="mt-5 animate-fade-in">
          <div className="card p-3 bg-white/60 flex items-center gap-2">
            <span className="text-xl">{item.status === 'kept' ? '✦' : '↟'}</span>
            <span className="text-sm">
              {item.status === 'kept' ? t.item.filterKept : t.item.filterReleased}
              {item.status === 'kept' && item.place ? ` · ${item.place}` : ''}
            </span>
          </div>
          <div className="flex gap-2 mt-5">
            <button onClick={onDelete} className="btn-outline flex-1 !border-rose/40 text-rose">
              {t.item.delete}
            </button>
            <button onClick={() => setPhase('ask')} className="btn-primary flex-1">
              {t.item.reconsider}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
