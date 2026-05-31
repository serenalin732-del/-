// Small shared presentational helpers.

export function Field({ label, children, hint }) {
  return (
    <label className="block mb-3">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-mist/40 mt-1">{hint}</span>}
    </label>
  )
}

export function ProgressBar({ pct, tone = 'teal' }) {
  const color = pct >= 100 ? 'bg-good' : tone === 'gold' ? 'bg-gold' : 'bg-tealLight'
  return (
    <div className="h-2 rounded-full bg-ink/70 overflow-hidden">
      <div className={`h-full ${color} transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

export function money(n) {
  const v = Number(n) || 0
  return v % 1 === 0 ? `$${v}` : `$${v.toFixed(2)}`
}

export function EmptyState({ children, action }) {
  return (
    <div className="card-surface p-6 text-center text-mist/60">
      <p>{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

const TONES = {
  good: 'bg-good/15 text-good',
  warn: 'bg-gold/15 text-gold',
  bad: 'bg-rose/15 text-rose',
  neutral: 'bg-steel/50 text-mist/80'
}
export function Badge({ tone = 'neutral', children }) {
  return <span className={`chip ${TONES[tone] || TONES.neutral}`}>{children}</span>
}
