# PerkPilot · 薅卡管家

A mobile-first PWA to manage credit-card perks, never miss a payment due date,
and squeeze every benefit before it expires — plus track reward points and
whether you used the optimal card.

> **Note:** this lives in `perk-pilot/` and is a separate project from the
> unrelated "Spark Joy" app at the repo root.

## Why
High-annual-fee cards (Amex Platinum/Gold, Capital One Venture X, Chase Sapphire
Reserve, co-branded hotel/airline cards…) bundle lots of credits. It's easy to
pay the fee and leave value on the table. PerkPilot tracks, per card and per
person, how much of each perk you've actually used this cycle, warns you before
perks expire and payments are due, and shows a year-end "was this card worth it?"
summary.

## What works today (Phase 1 — local-first PWA)
- **Cards**: add from a starter library (Amex / Capital One / Chase, personal /
  business / co-branded) or build a fully custom card. Nickname + last-4 to tell
  several Amex cards apart. Assign a cardholder (you / family).
- **Benefits**: each card's perks with cadence (monthly/quarterly/semiannual/
  yearly/one-time) and reset basis (calendar vs card anniversary). Library
  templates are **editable starting points** — add/remove/correct freely.
- **Squeeze tracking (not check-in)**: dollar-based partial tracking (e.g. a
  $200 credit fills as you use it) or a simple used/not toggle. Progress bars
  show captured vs available for the current cycle.
- **Auto cycles**: usage is bucketed per period, so a new month/quarter/year
  starts empty automatically and **history is preserved** — no manual reset.
- **Payment reminders**: statement + due day, custom "remind N days before",
  and overdue flagging. Uses the device's real local date.
- **Benefit-expiry reminders**: warns when an unused perk's window is closing.
- **Device notifications**: opt-in browser notifications (best when installed to
  the home screen).
- **Points**: log spend with category/multiplier, attach a receipt photo, and
  get a "best card for this category" hint based on your cards' earning rates.
- **Year summary / archive**: per card, captured vs available, net of annual
  fee, and exactly which perks you left unused — to decide if a card is worth
  keeping.
- **Backup**: export / import all data as JSON.
- Bilingual 中文 / English. Offline-capable PWA.

## Roadmap
- **Phase 2 — AI receipt reading** for points (upload a statement/receipt; auto
  categorize spend and earned points). Needs a Claude API key wired through a
  small serverless endpoint. Manual entry is the current fallback.
- **Phase 3 — Cloud accounts + sync + reliable push** via Supabase (auth,
  Postgres with row-level security, multi-device sync, sharing with family/
  friends, Web Push). See `src/utils/sync.js` for the planned interface and
  schema. To enable: create a Supabase project, set `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`, and implement the documented stubs.

## Honest constraints
- Banks don't expose public APIs for perk usage, so true *fully-automatic*
  tracking isn't possible. PerkPilot is manual + semi-automatic (and Phase 2 AI
  reading reduces the typing).
- A pure web app can't fire notifications while fully closed without a push
  server; that's what Phase 3 adds. Until then, reminders surface when you open
  the app, and you should install it to your home screen.

## Develop
```bash
cd perk-pilot
npm install
npm run dev      # local dev server
npm test         # vitest unit + component tests
npm run build    # production build (also generates the PWA service worker)
```

## Data & accuracy
Card benefit values change frequently. The bundled library is approximate public
info as of `CARD_LIBRARY_AS_OF` in `src/data/cardLibrary.js` and is meant to be
edited. Always confirm against the issuer's official site.
