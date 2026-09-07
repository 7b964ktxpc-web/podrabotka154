begin;
create function save_employer(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 insert into employers(owner_id,slug,name,description,city_id,contact_phone,contact_telegram,website,contact_person,logo_url)
 values(auth.uid(),p->>'slug',p->>'name',p->>'description',(p->>'city_id')::uuid,p->>'contact_phone',p->>'contact_telegram',p->>'website',p->>'contact_person',p->>'logo_url')
 on conflict(owner_id) do update set slug=excluded.slug,name=excluded.name,description=excluded.description,city_id=excluded.city_id,contact_phone=excluded.contact_phone,contact_telegram=excluded.contact_telegram,website=excluded.website,contact_person=excluded.contact_person,logo_url=excluded.logo_url returning id into result;
 update profiles set roles=array(select distinct unnest(roles||array['employer'])) where id=auth.uid();
 insert into employer_profiles values(result,auth.uid()) on conflict do nothing;return result;end $$;

create function save_job(p jsonb,p_id uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare e uuid;c text;j jobs;result uuid;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select id into e from employers where owner_id=auth.uid();
 if e is null and not is_admin() then raise exception 'EMPLOYER_REQUIRED';end if;
 select name into c from cities where id=(p->>'city_id')::uuid and active;
 if c is null then raise exception 'INVALID_CITY';end if;
 if p_id is not null then
  select * into j from jobs where id=p_id for update;
  if not found or (not is_admin() and (j.employer_id is distinct from e or j.status not in ('draft','rejected'))) then raise exception 'FORBIDDEN';end if;
 end if;
 if p_id is null then
  insert into jobs(title,description,city_id,city,employer_id,source_type) values(p->>'title',p->>'description',(p->>'city_id')::uuid,c,e,case when e is null then 'admin' else 'employer' end) returning id into result;
 else result=p_id;end if;
 update jobs set title=p->>'title',description=p->>'description',city_id=(p->>'city_id')::uuid,city=c,
 category=nullif(p->>'category','')::uuid,salary_min=nullif(p->>'salary_min','')::numeric,salary_max=nullif(p->>'salary_max','')::numeric,salary_type=nullif(p->>'salary_type',''),
 address_raw=nullif(trim(p->>'address_raw'),''),address_normalized=nullif(trim(p->>'address_raw'),''),employment_type=nullif(p->>'employment_type',''),payment_type=nullif(p->>'payment_type',''),
 date_start=nullif(p->>'date_start','')::date,date_end=nullif(p->>'date_end','')::date,time_start=nullif(p->>'time_start','')::time,time_end=nullif(p->>'time_end','')::time,
 contact_phone=nullif(p->>'contact_phone',''),contact_telegram=nullif(p->>'contact_telegram',''),contact_email=nullif(p->>'contact_email',''),photo_url=nullif(p->>'photo_url',''),
 status='draft',updated_at=now() where id=result;
 return result;end $$;

create function submit_job(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare j jobs;e employers;lim int;used int;ent uuid;begin
 select * into j from jobs where id=p_id for update;
 select * into e from employers where id=j.employer_id for update;
 if not found or e.owner_id<>auth.uid() or auth.uid() is null then raise exception 'FORBIDDEN';end if;
 if j.status='pending_moderation' then return;end if;
 if j.status not in ('draft','rejected') then raise exception 'INVALID_STATE';end if;
 select (value->>'free_active_limit')::int into lim from settings where key='publication';
 if lim is null then raise exception 'SETTINGS_REQUIRED';end if;
 select count(*) into used from jobs where employer_id=e.id and (status='pending_moderation' or (status='published' and expires_at>now()));
 if used>=lim then
  select id into ent from employer_subscriptions where employer_id=e.id and ends_at>now() and remaining_placements>0 order by ends_at for update skip locked limit 1;
  if ent is null then raise exception 'FREE_LIMIT';end if;
  update employer_subscriptions set remaining_placements=remaining_placements-1 where id=ent;
 end if;
 update jobs set status='pending_moderation',moderation_reason='Ручная проверка перед публикацией',updated_at=now() where id=p_id;
end $$;

create function moderate_job(p_id uuid,p_status text,p_reason text default '') returns void language plpgsql security definer set search_path=public as $$
declare j jobs;days int;until_date timestamptz;tz text;begin
 if not is_admin() then raise exception 'FORBIDDEN';end if;
 if p_status not in ('published','rejected','draft','archived') then raise exception 'INVALID_STATE';end if;
 select * into j from jobs where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if p_status='published' and j.status='published' then return;end if;
 if p_status='published' and j.status not in ('pending_moderation','draft','rejected') then raise exception 'INVALID_STATE';end if;
 select (value->>'days')::int into days from settings where key='publication';
 if days is null then raise exception 'SETTINGS_REQUIRED';end if;
 select timezone into tz from cities where id=j.city_id;
 until_date=now()+make_interval(days=>days);
 if j.date_end is not null then until_date=least(until_date,(j.date_end+1)::timestamp at time zone tz);end if;
 if p_status='published' and until_date<=now() then raise exception 'EXPIRED_DATE';end if;
 update jobs set status=p_status,moderation_reason=p_reason,updated_at=now(),published_at=case when p_status='published' then now() else published_at end,expires_at=case when p_status='published' then until_date else expires_at end where id=p_id;
 insert into admin_logs(actor_id,action,target_id,details) values(auth.uid(),'moderate',p_id::text,jsonb_build_object('status',p_status,'reason',p_reason));
 if p_status='published' then
  insert into work_queue(kind,payload,dedupe_key) values('notify_job',jsonb_build_object('job_id',p_id),'published:'||p_id) on conflict do nothing;
  insert into notifications(user_id,job_id,kind,title,url,dedupe_key) select owner_id,p_id,'published','Ваша вакансия опубликована','/jobs/'||p_id,'employer-published:'||p_id from employers where id=j.employer_id on conflict do nothing;
 end if;
end $$;

create function search_jobs(f jsonb) returns table(job jsonb,total bigint) language sql stable set search_path=public as $$
 with matched as (
 select j.*,case when coalesce(f->>'q','')='' then 0 else ts_rank(j.search_vector,websearch_to_tsquery('russian',f->>'q')) end as relevance,
 coalesce((select max(priority) from job_promotions p where p.job_id=j.id and p.starts_at<=now() and p.ends_at>now()),0) as commercial
 from jobs j where j.status='published' and j.expires_at>now()
 and (coalesce(f->>'q','')='' or j.search_vector@@websearch_to_tsquery('russian',f->>'q') or strpos(lower(j.title),lower(f->>'q'))>0)
 and (coalesce(f->>'where','')='' or strpos(lower(j.city||' '||coalesce(j.address_normalized,'')),lower(f->>'where'))>0)
 and (coalesce(f->>'category','')='' or j.category::text=f->>'category')
 and (nullif(f->>'min','') is null or (j.salary_type='shift' and j.salary_min>=(f->>'min')::numeric))
 and (nullif(f->>'day','') is null or (j.date_start<=(f->>'day')::date and coalesce(j.date_end,j.date_start)>=(f->>'day')::date))
 and (coalesce((f->>'instant')::boolean,false)=false or j.payment_type in ('daily','immediate'))
 and (coalesce((f->>'employer')::boolean,false)=false or j.source_type='employer')
 and (coalesce((f->>'address')::boolean,false)=false or nullif(trim(j.address_normalized),'') is not null)
 ) select to_jsonb(m)-'search_vector',count(*) over() from matched m order by relevance desc,published_at desc,commercial desc,id limit 20 offset (greatest(1,least(1000,coalesce((f->>'page')::int,1)))-1)*20
$$;
-- search_jobs is invoker: give only SELECT on promotions; exposes no payment data.
grant select on job_promotions to anon;
create policy visible on job_promotions for select using(ends_at>now());

create function make_order(p_product uuid,p_job uuid,p_key uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare p products;e employers;j jobs;o uuid;begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select id into o from orders where user_id=auth.uid() and idempotency_key=p_key;
 if o is not null then return o;end if;
 select * into p from products where id=p_product and active;
 if not found or p.kind='normal' then raise exception 'INVALID_PRODUCT';end if;
 select * into e from employers where owner_id=auth.uid() for update;
 if not found then raise exception 'EMPLOYER_REQUIRED';end if;
 if p.kind in ('boost','highlight','vip') then
  select * into j from jobs where id=p_job and employer_id=e.id and status='published' and expires_at>now();
  if not found then raise exception 'INVALID_JOB';end if;
 end if;
 insert into orders(user_id,employer_id,job_id,product_id,amount,product_snapshot,idempotency_key)
 values(auth.uid(),e.id,case when p.kind in ('boost','highlight','vip') then p_job else null end,p.id,p.price_kopecks,to_jsonb(p),p_key)
 on conflict(user_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key returning id into o;
 return o;end $$;

create function settle_payment(event jsonb) returns void language plpgsql security definer set search_path=public as $$
declare o orders;days int;k text;begin
 select * into o from orders where id=(event->>'order_id')::uuid for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if (event->>'amount')::int<>o.amount or event->>'currency'<>o.currency or event->>'provider'<>'sandbox' or event->>'status' not in ('paid','refunded') then raise exception 'PAYMENT_MISMATCH';end if;
 insert into payment_events(provider,event_id,order_id,payload) values(event->>'provider',event->>'event_id',o.id,event) on conflict do nothing;
 if not found then return;end if;
 if event->>'status'='refunded' then
  if o.status='refunded' then return;end if;
  if o.status<>'paid' then raise exception 'INVALID_STATE';end if;
  update orders set status='refunded' where id=o.id;
  update payments set status='refunded' where order_id=o.id;
  update job_promotions set ends_at=now() where order_id=o.id;
  update employer_subscriptions set ends_at=now(),remaining_placements=0 where order_id=o.id;
  return;
 end if;
 if o.status='paid' then return;end if;
 if o.status<>'pending' then raise exception 'INVALID_STATE';end if;
 insert into payments(order_id,provider,provider_payment_id,status,amount) values(o.id,event->>'provider',event->>'payment_id','paid',o.amount);
 update orders set status='paid' where id=o.id;
 days=(o.product_snapshot->>'days')::int;k=o.product_snapshot->>'kind';
 if k in ('boost','highlight','vip') then
  insert into job_promotions(job_id,order_id,kind,priority,ends_at) values(o.job_id,o.id,k,(o.product_snapshot->>'priority')::int,now()+make_interval(days=>days));
 else
  insert into employer_subscriptions(employer_id,order_id,ends_at,remaining_placements) values(o.employer_id,o.id,now()+make_interval(days=>days),(o.product_snapshot->>'placements')::int);
 end if;
end $$;

create function enqueue_message() returns trigger language plpgsql security definer set search_path=public as $$begin
 insert into work_queue(kind,payload,dedupe_key) values('parse',jsonb_build_object('message_id',new.id),'parse:'||new.id) on conflict do nothing;return new;end $$;
create trigger raw_message after insert on telegram_messages for each row execute function enqueue_message();
create function claim_work(batch int) returns setof work_queue language sql security definer set search_path=public as $$
 update work_queue set locked_until=now()+interval '5 minutes',lock_token=gen_random_uuid(),attempts=attempts+1 where id in (
 select id from work_queue where done_at is null and attempts<8 and available_at<=now() and (locked_until is null or locked_until<now()) order by available_at for update skip locked limit least(greatest(batch,1),50)
 ) returning *
$$;
create function store_parsed(p_message uuid,p_result jsonb,p_fingerprint text) returns uuid language plpgsql security definer set search_path=public as $$
declare m telegram_messages;s telegram_sources;c text;j uuid;begin
 select * into m from telegram_messages where id=p_message;
 select * into s from telegram_sources where id=m.source_id;
 select name into c from cities where id=s.city_id;
 insert into parser_runs(message_id,provider,result) values(m.id,'conservative',p_result);
 if not coalesce((p_result->>'is_job')::boolean,false) then return null;end if;
 insert into jobs(title,description,city_id,city,address_raw,address_normalized,salary_min,salary_max,salary_type,contact_phone,contact_telegram,contact_email,source_type,source_id,source_message_id,source_url,original_text,status,ai_confidence,moderation_reason,fingerprint)
 values(p_result->>'title',p_result->>'description',s.city_id,c,p_result->>'address',p_result->>'address',(p_result->>'salary_min')::numeric,(p_result->>'salary_max')::numeric,p_result->>'salary_type',p_result->>'contact_phone',p_result->>'contact_telegram',p_result->>'contact_email','telegram',s.id,m.id,m.message_url,m.message_text,'pending_moderation',(p_result->>'confidence')::numeric,'Импорт: проверьте текст, город источника, оплату и контакты',p_fingerprint)
 on conflict(fingerprint) where fingerprint is not null do update set fingerprint=excluded.fingerprint returning id into j;
 insert into job_sources(job_id,message_id,source_url) values(j,m.id,m.message_url) on conflict do nothing;
 return j;end $$;

create function consume_rate(p_key text,p_limit int,p_seconds int) returns boolean language plpgsql security definer set search_path=public as $$
declare n int;begin
 insert into rate_limits values(p_key,now(),1) on conflict(key) do update set
 hits=case when rate_limits.window_start<now()-make_interval(secs=>p_seconds) then 1 else rate_limits.hits+1 end,
 window_start=case when rate_limits.window_start<now()-make_interval(secs=>p_seconds) then now() else rate_limits.window_start end returning hits into n;
 return n<=p_limit;end $$;
create function expire_jobs() returns void language plpgsql security definer set search_path=public as $$begin
 update jobs set status='expired',updated_at=now() where status='published' and expires_at<=now();
 insert into notifications(user_id,job_id,kind,title,url,dedupe_key)
 select e.owner_id,j.id,'expiring','Срок вакансии скоро закончится','/jobs/'||j.id,'expiring:'||j.id||':'||j.expires_at from jobs j join employers e on e.id=j.employer_id where j.status='published' and j.expires_at between now() and now()+interval '1 day' on conflict do nothing;
 insert into notifications(user_id,job_id,kind,title,url,dedupe_key)
 select e.owner_id,p.job_id,'promotion_expired','Продвижение закончилось','/employer','promotion-expired:'||p.id from job_promotions p join jobs j on j.id=p.job_id join employers e on e.id=j.employer_id where p.ends_at<=now() on conflict do nothing;
 delete from rate_limits where window_start<now()-interval '2 days';
end $$;
-- Security-definer routines default to PUBLIC EXECUTE in PostgreSQL. Revoke it explicitly.
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function is_admin() to anon,authenticated;
grant execute on function search_jobs(jsonb) to anon,authenticated;
grant execute on function save_employer(jsonb),save_job(jsonb,uuid),submit_job(uuid),moderate_job(uuid,text,text),make_order(uuid,uuid,uuid) to authenticated;
grant execute on all functions in schema public to service_role;
commit;
