// Cloud account + sync scaffold (Phase 3).
//
// The app is a static PWA, so cloud accounts/sync are best added via a
// Backend-as-a-Service (no server for us to run). Supabase is the planned
// provider: it gives email/social auth, a Postgres database with Row-Level
// Security (so each user/household only sees their own data), realtime sync,
// and Web Push for reliable reminders.
//
// To enable later:
//   1. Create a Supabase project, run the schema below.
//   2. `npm i @supabase/supabase-js`
//   3. Provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (e.g. in .env.local).
//   4. Implement init/signIn/push/pull against the documented interface.
//
// Suggested schema (one row per entity, owned by auth.uid(), optionally shared
// with a household for family/friend sharing):
//
//   create table households (id uuid primary key default gen_random_uuid(),
//                            name text, owner uuid references auth.users);
//   create table household_members (household uuid references households,
//                            member uuid references auth.users,
//                            primary key (household, member));
//   create table app_state (user_id uuid primary key references auth.users,
//                           household uuid references households,
//                           data jsonb not null, updated_at timestamptz default now());
//   -- RLS: a user can read/write app_state rows they own OR that belong to a
//   -- household they are a member of. Conflict resolution: last-write-wins on
//   -- updated_at for v1; field-level merge can come later.

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {}

export function isConfigured() {
  return Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY)
}

export function syncStatus() {
  return {
    configured: isConfigured(),
    provider: isConfigured() ? 'supabase' : null,
    signedIn: false
  }
}

// Stubs kept intentionally inert until a provider is wired in. They resolve
// to a clear "not configured" result rather than throwing, so the UI can
// degrade gracefully to local-only mode.
export async function signIn() {
  return { ok: false, reason: 'not_configured' }
}
export async function pushState() {
  return { ok: false, reason: 'not_configured' }
}
export async function pullState() {
  return { ok: false, reason: 'not_configured' }
}
