-- Run this if your cards table already exists and you need the new reminder fields.

alter table public.cards
add column if not exists reminder_channel text not null default 'calendar'
  check (reminder_channel in ('calendar', 'email', 'both')),
add column if not exists reminder_email text;

