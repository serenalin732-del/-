-- Run this if Worker API key saving fails with:
-- permission denied for table user_api_keys

grant usage on schema public to service_role;
grant select, insert, update, delete on public.user_api_keys to service_role;

