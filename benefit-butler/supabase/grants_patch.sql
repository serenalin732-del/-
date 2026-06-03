-- Run this if you disabled "Automatically expose new tables" when creating
-- the Supabase project, or if the app can log in but cannot read/write tables.

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
  public.uploaded_documents
to authenticated;

grant select on public.card_templates to authenticated;

