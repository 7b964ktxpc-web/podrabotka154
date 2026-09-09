begin;

create or replace function public.moderate_job(p_id uuid,p_status text,p_reason text default '') returns void language plpgsql security definer set search_path=public as $$
declare j jobs;days int;until_date timestamptz;tz text;begin
 if not is_admin() then raise exception 'FORBIDDEN';end if;
 if p_status not in ('published','rejected','draft','archived') then raise exception 'INVALID_STATE';end if;
 select * into j from jobs where id=p_id for update;
 if not found then raise exception 'NOT_FOUND';end if;
 if p_status='published' and j.status='published' then return;end if;
 if p_status='published' and j.status not in ('pending_moderation','draft','rejected') then raise exception 'INVALID_STATE';end if;
 if p_status='published' then
  if nullif(trim(j.title),'') is null then raise exception 'MISSING_TITLE';end if;
  if nullif(trim(j.address_raw),'') is null then raise exception 'MISSING_ADDRESS';end if;
  if j.contact_phone is null and j.contact_telegram is null and j.contact_email is null then raise exception 'MISSING_CONTACT';end if;
  if j.salary_min is null and j.salary_max is null then raise exception 'MISSING_SALARY';end if;
  if j.date_start is null then raise exception 'MISSING_DATE';end if;
  if j.time_start is null and not regexp_like(lower(coalesce(j.original_text,'')), '(ближайш|срочно|сейчас|немедленно)') then raise exception 'MISSING_TIME';end if;
 end if;
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

commit;
