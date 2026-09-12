-- upsert_public_telegram_messages failed with SQLSTATE 42702:
-- column reference "telegram_message_id" is ambiguous. The returns-clause
-- OUT parameters shadow unqualified column references inside plpgsql, so both
-- INSERT ... SELECT columns and the ON CONFLICT target were ambiguous
-- (a conflict target cannot be qualified). All references are qualified and
-- the targetless ON CONFLICT DO NOTHING form is used instead.

create or replace function public.upsert_public_telegram_messages(
  p_source_id uuid,
  p_messages jsonb
)
returns table(id uuid, telegram_message_id bigint, message_text text, message_date timestamptz, message_url text, raw_payload jsonb, is_new boolean)
language plpgsql
security definer
set search_path = public
as $function$
declare
  s public.telegram_sources;
begin
  select * into s
  from public.telegram_sources
  where public.telegram_sources.id = p_source_id;
  if not found or not s.active or s.adapter <> 'public_web' then
    raise exception 'PUBLIC_SOURCE_REQUIRED';
  end if;

  return query
  with incoming as (
    select
      (item->>'telegram_message_id')::bigint as telegram_message_id,
      item->>'message_text' as message_text,
      (item->>'message_date')::timestamptz as message_date,
      item->>'message_url' as message_url,
      coalesce(item->'raw_payload', '{}'::jsonb) as raw_payload
    from jsonb_array_elements(coalesce(p_messages, '[]'::jsonb)) item
    where (item->>'telegram_message_id') ~ '^[0-9]+$'
      and item->>'message_text' is not null
      and btrim(item->>'message_text') <> ''
      and item->>'message_date' is not null
  ), inserted as (
    insert into public.telegram_messages
      (source_id, telegram_message_id, message_text, message_date, message_url, raw_payload)
    select
      s.id,
      incoming.telegram_message_id,
      incoming.message_text,
      incoming.message_date,
      incoming.message_url,
      incoming.raw_payload
    from incoming
    on conflict do nothing
    returning public.telegram_messages.id,
              public.telegram_messages.telegram_message_id,
              public.telegram_messages.message_text,
              public.telegram_messages.message_date,
              public.telegram_messages.message_url,
              public.telegram_messages.raw_payload
  )
  select
    inserted.id,
    inserted.telegram_message_id,
    inserted.message_text,
    inserted.message_date,
    inserted.message_url,
    inserted.raw_payload,
    true as is_new
  from inserted;

  if not found then
    -- Nothing was inserted (all incoming messages already exist). Report the
    -- acknowledged messages anyway so callers can see the fetch result.
    return query
    with incoming as (
      select (item->>'telegram_message_id')::bigint as telegram_message_id
      from jsonb_array_elements(coalesce(p_messages, '[]'::jsonb)) item
      where (item->>'telegram_message_id') ~ '^[0-9]+$'
    )
    select
      m.id,
      m.telegram_message_id,
      m.message_text,
      m.message_date,
      m.message_url,
      m.raw_payload,
      false as is_new
    from public.telegram_messages m
    join incoming on incoming.telegram_message_id = m.telegram_message_id
    where m.source_id = s.id
    order by m.telegram_message_id desc;
  end if;
end;
$function$;