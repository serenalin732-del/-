import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext.jsx'

export default function Vision({ navigate }) {
  const { t, state, dispatch } = useApp()
  const [form, setForm] = useState({
    ideal: state.vision.ideal || '',
    atmosphere: state.vision.atmosphere || '',
    timeFor: state.vision.timeFor || '',
    images: state.vision.images || []
  })
  const [savedFlash, setSavedFlash] = useState(false)
  const [imgInput, setImgInput] = useState('')

  useEffect(() => {
    if (!savedFlash) return
    const id = setTimeout(() => setSavedFlash(false), 1600)
    return () => clearTimeout(id)
  }, [savedFlash])

  const save = () => {
    dispatch({ type: 'SAVE_VISION', vision: form })
    setSavedFlash(true)
  }

  const addImage = () => {
    const trimmed = imgInput.trim()
    if (!trimmed) return
    setForm((f) => ({ ...f, images: [...f.images, trimmed] }))
    setImgInput('')
  }

  const removeImage = (idx) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== idx) }))
  }

  return (
    <div className="space-y-5">
      <header>
        <button onClick={() => navigate('home')} className="chip mb-3">← {t.common.back}</button>
        <h1 className="font-serif text-2xl">{t.vision.title}</h1>
        <p className="text-sm text-ink/65 mt-1">{t.vision.subtitle}</p>
      </header>

      <Field
        label={t.vision.prompt1}
        value={form.ideal}
        onChange={(v) => setForm({ ...form, ideal: v })}
        placeholder={t.vision.prompt1Ph}
        multiline
      />

      <Field
        label={t.vision.prompt2}
        value={form.atmosphere}
        onChange={(v) => setForm({ ...form, atmosphere: v })}
        placeholder={t.vision.prompt2Ph}
      />

      <Field
        label={t.vision.prompt3}
        value={form.timeFor}
        onChange={(v) => setForm({ ...form, timeFor: v })}
        placeholder={t.vision.prompt3Ph}
        multiline
      />

      <div>
        <label className="text-sm font-medium text-ink/80">{t.vision.moodImages}</label>
        <div className="flex gap-2 mt-2">
          <input
            value={imgInput}
            onChange={(e) => setImgInput(e.target.value)}
            placeholder="https://…"
            className="flex-1 rounded-xl border border-ink/10 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:border-rose"
          />
          <button onClick={addImage} className="btn-ghost text-sm whitespace-nowrap">
            + {t.vision.addImage}
          </button>
        </div>
        {form.images.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            {form.images.map((src, i) => (
              <button
                key={i}
                onClick={() => removeImage(i)}
                className="aspect-square rounded-xl overflow-hidden bg-mist relative group"
                title="remove"
              >
                <img src={src} alt="" className="w-full h-full object-cover" onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}/>
                <span className="absolute inset-0 flex items-center justify-center bg-ink/0 group-hover:bg-ink/40 text-cream opacity-0 group-hover:opacity-100 transition text-xs">
                  ✕
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card p-4 bg-blush/30 border-blush/30">
        <p className="text-sm text-ink/75 leading-relaxed">💭 {t.vision.tip}</p>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={save} className="btn-primary flex-1">
          {savedFlash ? t.vision.saved : t.vision.save}
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, multiline }) {
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <div>
      <label className="text-sm font-medium text-ink/80">{label}</label>
      <Tag
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        className="mt-2 w-full rounded-xl border border-ink/10 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:border-rose resize-none"
      />
    </div>
  )
}
