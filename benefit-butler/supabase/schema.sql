-- Credit Card Butler Supabase baseline schema
-- Run this in the Supabase SQL editor after reviewing project names and bucket names.

create extension if not exists "pgcrypto";

create type card_account_type as enum ('personal', 'business', 'authorized_user', 'family_shared');
create type benefit_cycle as enum ('monthly', 'quarterly', 'semiannual', 'calendar_year', 'anniversary_year', 'custom');
create type benefit_tracking_mode as enum ('auto', 'review', 'manual');
create type reminder_channel as enum ('push', 'email', 'sms', 'calendar');
create type document_status as enum ('uploaded', 'processing', 'parsed', 'confirmed', 'deleted');
create type family_role as enum ('owner', 'admin', 'member', 'viewer');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/New_York',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role family_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  issuer text not null,
  card_name text not null,
  nickname text,
  last4 text check (last4 is null or last4 ~ '^[0-9]{4}$'),
  holder_name text,
  account_type card_account_type not null default 'personal',
  annual_fee numeric(10,2) not null default 0,
  statement_day smallint check (statement_day between 1 and 31),
  due_day smallint check (due_day between 1 and 31),
  reminder_days_before smallint not null default 7 check (reminder_days_before between 0 and 60),
  reminder_channel text not null default 'calendar' check (reminder_channel in ('calendar', 'email', 'both')),
  reminder_email text,
  anniversary_date date,
  autopay_enabled boolean not null default false,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.benefits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid not null references public.cards(id) on delete cascade,
  name text not null,
  total_value numeric(10,2) not null default 0,
  used_value numeric(10,2) not null default 0,
  cycle benefit_cycle not null default 'calendar_year',
  cycle_start date,
  cycle_end date,
  requires_activation boolean not null default false,
  tracking_mode benefit_tracking_mode not null default 'review',
  merchant_matchers text[] not null default '{}',
  category_matchers text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (used_value >= 0 and total_value >= 0 and used_value <= total_value)
);

create table public.benefit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  benefit_id uuid not null references public.benefits(id) on delete cascade,
  transaction_id uuid,
  event_date date not null default current_date,
  amount numeric(10,2) not null default 0,
  source text not null default 'manual',
  confidence numeric(5,4) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  user_confirmed boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table public.reward_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  program text not null,
  points numeric(14,2) not null default 0,
  merchant text,
  category text,
  purchase_amount numeric(10,2),
  multiplier numeric(6,2) not null default 1,
  earned_at date not null default current_date,
  source_document_id uuid,
  optimization_status text,
  notes text,
  created_at timestamptz not null default now()
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid references public.cards(id) on delete cascade,
  benefit_id uuid references public.benefits(id) on delete cascade,
  title text not null,
  remind_on date not null,
  channel reminder_channel not null default 'push',
  sent_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  check (card_id is not null or benefit_id is not null)
);

create table public.yearly_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  snapshot_year integer not null,
  annual_fee numeric(10,2) not null default 0,
  used_value numeric(10,2) not null default 0,
  remaining_value numeric(10,2) not null default 0,
  snapshot_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.uploaded_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id uuid references public.cards(id) on delete set null,
  bucket_id text not null default 'private-documents',
  object_path text not null,
  original_filename text,
  mime_type text,
  byte_size bigint,
  status document_status not null default 'uploaded',
  extracted_data jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null default (now() + interval '30 days'),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

