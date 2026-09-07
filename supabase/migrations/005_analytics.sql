create function employer_stats() returns table(job_id uuid,event_type text,event_count bigint) language sql stable security definer set search_path=public as $$
 select ev.job_id,ev.type,count(*) from job_events ev join jobs j on j.id=ev.job_id join employers e on e.id=j.employer_id where e.owner_id=auth.uid() group by ev.job_id,ev.type
$$;
revoke execute on function employer_stats() from public,anon;
grant execute on function employer_stats() to authenticated;
