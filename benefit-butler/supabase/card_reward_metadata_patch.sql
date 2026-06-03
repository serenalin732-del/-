-- Adds card-level official reward metadata so AI-fetched rules survive refresh
-- and can sync across devices.

alter table public.cards
  add column if not exists reward_rules jsonb,
  add column if not exists source_urls jsonb not null default '[]'::jsonb,
  add column if not exists official_name text,
  add column if not exists source_updated_at timestamptz;
