// PWA local notifications.
//
// Honest scope: a pure web app cannot reliably fire notifications while it is
// fully closed without a push server (that's the Phase-3 cloud option). What we
// CAN do well: ask permission, and whenever the app is opened/foregrounded,
// surface anything that is due/expiring and hasn't been shown today. Installing
// to the home screen makes this far more useful. iOS requires 16.4+ and the app
// added to the Home Screen.

const SHOWN_KEY = 'perkpilot.notif.shown'

export function isSupported() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getPermission() {
  return isSupported() ? Notification.permission : 'unsupported'
}

export async function requestPermission() {
  if (!isSupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10)
}

function loadShown() {
  try {
    return JSON.parse(localStorage.getItem(SHOWN_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveShown(map) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

export function notify(title, body, tag) {
  if (!isSupported() || Notification.permission !== 'granted') return false
  try {
    new Notification(title, { body, tag, icon: '/icon-192.svg', badge: '/icon-192.svg' })
    return true
  } catch {
    return false
  }
}

/**
 * Given the already-computed active reminders, show a notification for each one
 * not yet shown today. Returns the number of notifications fired. Dedupe key is
 * `${reminder.id}:${YYYY-MM-DD}` so each reminder fires at most once per day.
 */
export function surfaceReminders(reminders, render) {
  if (!isSupported() || Notification.permission !== 'granted') return 0
  const stamp = todayStamp()
  const shown = loadShown()
  let fired = 0
  for (const r of reminders) {
    const key = `${r.id}:${stamp}`
    if (shown[key]) continue
    const { title, body } = render(r)
    if (notify(title, body, r.id)) {
      shown[key] = true
      fired++
    }
  }
  // Garbage-collect entries from previous days.
  for (const k of Object.keys(shown)) {
    if (!k.endsWith(stamp)) delete shown[k]
  }
  saveShown(shown)
  return fired
}
