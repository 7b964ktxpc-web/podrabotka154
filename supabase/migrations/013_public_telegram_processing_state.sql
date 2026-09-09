-- Public Telegram processing state.
-- Each imported message is parsed at most once per newly inserted message.

alter table public.telegram_messages
  add column if not exists parse_status text not null default 'pending',
  add column if not exists parse_attempts integer not null default 0,
  add column if not exists parsed_at timestamptz,
  add column if not exists parse_error text,
  add column if not exists last_parse_attempt_at timestamptz;

alter table public.telegram_messages
  drop constraint if exists telegram_messages_parse_status_check;

alter table public.telegram_messages
  add constraint telegram_messages_parse_status_check
  check (parse_status in ('pending', 'processing', 'processed', 'error'));

create index if not exists telegram_messages_source_parse_status_idx
  on public.telegram_messages (source_id, parse_status, message_date desc);

create or replace function public.upsert_public_telegram_messages(
  p_source_id uuid,
  p_messages jsonb
)
returns table(id uuid, telegram_message_id bigint, message_text text, message_date timestamptz, message_url text, is_new boolean)
language plpgsql
security definer
set search_path = public
as $function$
begin
  return query
  with incoming as (
    select
      p_source_id as source_id,
      (item->>'telegram_message_id')::bigint as telegram_message_id,
      item->>'message_text' as message_text,
      (item->>'message_date')::timestamptz as message_date,
      item->>'message_url' as message_url,
      coalesce(item->'raw_payload', '{}'::jsonb) as raw_payload
    from jsonb_array_elements(coalesce(p_messages, '[]'::jsonb)) item
  ), inserted as (
    insert into public.telegram_messages
      (source_id, telegram_message_id, message_text, message_date, message_url, raw_payload)
    select source_id, telegram_message_id, message_text, message_date, message_url, raw_payload
    from incoming
    on conflict (source_id, telegram_message_id) do nothing
    returning id, telegram_message_id, message_text, message_date, message_url
  )
  select i.id, i.telegram_message_id, i.message_text, i.message_date, i.message_url, true
  from inserted i;
end;
$function$;

create or replace function public.store_public_telegram_parsed(
  p_message uuid,
  p_result jsonb,
  p_fingerprint text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  m public.telegram_messages;
  s public.telegram_sources;
  result_id uuid;
begin
  select * into m from public.telegram_messages where id = p_message;
  if not found then return null; end if;

  select * into s from public.telegram_sources where id = m.source_id;
  if not found or not s.active or s.adapter <> 'public_web' then
    raise exception 'PUBLIC_SOURCE_REQUIRED';
  end if;

  update public.telegram_messages
  set parse_status = 'processing',
      parse_attempts = parse_attempts + 1,
      last_parse_attempt_at = now(),
      parse_error = null
  where id = p_message;

  result_id := public.store_parsed(p_message, p_result, p_fingerprint);

  update public.telegram_messages
  set parse_status = 'processed',
      parsed_at = now(),
      parse_error = null
  where id = p_message;

  update public.work_queue
  set done_at = coalesce(done_at, now()),
      locked_until = null,
      error = null
  where kind = 'parse'
    and done_at is null
    and payload->>'message_id' = p_message::text;

  return result_id;
exception when others then
  update public.telegram_messages
  set parse_status = 'error',
      parse_error = left(sqlerrm, 1000),
      last_parse_attempt_at = now()
  where id = p_message;
  raise;
end;
$function$;

-- Existing messages have already gone through parser_runs in the legacy importer.
-- Mark them processed so the new state machine does not spend AI tokens on history.
update public.telegram_messages tm
set parse_status = 'processed',
    parsed_at = coalesce(tm.parsed_at, now()),
    parse_error = null
where exists (
  select 1
  from public.parser_runs pr
  where pr.message_id = tm.id
);
