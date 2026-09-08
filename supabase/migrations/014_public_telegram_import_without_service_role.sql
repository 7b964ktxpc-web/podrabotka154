create or replace function public.list_public_telegram_sources()
returns table(id uuid, username text)
language sql
security definer
set search_path = public
as $$
  select id, username
  from telegram_sources
  where active = true and adapter = 'public_web';
$$;

create or replace function public.upsert_public_telegram_messages(
  p_source_id uuid,
  p_messages jsonb
)
returns table(id uuid, telegram_message_id bigint, message_text text, message_date timestamptz, message_url text, raw_payload jsonb, is_new boolean)
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

  with incoming as (
    select * from jsonb_to_recordset(coalesce(p_messages, '[]'::jsonb)) as x(
      telegram_message_id bigint,
      message_text text,
      message_date timestamptz,
      message_url text,
      raw_payload jsonb
    )
  )
  insert into telegram_messages(source_id, telegram_message_id, message_text, message_date, message_url, raw_payload)
  select s.id, telegram_message_id, message_text, message_date, message_url, coalesce(raw_payload, '{}'::jsonb)
  from incoming
  where telegram_message_id is not null and message_text is not null and message_date is not null
  on conflict (source_id, telegram_message_id) do nothing;

  return query
  with incoming as (
    select * from jsonb_to_recordset(coalesce(p_messages, '[]'::jsonb)) as x(
      telegram_message_id bigint
    )
  )
  select m.id, m.telegram_message_id, m.message_text, m.message_date, m.message_url, m.raw_payload,
         false
  from telegram_messages m
  join incoming i on i.telegram_message_id = m.telegram_message_id
  where m.source_id = s.id
  order by m.telegram_message_id desc;
end;
$$;

create or replace function public.store_public_telegram_parsed(
  p_message uuid,
  p_result jsonb,
  p_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  m telegram_messages;
  s telegram_sources;
  result_id uuid;
begin
  select * into m from telegram_messages where id = p_message;
  if not found then return null; end if;
  select * into s from telegram_sources where id = m.source_id;
  if not found or not s.active or s.adapter <> 'public_web' then
    raise exception 'PUBLIC_SOURCE_REQUIRED';
  end if;

  result_id := public.store_parsed(p_message, p_result, p_fingerprint);

  update work_queue
  set done_at = coalesce(done_at, now()), locked_until = null, error = null
  where kind = 'parse'
    and done_at is null
    and payload->>'message_id' = p_message::text;

  return result_id;
end;
$$;

grant execute on function public.list_public_telegram_sources() to anon, authenticated;
grant execute on function public.upsert_public_telegram_messages(uuid, jsonb) to anon, authenticated;
grant execute on function public.store_public_telegram_parsed(uuid, jsonb, text) to anon, authenticated;
