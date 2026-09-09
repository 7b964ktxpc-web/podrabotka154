begin;

create or replace function public.save_job(p jsonb, p_id uuid default null) returns uuid
language plpgsql security definer set search_path=public as $$
declare e uuid;c text;j jobs;result uuid;lat double precision;lng double precision;precision_value text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select id into e from employers where owner_id=auth.uid();
 if e is null and not is_admin() then raise exception 'EMPLOYER_REQUIRED';end if;
 select name into c from cities where id=(p->>'city_id')::uuid and active;
 if c is null then raise exception 'INVALID_CITY';end if;
 if p_id is not null then
  select * into j from jobs where id=p_id for update;
  if not found or (not is_admin() and (j.employer_id is distinct from e or j.status not in ('draft','rejected'))) then raise exception 'FORBIDDEN';end if;
 end if;
 lat=nullif(p->>'latitude','')::double precision;
 lng=nullif(p->>'longitude','')::double precision;
 if (lat is null) <> (lng is null) then raise exception 'INVALID_COORDINATES';end if;
 if lat is not null and (lat < -90 or lat > 90 or lng < -180 or lng > 180) then raise exception 'INVALID_COORDINATES';end if;
 precision_value=case when lat is not null and lng is not null then 'exact' else public.classify_job_location_precision(nullif(trim(p->>'address_raw'),'')) end;
 if p_id is null then
  insert into jobs(title,description,city_id,city,employer_id,source_type) values(p->>'title',p->>'description',(p->>'city_id')::uuid,c,e,case when e is null then 'admin' else 'employer' end) returning id into result;
 else result=p_id;end if;
 update jobs set title=p->>'title',description=p->>'description',city_id=(p->>'city_id')::uuid,city=c,
 category=nullif(p->>'category','')::uuid,salary_min=nullif(p->>'salary_min','')::numeric,salary_max=nullif(p->>'salary_max','')::numeric,salary_type=nullif(p->>'salary_type',''),
 address_raw=nullif(trim(p->>'address_raw'),''),address_normalized=nullif(trim(p->>'address_raw'),''),employment_type=nullif(p->>'employment_type',''),payment_type=nullif(p->>'payment_type',''),
 date_start=nullif(p->>'date_start','')::date,date_end=nullif(p->>'date_end','')::date,time_start=nullif(p->>'time_start','')::time,time_end=nullif(p->>'time_end','')::time,
 contact_phone=nullif(p->>'contact_phone',''),contact_telegram=nullif(p->>'contact_telegram',''),contact_email=nullif(p->>'contact_email',''),photo_url=nullif(p->>'photo_url',''),
 latitude=lat,longitude=lng,location_precision=precision_value,
 status='draft',updated_at=now() where id=result;
 return result;
end $$;

commit;
