-- Keep exactly one job per Telegram message. Existing duplicates are legacy archived rows paired with a newer pending row.
with duplicates as (
  select source_message_id,
         (array_agg(id order by case when status='pending_moderation' then 0 else 1 end, created_at))[1] as keeper_id
  from public.jobs
  where source_message_id is not null
  group by source_message_id
  having count(*) > 1 and count(*) filter (where status='pending_moderation') > 0
)
delete from public.job_sources js
using duplicates d, public.jobs old_job
where js.job_id = old_job.id
  and old_job.source_message_id = d.source_message_id
  and old_job.id <> d.keeper_id
  and exists (select 1 from public.job_sources k where k.job_id=d.keeper_id and k.message_id=js.message_id);

with duplicates as (
  select source_message_id,
         (array_agg(id order by case when status='pending_moderation' then 0 else 1 end, created_at))[1] as keeper_id
  from public.jobs
  where source_message_id is not null
  group by source_message_id
  having count(*) > 1 and count(*) filter (where status='pending_moderation') > 0
)
update public.job_sources js
set job_id=d.keeper_id
from duplicates d, public.jobs old_job
where js.job_id=old_job.id
  and old_job.source_message_id=d.source_message_id
  and old_job.id<>d.keeper_id;

with duplicates as (
  select source_message_id,
         (array_agg(id order by case when status='pending_moderation' then 0 else 1 end, created_at))[1] as keeper_id
  from public.jobs
  where source_message_id is not null
  group by source_message_id
  having count(*) > 1 and count(*) filter (where status='pending_moderation') > 0
)
delete from public.jobs j
using duplicates d
where j.source_message_id=d.source_message_id
  and j.id<>d.keeper_id
  and j.status='archived';

delete from public.job_sources js where not exists (select 1 from public.jobs j where j.id=js.job_id);

create unique index if not exists jobs_source_message_id_unique on public.jobs(source_message_id) where source_message_id is not null;

create or replace function public.store_parsed(p_message uuid, p_result jsonb, p_fingerprint text)
returns uuid language plpgsql security definer set search_path to 'public'
as $function$
declare m telegram_messages; s telegram_sources; c text; j uuid; existing_status text; safe_fingerprint text;
begin
  select * into m from telegram_messages where id=p_message; if not found then return null; end if;
  select * into s from telegram_sources where id=m.source_id; select name into c from cities where id=s.city_id;
  insert into parser_runs(message_id,provider,result) values(m.id,'conservative',p_result);
  if not coalesce((p_result->>'is_job')::boolean,false) then return null; end if;
  select id,status into j,existing_status from jobs where source_message_id=m.id
    order by case when status='pending_moderation' then 0 else 1 end, updated_at desc nulls last, created_at desc limit 1;
  if j is not null then
    if existing_status='pending_moderation' then
      select case when exists (select 1 from jobs x where x.fingerprint=p_fingerprint and x.id<>j and x.status='pending_moderation')
        then (select fingerprint from jobs where id=j) else p_fingerprint end into safe_fingerprint;
      update jobs set title=p_result->>'title',description=p_result->>'description',city_id=s.city_id,city=c,
        address_raw=p_result->>'address',address_normalized=p_result->>'address',salary_min=(p_result->>'salary_min')::numeric,
        salary_max=(p_result->>'salary_max')::numeric,salary_type=p_result->>'salary_type',employment_type=p_result->>'employment_type',payment_type=p_result->>'payment_type',
        date_start=nullif(p_result->>'date_start','')::date,date_end=nullif(p_result->>'date_end','')::date,time_start=nullif(p_result->>'time_start','')::time,time_end=nullif(p_result->>'time_end','')::time,
        contact_phone=p_result->>'contact_phone',contact_telegram=p_result->>'contact_telegram',contact_email=p_result->>'contact_email',source_url=m.message_url,original_text=m.message_text,
        ai_confidence=(p_result->>'confidence')::numeric,moderation_reason='Импорт: проверьте текст, город источника, оплату и контакты',fingerprint=safe_fingerprint,updated_at=now() where id=j;
    end if;
  else
    insert into jobs(title,description,city_id,city,address_raw,address_normalized,salary_min,salary_max,salary_type,employment_type,payment_type,date_start,date_end,time_start,time_end,contact_phone,contact_telegram,contact_email,source_type,source_id,source_message_id,source_url,original_text,status,ai_confidence,moderation_reason,fingerprint)
    values(p_result->>'title',p_result->>'description',s.city_id,c,p_result->>'address',p_result->>'address',(p_result->>'salary_min')::numeric,(p_result->>'salary_max')::numeric,p_result->>'salary_type',p_result->>'employment_type',p_result->>'payment_type',nullif(p_result->>'date_start','')::date,nullif(p_result->>'date_end','')::date,nullif(p_result->>'time_start','')::time,nullif(p_result->>'time_end','')::time,p_result->>'contact_phone',p_result->>'contact_telegram',p_result->>'contact_email','telegram',s.id,m.id,m.message_url,m.message_text,'pending_moderation',(p_result->>'confidence')::numeric,'Импорт: проверьте текст, город источника, оплату и контакты',p_fingerprint)
    on conflict (source_message_id) where source_message_id is not null do nothing returning id into j;
  end if;
  if j is not null then insert into job_sources(job_id,message_id,source_url) values(j,m.id,m.message_url) on conflict do nothing; end if;
  return j;
end
$function$;
