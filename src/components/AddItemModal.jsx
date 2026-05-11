import { useState } from 'react'
import Modal from './Modal.jsx'

export default function AddItemModal({ onCancel, onSave, t }) {
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [photo, setPhoto] = useState('')

  const handlePhoto = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPhoto(reader.result)
    reader.readAsDataURL(file)
  }

  const canSave = name.trim().length > 0

  return (
    <Modal onClose={onCancel}>
      <h3 className="font-serif text-xl">{t.item.addTitle}</h3>

      <div className="mt-4 space-y-3">
        <div>
          <label className="text-xs text-ink/60">{t.item.name}</label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t.item.namePh}
            className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm focus:outline-none focus:border-rose"
          />
        </div>

        <div>
          <label className="text-xs text-ink/60">{t.item.note}</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder={t.item.notePh}
            className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm focus:outline-none focus:border-rose resize-none"
          />
        </div>

        <div>
          <label className="text-xs text-ink/60">{t.item.photo}</label>
          {photo ? (
            <div className="mt-1 relative">
              <img src={photo} alt="" className="w-full h-40 object-cover rounded-xl" />
              <button
                onClick={() => setPhoto('')}
                className="absolute top-2 right-2 chip !bg-ink/70 !text-cream"
              >
                ✕ {t.item.removePhoto}
              </button>
            </div>
          ) : (
            <label className="btn-ghost mt-1 cursor-pointer w-full">
              📷 {t.item.pickPhoto}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhoto}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-6">
        <button onClick={onCancel} className="btn-outline flex-1">
          {t.item.cancel}
        </button>
        <button
          onClick={() => canSave && onSave({ name, note, photo })}
          disabled={!canSave}
          className="btn-primary flex-1"
        >
          {t.item.saveAndDecide}
        </button>
      </div>
    </Modal>
  )
}
