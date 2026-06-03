-- Run this if your project already has the earlier schema.
-- API keys remain backend-only: do not grant user_api_keys to anon/authenticated.

create table if not exists public.automation_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email_reminder_enabled boolean not null default true,
  default_reminder_email text,
  payment_reminder_days smallint not null default 7 check (payment_reminder_days between 0 and 60),
  benefit_reminder_days smallint not null default 14 check (benefit_reminder_days between 0 and 120),
  weekly_digest_enabled boolean not null default true,
  monthly_digest_enabled boolean not null default true,
  ai_provider text not null default 'openai',
  worker_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  key_label text,
  encrypted_key text not null,
  last_four text,
  status text not null default 'active',
  last_tested_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table if not exists public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary_type text not null,
  provider text,
  summary_text text not null,
  summary_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reminder_id uuid references public.reminders(id) on delete set null,
  channel reminder_channel not null,
  recipient text,
  subject text,
  status text not null default 'queued',
  provider_response jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.automation_settings enable row level security;
alter table public.user_api_keys enable row level security;
alter table public.ai_summaries enable row level security;
alter table public.reminder_logs enable row level security;

grant select, insert, update, delete on public.automation_settings, public.ai_summaries to authenticated;
grant select on public.reminder_logs to authenticated;
revoke all on public.user_api_keys from anon, authenticated;
grant select, insert, update, delete on public.user_api_keys to service_role;

drop policy if exists "Users can manage own automation settings" on public.automation_settings;
create policy "Users can manage own automation settings"
on public.automation_settings for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can manage own AI summaries" on public.ai_summaries;
create policy "Users can manage own AI summaries"
on public.ai_summaries for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Users can read own reminder logs" on public.reminder_logs;
create policy "Users can read own reminder logs"
on public.reminder_logs for select
to authenticated
using (user_id = auth.uid());
