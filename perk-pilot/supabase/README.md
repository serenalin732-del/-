# Cloud sync setup (Phase 3 — Supabase)

PerkPilot runs fully local-first. These steps add **accounts, multi-device sync,
and family/friend sharing** via Supabase. Until configured, the app ignores all
of this and stays local-only.

## 1. Create a project
1. Sign up at https://supabase.com and create a new project.
2. In the SQL editor, run [`migrations/0001_init.sql`](./migrations/0001_init.sql).
   (Or use the Supabase CLI: `supabase db push`.)

## 2. Configure the app
1. In the project's **Settings → API**, copy the **Project URL** and **anon key**.
2. In `perk-pilot/`, create `.env.local` (see `.env.example`):
   ```
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
   ```
3. Install the SDK:
   ```
   npm i @supabase/supabase-js
   ```
4. Rebuild/redeploy.

## 3. Auth
Email magic-link sign-in is wired in `src/utils/sync.js` (`signIn(email)`).
Enable the **Email** provider in Supabase **Authentication → Providers**, and add
your deployed URL to **Authentication → URL Configuration** (redirect allow-list).

## How sync works
- Each signed-in user has one row in `app_state` holding their state as JSONB.
- `pushState(state)` upserts the row; `pullState()` reads the freshest row the
  user can see (their own, or the newest in their household).
- **Conflict policy (v1): last-write-wins** on `updated_at`.

## Sharing with family / friends
The schema includes `households` + `household_members`. To share a dataset,
add members to a household and point their `app_state.household` at it; RLS then
lets all members read/write the shared state. A household-management UI is not
built yet — create rows via the Supabase dashboard for now, or ask to have the
UI added.

## Reliable push notifications (optional, later)
With Supabase in place you can add Web Push (VAPID) and a scheduled Edge Function
that fires payment/benefit/expiry reminders even when the app is closed —
removing the "only when you open the app" limitation of the local-only build.
