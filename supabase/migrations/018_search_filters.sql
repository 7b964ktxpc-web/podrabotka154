begin;

-- Keep catalog search and saved-search notifications consistent with the filters
-- exposed by readFilters().
create or replace function search_jobs(f jsonb)
returns table(job jsonb,total bigint)
language sql stable set search_path=public as $$
 with matched as (
 select j.*,
   case when coalesce(f->>'q','')='' then 0 else ts_rank(j.search_vector,websearch_to_tsquery('russian',f->>'q')) end as relevance,
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
 and (coalesce(f->>'payment','')='' or j.payment_type=f->>'payment')
 and (coalesce(f->>'employment','')='' or j.employment_type=f->>'employment')
 ) select to_jsonb(m)-'search_vector',count(*) over()
 from matched m
 order by relevance desc,published_at desc,commercial desc,id
 limit 20 offset (greatest(1,least(1000,coalesce((f->>'page')::int,1)))-1)*20
$$;

create or replace function notify_job(p_job uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 insert into notifications(user_id,job_id,kind,title,url,dedupe_key)
 select s.user_id,j.id,'new_job',j.title,'/jobs/'||j.id,'new-job:'||j.id
 from saved_searches s cross join jobs j
 where j.id=p_job and j.status='published' and j.expires_at>now() and s.notify and j.published_at>=s.created_at
 and (coalesce(s.filters->>'q','')='' or j.search_vector@@websearch_to_tsquery('russian',s.filters->>'q') or strpos(lower(j.title),lower(s.filters->>'q'))>0)
 and (coalesce(s.filters->>'where','')='' or strpos(lower(j.city||' '||coalesce(j.address_normalized,'')),lower(s.filters->>'where'))>0)
 and (coalesce(s.filters->>'category','')='' or j.category::text=s.filters->>'category')
 and (nullif(s.filters->>'min','') is null or (j.salary_type='shift' and j.salary_min>=(s.filters->>'min')::numeric))
 and (nullif(s.filters->>'day','') is null or (j.date_start<=(s.filters->>'day')::date and coalesce(j.date_end,j.date_start)>= (s.filters->>'day')::date))
 and (coalesce((s.filters->>'instant')::boolean,false)=false or j.payment_type in ('daily','immediate'))
 and (coalesce((s.filters->>'employer')::boolean,false)=false or j.source_type='employer')
 and (coalesce((s.filters->>'address')::boolean,false)=false or nullif(trim(j.address_normalized),'') is not null)
 and (coalesce(s.filters->>'payment','')='' or j.payment_type=s.filters->>'payment')
 and (coalesce(s.filters->>'employment','')='' or j.employment_type=s.filters->>'employment')
 on conflict do nothing;
end $$;

grant execute on function notify_job(uuid) to service_role;

commit;
