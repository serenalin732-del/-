import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card-surface w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-b-none sm:rounded-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {title && (
          <div className="sticky top-0 bg-slate/95 backdrop-blur px-5 py-4 border-b border-steel/60 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-mist">{title}</h2>
            <button onClick={onClose} className="text-mist/50 hover:text-mist text-xl leading-none px-2">
              ×
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="sticky bottom-0 bg-slate/95 backdrop-blur px-5 py-3 border-t border-steel/60 flex gap-2 justify-end pb-safe">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
