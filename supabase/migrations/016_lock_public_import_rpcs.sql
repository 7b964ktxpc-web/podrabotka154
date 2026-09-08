-- Public Telegram import is called server-side with the service-role client and a CRON_SECRET.
-- These SECURITY DEFINER RPCs must not be directly callable by anonymous or signed-in API clients.
revoke execute on function public.is_admin() from anon;
revoke execute on function public.list_public_telegram_sources() from anon, authenticated;
revoke execute on function public.store_public_telegram_parsed(uuid, jsonb, text) from anon, authenticated;
revoke execute on function public.upsert_public_telegram_messages(uuid, jsonb) from anon, authenticated;
