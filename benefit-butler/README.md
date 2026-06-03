# Benefit Butler · 薅卡管家

Working copy of the Benefit Butler app (originally generated with Codex) for
ongoing fixes and optimization. The live deployment runs on the user's own
**Cloudflare** (Pages + Worker) and **Supabase** (auth + Postgres + storage) —
those are **not** touched from here; this repo is just the source of truth for
the code so changes are versioned and reviewable.

## Structure
```
benefit-butler/
  index.html              # Pages site (frontend shell, all views)
  app.js                  # Frontend logic (~4k lines): data model, rendering,
                          #   Supabase client, AI calls, wallet optimizer, etc.
  styles.css              # Styling (incl. mobile breakpoints @980/@620)
  sw.js                   # Service worker (network-first, offline fallback)
  supabase-config.js      # Public Supabase URL + anon key (to be added)
  manifest.webmanifest    # PWA manifest (to be added)
  _redirects              # Cloudflare Pages redirects (to be added)
  icons/                  # App icons (to be added)
  cloudflare-worker/
    worker.js             # Cloudflare Worker backend (AI, statement parsing,
                          #   API-key storage, email reminders via cron)
  supabase/               # SQL schema + patches + seed (to be added)
```

## Secrets (NEVER commit these — they live in Cloudflare Worker env vars)
`SUPABASE_SERVICE_ROLE_KEY`, `KEY_ENCRYPTION_SECRET`, `RESEND_API_KEY`,
`FROM_EMAIL`, and the user's AI provider key. The Supabase **anon** key + URL in
`supabase-config.js` are public by design and safe to include.

## Deploy
No build step (vanilla HTML/CSS/JS). The Pages site is the files at this folder
root; the Worker is deployed separately (no Wrangler — pasted into the Cloudflare
dashboard). After edits, copy the changed files back to the corresponding
Cloudflare project.

## In-progress optimization (planned)
- **AI provider generalization**: bring-your-own provider (OpenAI / Anthropic /
  Gemini / custom), free-text model, task-based model routing + cost guardrails.
- **Welcome / one-time bonus filtering**: tag AI-fetched items by type; keep
  one-time welcome offers out of recurring benefit tracking; review-before-save.
- **Reference cache layer**: cache-aside on top of live AI (instant display +
  offline/failure fallback + a "refresh from official site" action).
