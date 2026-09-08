-- EXECUTE is granted to PUBLIC by default for SQL functions in PostgreSQL.
-- Revoke it from PUBLIC so the importer RPCs are callable only through the service-role client.
revoke execute on function public.list_public_telegram_sources() from public;
revoke execute on function public.store_public_telegram_parsed(uuid, jsonb, text) from public;
revoke execute on function public.upsert_public_telegram_messages(uuid, jsonb) from public;
