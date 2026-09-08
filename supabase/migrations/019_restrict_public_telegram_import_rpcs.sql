-- Public Telegram ingestion runs only through the server-side Render route using service_role.
-- These RPCs must not be directly callable through the public REST API by end users.
revoke execute on function public.list_public_telegram_sources() from anon, authenticated;
revoke execute on function public.upsert_public_telegram_messages(uuid, jsonb) from anon, authenticated;
revoke execute on function public.store_public_telegram_parsed(uuid, jsonb, text) from anon, authenticated;
