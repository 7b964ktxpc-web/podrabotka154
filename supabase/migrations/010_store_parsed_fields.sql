begin;

create or replace function store_parsed(p_message uuid,p_result jsonb,p_fingerprint text) returns uuid
language plpgsql security definer set search_path=public as $$
declare
  m telegram_messages;
  s telegram_sources;
  c text;
  j uuid;
begin
  select * into m from telegram_messages where id=p_message;
  select * into s from telegram_sources where id=m.source_id;
  select name into c from cities where id=s.city_id;

  insert into parser_runs(message_id,provider,result)
  values(m.id,'conservative',p_result);

  if not coalesce((p_result->>'is_job')::boolean,false) then
    return null;
  end if;

  insert into jobs(
    title,description,city_id,city,address_raw,address_normalized,
    salary_min,salary_max,salary_type,employment_type,payment_type,
    date_start,date_end,time_start,time_end,
    contact_phone,contact_telegram,contact_email,
    source_type,source_id,source_message_id,source_url,original_text,
    status,ai_confidence,moderation_reason,fingerprint
  )
  values(
    p_result->>'title',p_result->>'description',s.city_id,c,
    p_result->>'address',p_result->>'address',
    (p_result->>'salary_min')::numeric,(p_result->>'salary_max')::numeric,p_result->>'salary_type',
    p_result->>'employment_type',p_result->>'payment_type',
    nullif(p_result->>'date_start','')::date,
    nullif(p_result->>'date_end','')::date,
    nullif(p_result->>'time_start','')::time,
    nullif(p_result->>'time_end','')::time,
    p_result->>'contact_phone',p_result->>'contact_telegram',p_result->>'contact_email',
    'telegram',s.id,m.id,m.message_url,m.message_text,
    'pending_moderation',
    (p_result->>'confidence')::numeric,
    'Импорт: проверьте текст, город источника, оплату и контакты',
    p_fingerprint
  )
  on conflict(fingerprint) where fingerprint is not null do update set
    title=excluded.title,
    description=excluded.description,
    city_id=excluded.city_id,
    city=excluded.city,
    address_raw=excluded.address_raw,
    address_normalized=excluded.address_normalized,
    salary_min=excluded.salary_min,
    salary_max=excluded.salary_max,
    salary_type=excluded.salary_type,
    employment_type=excluded.employment_type,
    payment_type=excluded.payment_type,
    date_start=excluded.date_start,
    date_end=excluded.date_end,
    time_start=excluded.time_start,
    time_end=excluded.time_end,
    contact_phone=excluded.contact_phone,
    contact_telegram=excluded.contact_telegram,
    contact_email=excluded.contact_email,
    source_url=excluded.source_url,
    original_text=excluded.original_text,
    ai_confidence=excluded.ai_confidence,
    moderation_reason=excluded.moderation_reason,
    updated_at=now()
  where jobs.status='pending_moderation'
  returning id into j;

  insert into job_sources(job_id,message_id,source_url)
  values(j,m.id,m.message_url)
  on conflict do nothing;

  return j;
end $$;

grant execute on function store_parsed(uuid,jsonb,text) to service_role;

commit;
