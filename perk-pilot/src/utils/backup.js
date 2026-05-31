// JSON backup / restore. Until cloud sync is connected this is how data moves
// between devices and how it stays safe.

const EXPORT_KEYS = ['lang', 'people', 'cards', 'benefits', 'claims', 'pointsTx', 'settings']

export function serialize(state) {
  const subset = {}
  for (const k of EXPORT_KEYS) subset[k] = state[k]
  return JSON.stringify({ app: 'perkpilot', version: 1, exportedAt: Date.now(), data: subset }, null, 2)
}

export function downloadBackup(state) {
  const blob = new Blob([serialize(state)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `perkpilot-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Parse a backup file's text into a LOAD_STATE payload, or throw. */
export function parseBackup(text) {
  const parsed = JSON.parse(text)
  const data = parsed?.data ?? parsed // tolerate a raw state dump too
  if (!data || typeof data !== 'object') throw new Error('Invalid backup file')
  const payload = {}
  for (const k of EXPORT_KEYS) {
    if (k in data) payload[k] = data[k]
  }
  return payload
}

export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })
}
