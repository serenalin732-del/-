-- Block B: bring-your-own AI provider.
-- automation_settings already has ai_provider + worker_url. These two columns
-- let the user's chosen model name and (for a custom / OpenAI-compatible
-- endpoint) base URL sync across devices. The Worker also accepts these per
-- request, so running this patch is optional but recommended.

alter table public.automation_settings
  add column if not exists ai_model text,
  add column if not exists ai_base_url text;
