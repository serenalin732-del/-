-- Reminder system upgrade:
--   * automation_settings: global default reminder method + a second benefit
--     reminder window (e.g. remind at 15 days AND again at 7 days).
--   * cards: allow reminder_channel = 'inherit' and a NULL reminder_days_before
--     so a card can follow the global defaults instead of storing its own copy.
--     This is what keeps the card edit form in sync with Settings: an inheriting
--     card has no stored timing/method of its own to go stale.
--
-- Safe to run more than once.

-- 1) Global defaults ---------------------------------------------------------
alter table public.automation_settings
  add column if not exists reminder_channel text not null default 'both'
    check (reminder_channel in ('calendar', 'email', 'both')),
  add column if not exists benefit_reminder_days_2 smallint
    check (benefit_reminder_days_2 is null or benefit_reminder_days_2 between 0 and 120);

-- default_reminder_email now also accepts a comma-separated list of recipients
-- (e.g. "me@example.com, spouse@example.com"); no schema change required.

-- 2) Per-card inheritance ----------------------------------------------------
-- Let reminder_days_before be NULL (NULL = inherit global payment_reminder_days).
alter table public.cards
  alter column reminder_days_before drop not null;

-- Allow the 'inherit' sentinel on reminder_channel and make it the new default.
alter table public.cards
  drop constraint if exists cards_reminder_channel_check;
alter table public.cards
  add constraint cards_reminder_channel_check
    check (reminder_channel in ('inherit', 'calendar', 'email', 'both'));
alter table public.cards
  alter column reminder_channel set default 'inherit';
