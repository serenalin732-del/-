// Cloud account + sync (Phase 3) via Supabase.
//
// The app is a static PWA, so cloud accounts/sync are added through Supabase
// (no server for us to run): email magic-link auth, a Postgres `app_state`
// JSONB row per user, optional household sharing, and Row-Level Security.
//
// To enable:
//   1. Create a Supabase project and run supabase/migrations/0001_init.sql.
//   2. `npm i @supabase/supabase-js`
//   3. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (see .env.example).
//
// Until configured, every function degrades gracefully to a clear
// "not_configured" result so the app stays fully usable in local-only mode.
// The Supabase SDK is imported lazily (and only when configured) so builds
// without the dependency installed still succeed.

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}
const URL = env.VITE_SUPABASE_URL
const ANON = env.VITE_SUPABASE_ANON_KEY
// Loaded from a CDN at runtime only when configured, so the default static
// build needs no extra dependency. Override the version/source via env if you'd
// rather bundle it yourself. The variable (not a string literal) keeps the
// bundler from trying to resolve it at build time.
const SUPABASE_ESM = env.VITE_SUPABASE_ESM || 'https://esm.sh/@supabase/supabase-js@2'

export function isConfigured() {
  return Boolean(URL && ANON)
}

let _clientPromise = null
async function getClient() {
  if (!isConfigured()) return null
  if (!_clientPromise) {
    _clientPromise = import(/* @vite-ignore */ SUPABASE_ESM).then(({ createClient }) =>
      createClient(URL, ANON, { auth: { persistSession: true, autoRefreshToken: true } })
    )
  }
  return _clientPromise
}

export async function getSession() {
  const c = await getClient()
  if (!c) return null
  const { data } = await c.auth.getSession()
  return data?.session || null
}

export function syncStatus() {
  return { configured: isConfigured(), provider: isConfigured() ? 'supabase' : null }
}

/** Send a magic-link sign-in email. */
export async function signIn(email) {
  const c = await getClient()
  if (!c) return { ok: false, reason: 'not_configured' }
  const { error } = await c.auth.signInWithOtp({ email })
  return error ? { ok: false, reason: error.message } : { ok: true }
}

export async function signOut() {
  const c = await getClient()
  if (!c) return { ok: false, reason: 'not_configured' }
  await c.auth.signOut()
  return { ok: true }
}

const SYNC_KEYS = ['lang', 'people', 'cards', 'benefits', 'claims', 'pointsTx', 'settings']
function pick(state) {
  const out = {}
  for (const k of SYNC_KEYS) out[k] = state[k]
  return out
}

/** Push local state to the cloud (upsert the user's app_state row). */
export async function pushState(state) {
  const c = await getClient()
  if (!c) return { ok: false, reason: 'not_configured' }
  const session = await getSession()
  if (!session) return { ok: false, reason: 'not_signed_in' }
  const { error } = await c
    .from('app_state')
    .upsert({ user_id: session.user.id, data: pick(state), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  return error ? { ok: false, reason: error.message } : { ok: true }
}

/**
 * Pull the freshest state visible to the user (their own row or the newest in
 * their household). Returns { ok, data, updatedAt } where data is a LOAD_STATE
 * payload, or a not_* reason.
 */
export async function pullState() {
  const c = await getClient()
  if (!c) return { ok: false, reason: 'not_configured' }
  const session = await getSession()
  if (!session) return { ok: false, reason: 'not_signed_in' }
  const { data, error } = await c
    .from('app_state')
    .select('data, updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
  if (error) return { ok: false, reason: error.message }
  const row = data?.[0]
  return { ok: true, data: row?.data || null, updatedAt: row?.updated_at || null }
}
