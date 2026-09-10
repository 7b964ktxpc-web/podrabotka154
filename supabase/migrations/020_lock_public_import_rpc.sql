begin;

-- The scheduled importer now runs with the server-side service role. These
-- security-definer RPCs must not be callable by public clients because they
-- can insert raw Telegram messages, enqueue parsing work, and create jobs.
revoke execute on function public.list_public_telegram_sources() from public, anon, authenticated;
revoke execute on function public.upsert_public_telegram_messages(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.store_public_telegram_parsed(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.list_public_telegram_sources() to service_role;
grant execute on function public.upsert_public_telegram_messages(uuid, jsonb) to service_role;
grant execute on function public.store_public_telegram_parsed(uuid, jsonb, text) to service_role;

-- Return only rows actually inserted by this import. Keep the return type
-- identical to migration 013 because PostgreSQL cannot change a function's
-- return row type with CREATE OR REPLACE FUNCTION.
create or replace function public.upsert_public_telegram_messages(
  p_source_id uuid,
  p_messages jsonb
)
returns table(id uuid, telegram_message_id bigint, message_text text, message_date timestamptz, message_url text, is_new boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  s telegram_sources;
begin
  select * into s from telegram_sources where telegram_sources.id = p_source_id;
  if not found or not s.active or s.adapter <> 'public_web' then
    raise exception 'PUBLIC_SOURCE_REQUIRED';
  end if;

  return query
  with incoming as (
    select * from jsonb_to_recordset(coalesce(p_messages, '[]'::jsonb)) as x(
      telegram_message_id bigint,
      message_text text,
      message_date timestamptz,
      message_url text,
      raw_payload jsonb
    )
  ), inserted as (
    insert into telegram_messages(source_id, telegram_message_id, message_text, message_date, message_url, raw_payload)
    select s.id, i.telegram_message_id, i.message_text, i.message_date, i.message_url, coalesce(i.raw_payload, '{}'::jsonb)
    from incoming i
    where i.telegram_message_id is not null and i.message_text is not null and i.message_date is not null
    on conflict (source_id, telegram_message_id) do nothing
    returning telegram_messages.id, telegram_messages.telegram_message_id, telegram_messages.message_text,
              telegram_messages.message_date, telegram_messages.message_url
  )
  select i.id, i.telegram_message_id, i.message_text, i.message_date, i.message_url, true
  from inserted i
  order by i.telegram_message_id desc;
end;
$$;

grant execute on function public.upsert_public_telegram_messages(uuid, jsonb) to service_role;

commit;
