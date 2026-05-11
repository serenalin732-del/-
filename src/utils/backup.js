// Lightweight JSON export/import for the app state.
// Schema is intentionally loose — we validate shape, not exact fields,
// so future versions can read older backups.

export const BACKUP_VERSION = 1

export function buildBackup(state) {
  return {
    app: 'spark-joy',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    state: {
      lang: state.lang,
      vision: state.vision,
      ritualsDone: state.ritualsDone,
      items: state.items
    }
  }
}

export function downloadBackup(state) {
  const data = buildBackup(state)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `spark-joy-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function parseBackup(text) {
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('not-json')
  }
  const s = parsed?.state || parsed
  if (!s || typeof s !== 'object') throw new Error('bad-shape')
  if (!Array.isArray(s.items)) throw new Error('bad-items')
  // sanitize items
  const items = s.items
    .filter((it) => it && typeof it === 'object' && typeof it.name === 'string')
    .map((it) => ({
      id: String(it.id || cryptoRandomId()),
      category: ['clothes', 'books', 'papers', 'komono', 'sentimental'].includes(it.category)
        ? it.category
        : 'komono',
      name: String(it.name).slice(0, 200),
      note: typeof it.note === 'string' ? it.note.slice(0, 500) : '',
      photo: typeof it.photo === 'string' ? it.photo : '',
      status: ['kept', 'released', 'pending'].includes(it.status) ? it.status : 'pending',
      place: typeof it.place === 'string' ? it.place : '',
      createdAt: Number(it.createdAt) || Date.now(),
      decidedAt: it.decidedAt ? Number(it.decidedAt) : null
    }))
  return {
    lang: ['zh', 'en'].includes(s.lang) ? s.lang : undefined,
    vision:
      s.vision && typeof s.vision === 'object'
        ? {
            ideal: String(s.vision.ideal || ''),
            atmosphere: String(s.vision.atmosphere || ''),
            timeFor: String(s.vision.timeFor || ''),
            images: Array.isArray(s.vision.images) ? s.vision.images.filter((x) => typeof x === 'string') : [],
            updatedAt: s.vision.updatedAt || null
          }
        : undefined,
    ritualsDone:
      s.ritualsDone && typeof s.ritualsDone === 'object'
        ? Object.fromEntries(
            Object.entries(s.ritualsDone).filter(([k, v]) => typeof v === 'boolean' && typeof k === 'string')
          )
        : {},
    items
  }
}

function cryptoRandomId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
