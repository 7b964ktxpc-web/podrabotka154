-- Classify imported Telegram job addresses without inventing coordinates.
-- Exact means a street-style address with a house number is present.
-- Approximate means some location text exists but no house number is present.
-- Unknown means no usable location text exists.

create or replace function public.classify_job_location_precision(p_address text)
returns text
language sql
immutable
as $function$
  select case
    when nullif(trim(p_address), '') is null then 'unknown'
    when trim(p_address) ~* '(^|[[:space:],])(?:ул\.?|улица|просп\.?|проспект|пер\.?|переулок|бул\.?|бульвар|ш\.?|шоссе|наб\.?|набережная|пл\.?|площадь|проезд|тракт|аллея|линия|микрорайон|мкр\.?)[^,;]*[[:space:]]+[0-9]{1,4}[[:alnum:]А-Яа-яЁё/-]*([[:space:]]?(?:к|корп|корпус|стр|строение)[.[:space:]-]*[0-9А-Яа-яЁё/-]+)?([[:space:]]?(?:д|дом)[.[:space:]-]*[0-9А-Яа-яЁё/-]+)?([[:space:]]?(?:кв|квартира|офис|оф)[.[:space:]-]*[0-9А-Яа-яЁё/-]+)?') then 'exact'
    else 'approximate'
  end;
$function$;

-- Reclassify existing jobs from their stored address text.
update public.jobs
set location_precision = public.classify_job_location_precision(address_raw)
where source_type = 'telegram';

-- Keep imported Telegram jobs classified consistently on every parse/update.
create or replace function public.store_parsed(p_message uuid, p_result jsonb, p_fingerprint text)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  m telegram_messages;
  s telegram_sources;
  c text;
  j uuid;
  safe_fingerprint text;
  parsed_address text;
begin
  select * into m from telegram_messages where id=p_message;
  if not found then return null; end if;
  select * into s from telegram_sources where id=m.source_id;
  select name into c from cities where id=s.city_id;

  parsed_address := nullif(trim(p_result->>'address'), '');

  insert into parser_runs(message_id,provider,result)
  values(m.id,'conservative',p_result);

  if not coalesce((p_result->>'is_job')::boolean,false) then return null; end if;

  select id into j
  from jobs
  where source_message_id=m.id and status='pending_moderation'
  order by updated_at desc nulls last, created_at desc
  limit 1;

  if j is not null then
    select case when exists (
      select 1 from jobs x
      where x.fingerprint=p_fingerprint and x.id<>j and x.status='pending_moderation'
    ) then (select fingerprint from jobs where id=j) else p_fingerprint end into safe_fingerprint;

    update jobs set
      title=p_result->>'title', description=p_result->>'description', city_id=s.city_id, city=c,
      address_raw=parsed_address, address_normalized=parsed_address,
      location_precision=public.classify_job_location_precision(parsed_address),
      salary_min=(p_result->>'salary_min')::numeric, salary_max=(p_result->>'salary_max')::numeric,
      salary_type=p_result->>'salary_type', employment_type=p_result->>'employment_type', payment_type=p_result->>'payment_type',
      date_start=nullif(p_result->>'date_start','')::date, date_end=nullif(p_result->>'date_end','')::date,
      time_start=nullif(p_result->>'time_start','')::time, time_end=nullif(p_result->>'time_end','')::time,
      contact_phone=p_result->>'contact_phone', contact_telegram=p_result->>'contact_telegram', contact_email=p_result->>'contact_email',
      source_url=m.message_url, original_text=m.message_text,
      ai_confidence=(p_result->>'confidence')::numeric,
      moderation_reason='Импорт: проверьте текст, город источника, оплату и контакты',
      fingerprint=safe_fingerprint, updated_at=now()
    where id=j;
  else
    insert into jobs(
      title,description,city_id,city,address_raw,address_normalized,location_precision,
      salary_min,salary_max,salary_type,employment_type,payment_type,date_start,date_end,time_start,time_end,
      contact_phone,contact_telegram,contact_email,source_type,source_id,source_message_id,source_url,original_text,
      status,ai_confidence,moderation_reason,fingerprint
    )
    values(
      p_result->>'title',p_result->>'description',s.city_id,c,parsed_address,parsed_address,public.classify_job_location_precision(parsed_address),
      (p_result->>'salary_min')::numeric,(p_result->>'salary_max')::numeric,p_result->>'salary_type',p_result->>'employment_type',p_result->>'payment_type',
      nullif(p_result->>'date_start','')::date,nullif(p_result->>'date_end','')::date,
      nullif(p_result->>'time_start','')::time,nullif(p_result->>'time_end','')::time,
      p_result->>'contact_phone',p_result->>'contact_telegram',p_result->>'contact_email',
      'telegram',s.id,m.id,m.message_url,m.message_text,'pending_moderation',(p_result->>'confidence')::numeric,
      'Импорт: проверьте текст, город источника, оплату и контакты',p_fingerprint
    )
    on conflict(fingerprint) where fingerprint is not null do update set
      title=excluded.title, description=excluded.description, city_id=excluded.city_id, city=excluded.city,
      address_raw=excluded.address_raw, address_normalized=excluded.address_normalized, location_precision=excluded.location_precision,
      salary_min=excluded.salary_min, salary_max=excluded.salary_max, salary_type=excluded.salary_type,
      employment_type=excluded.employment_type, payment_type=excluded.payment_type, date_start=excluded.date_start,
      date_end=excluded.date_end, time_start=excluded.time_start, time_end=excluded.time_end,
      contact_phone=excluded.contact_phone, contact_telegram=excluded.contact_telegram, contact_email=excluded.contact_email,
      source_url=excluded.source_url, original_text=excluded.original_text, ai_confidence=excluded.ai_confidence,
      moderation_reason=excluded.moderation_reason, updated_at=now()
    where jobs.status='pending_moderation'
    returning id into j;
  end if;

  if j is not null then
    insert into job_sources(job_id,message_id,source_url) values(j,m.id,m.message_url) on conflict do nothing;
  end if;
  return j;
end
$function$;