create table public.card_templates (
  id uuid primary key default gen_random_uuid(),
  issuer text not null,
  card_name text not null,
  annual_fee numeric(10,2) not null default 0,
  official_url text,
  last_reviewed_at timestamptz,
  template_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  provider_item_id text,
  encrypted_access_token text,
  status text not null default 'active',
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.automation_settings (
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

create table public.user_api_keys (
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

create table public.ai_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary_type text not null,
  provider text,
  summary_text text not null,
  summary_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.reminder_logs (
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

-- Do not expose Plaid/MX/etc tokens to clients. This table should only be used
-- by backend functions with a service role key, never from browser code.
revoke all on public.bank_connections from anon, authenticated;
revoke all on public.user_api_keys from anon, authenticated;

create index cards_user_id_idx on public.cards(user_id);
create index benefits_user_id_idx on public.benefits(user_id);
create index benefits_card_id_idx on public.benefits(card_id);
create index reward_entries_user_id_idx on public.reward_entries(user_id);
create index reminders_user_id_remind_on_idx on public.reminders(user_id, remind_on);
create index yearly_snapshots_user_id_year_idx on public.yearly_snapshots(user_id, snapshot_year);
create index uploaded_documents_user_id_idx on public.uploaded_documents(user_id);
create index uploaded_documents_expires_at_idx on public.uploaded_documents(expires_at) where deleted_at is null;
create index ai_summaries_user_id_idx on public.ai_summaries(user_id);
create index reminder_logs_user_id_idx on public.reminder_logs(user_id);

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.families,
  public.family_members,
  public.cards,
  public.benefits,
  public.benefit_events,
  public.reward_entries,
  public.reminders,
  public.yearly_snapshots,
  public.uploaded_documents,
  public.automation_settings,
  public.ai_summaries,
  public.reminder_logs
to authenticated;

grant select on public.card_templates to authenticated;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.cards enable row level security;
alter table public.benefits enable row level security;
alter table public.benefit_events enable row level security;
alter table public.reward_entries enable row level security;
alter table public.reminders enable row level security;
alter table public.yearly_snapshots enable row level security;
alter table public.uploaded_documents enable row level security;
alter table public.card_templates enable row level security;
alter table public.bank_connections enable row level security;
alter table public.automation_settings enable row level security;
alter table public.user_api_keys enable row level security;
alter table public.ai_summaries enable row level security;
alter table public.reminder_logs enable row level security;

create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = target_family_id
      and fm.user_id = auth.uid()
  );
$$;

create or replace function public.owns_card(target_card_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cards c
    where c.id = target_card_id
      and c.user_id = auth.uid()
  );
$$;

create policy "Profiles are self-readable"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "Profiles are self-updatable"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can create own profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

create policy "Users can read owned or joined families"
on public.families for select
to authenticated
using (owner_id = auth.uid() or public.is_family_member(id));

create policy "Users can create owned families"
on public.families for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Owners can update families"
on public.families for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Members can read family membership"
on public.family_members for select
to authenticated
using (user_id = auth.uid() or public.is_family_member(family_id));

create policy "Family owners can manage members"
on public.family_members for all
to authenticated
using (
  exists (
    select 1 from public.families f
    where f.id = family_id and f.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.families f
    where f.id = family_id and f.owner_id = auth.uid()
  )
);

create policy "Users can manage own cards"
on public.cards for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Family members can read shared cards"
on public.cards for select
to authenticated
using (family_id is not null and public.is_family_member(family_id));

create policy "Users can manage own benefits"
on public.benefits for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and public.owns_card(card_id));

create policy "Users can manage own benefit events"
on public.benefit_events for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own reward entries"
on public.reward_entries for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own reminders"
on public.reminders for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own yearly snapshots"
on public.yearly_snapshots for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own automation settings"
on public.automation_settings for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can manage own AI summaries"
on public.ai_summaries for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can read own reminder logs"
on public.reminder_logs for select
to authenticated
using (user_id = auth.uid());

create policy "Users can manage own uploaded document records"
on public.uploaded_documents for all
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and bucket_id = 'private-documents'
  and object_path like ('users/' || auth.uid()::text || '/%')
);

create policy "Authenticated users can read card templates"
on public.card_templates for select
to authenticated
using (true);

-- Storage setup. Create this bucket in the Supabase dashboard:
-- name: private-documents
-- public: false
--
-- These policies assume object paths like:
-- users/{auth.uid()}/statements/{document_id}.pdf
-- users/{auth.uid()}/screenshots/{document_id}.jpg

create policy "Users can upload own private documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Users can read own private documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

create policy "Users can delete own private documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'private-documents'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

-- Optional helper view for yearly card value. security_invoker keeps it aligned
-- with the caller's RLS permissions instead of bypassing them as the view owner.
create view public.card_value_summary
with (security_invoker = true) as
select
  c.id as card_id,
  c.user_id,
  c.issuer,
  c.card_name,
  c.nickname,
  c.last4,
  c.annual_fee,
  coalesce(sum(b.total_value), 0) as tracked_benefit_value,
  coalesce(sum(b.used_value), 0) as used_benefit_value,
  coalesce(sum(b.total_value - b.used_value), 0) as remaining_benefit_value,
  coalesce(sum(b.used_value), 0) - c.annual_fee as net_tracked_value
from public.cards c
left join public.benefits b on b.card_id = c.id
group by c.id;
