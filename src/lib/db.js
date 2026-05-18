import Dexie from 'dexie'

export const db = new Dexie('FiveColorPlanner')
db.version(1).stores({
  days: 'date',
  templates: 'id',
  settings: 'key'
})

export async function loadDay(date) {
  return (await db.days.get(date)) || null
}

export async function saveDay(day) {
  const next = { ...day, updatedAt: new Date().toISOString() }
  await db.days.put(next)
  return next
}

export async function listDays() {
  return db.days.orderBy('date').reverse().toArray()
}

export async function getTemplate(id = 'default') {
  return db.templates.get(id)
}

export async function saveTemplate(template) {
  await db.templates.put(template)
}

export async function listTemplates() {
  return db.templates.orderBy('id').toArray()
}

export async function deleteTemplate(id) {
  await db.templates.delete(id)
}

export async function getSetting(key) {
  const row = await db.settings.get(key)
  return row?.value
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}
