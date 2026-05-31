-- PerkPilot cloud sync schema (Phase 3)
--
-- Model: each user owns one app_state row (a JSONB blob of their local state).
-- Optionally a user belongs to a "household" so family/friends can share the
-- same data. Row-Level Security ensures a user can only read/write their own
-- row or rows belonging to a household they are a member of.
--
-- Conflict strategy for v1: last-write-wins on updated_at. Field-level merge can
-- come later if needed.

-- Households -------------------------------------------------------------
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My household',
  owner uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists household_members (
  household uuid not null references households (id) on delete cascade,
  member uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member', -- 'owner' | 'member'
  created_at timestamptz not null default now(),
  primary key (household, member)
);

-- App state --------------------------------------------------------------
create table if not exists app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  household uuid references households (id) on delete set null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Helper: is the current user a member of a household?
create or replace function is_household_member(h uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from household_members
    where household = h and member = auth.uid()
  );
$$;

-- RLS --------------------------------------------------------------------
alter table households enable row level security;
alter table household_members enable row level security;
alter table app_state enable row level security;

-- households: members can read; owner can manage
create policy households_select on households
  for select using (owner = auth.uid() or is_household_member(id));
create policy households_insert on households
  for insert with check (owner = auth.uid());
create policy households_update on households
  for update using (owner = auth.uid());
create policy households_delete on households
  for delete using (owner = auth.uid());

-- household_members: a member can see their household's membership; owner manages
create policy members_select on household_members
  for select using (member = auth.uid() or is_household_member(household));
create policy members_insert on household_members
  for insert with check (
    member = auth.uid()
    or exists (select 1 from households h where h.id = household and h.owner = auth.uid())
  );
create policy members_delete on household_members
  for delete using (
    member = auth.uid()
    or exists (select 1 from households h where h.id = household and h.owner = auth.uid())
  );

-- app_state: own row, or any row in a household you belong to
create policy app_state_select on app_state
  for select using (user_id = auth.uid() or (household is not null and is_household_member(household)));
create policy app_state_upsert_insert on app_state
  for insert with check (user_id = auth.uid());
create policy app_state_update on app_state
  for update using (user_id = auth.uid() or (household is not null and is_household_member(household)));

-- Keep updated_at fresh on write.
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_state_touch on app_state;
create trigger app_state_touch before update on app_state
  for each row execute function touch_updated_at();
