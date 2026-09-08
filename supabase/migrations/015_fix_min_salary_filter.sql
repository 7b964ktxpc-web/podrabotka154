-- Minimum salary must work for every salary unit, not only per-shift jobs.
-- For hourly jobs salary_min is the hourly rate; for shift/month/task it is the corresponding minimum amount.
create or replace function public.search_jobs(f jsonb)
returns table(job jsonb, total bigint)
language sql
stable
set search_path to 'public'
as $function$
with matched as (
  select j.*,
    case when coalesce(f->>'q','')='' then 0 else ts_rank(j.search_vector,websearch_to_tsquery('russian',f->>'q')) end as relevance,
    coalesce((select max(priority) from job_promotions p where p.job_id=j.id and p.starts_at<=now() and p.ends_at>now()),0) as commercial
  from jobs j
  where j.status='published'
    and j.expires_at>now()
    and (coalesce(f->>'q','')='' or j.search_vector@@websearch_to_tsquery('russian',f->>'q') or strpos(lower(j.title),lower(f->>'q'))>0)
    and (coalesce(f->>'where','')='' or strpos(lower(j.city||' '||coalesce(j.address_normalized,'')),lower(f->>'where'))>0)
    and (coalesce(f->>'category','')='' or j.category::text=f->>'category')
    and (nullif(f->>'min','') is null or j.salary_min>=(f->>'min')::numeric)
    and (nullif(f->>'day','') is null or (j.date_start is not null and j.date_start<=(f->>'day')::date and coalesce(j.date_end,j.date_start)>=(f->>'day')::date))
    and (coalesce((f->>'instant')::boolean,false)=false or j.payment_type in ('daily','immediate'))
    and (coalesce(f->>'payment','')='' or j.payment_type=f->>'payment')
    and (coalesce(f->>'employment','')='' or j.employment_type=f->>'employment')
    and (coalesce((f->>'employer')::boolean,false)=false or j.source_type='employer')
    and (coalesce((f->>'address')::boolean,false)=false or nullif(trim(j.address_normalized),'') is not null)
)
select to_jsonb(m)-'search_vector',count(*) over()
from matched m
order by
  case when coalesce(f->>'sort','relevance')='relevance' then m.relevance end desc,
  case when coalesce(f->>'sort','relevance')='salary_desc' then m.salary_min end desc nulls last,
  case when coalesce(f->>'sort','relevance')='salary_asc' then m.salary_min end asc nulls last,
  case when coalesce(f->>'sort','relevance')='recent' then m.published_at end desc,
  m.commercial desc,
  m.published_at desc,
  m.id
limit 20 offset (greatest(1,least(1000,coalesce((f->>'page')::int,1)))-1)*20
$function$;
