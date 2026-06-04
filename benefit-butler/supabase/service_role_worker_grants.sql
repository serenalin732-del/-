-- Run this if Worker statement parsing fails with:
-- permission denied for table uploaded_documents
--
-- These grants are for the backend Cloudflare Worker only.
-- Do not grant user_api_keys to anon/authenticated.

grant usage on schema public to service_role;

grant select, insert, update, delete on public.user_api_keys to service_role;
grant select, insert, update, delete on public.uploaded_documents to service_role;
grant select, insert, update, delete on public.ai_summaries to service_role;
grant select, insert, update, delete on public.reminder_logs to service_role;
grant select, update on public.automation_settings to service_role;
grant select on public.cards to service_role;
grant select on public.profiles to service_role;
