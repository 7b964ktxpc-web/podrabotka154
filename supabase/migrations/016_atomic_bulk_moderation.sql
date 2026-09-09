begin;

create or replace function public.moderate_jobs_bulk(p_ids uuid[], p_status text, p_reason text default '') returns integer
language plpgsql security definer set search_path=public as $$
declare
  job_id uuid;
  changed integer := 0;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_ids is null or cardinality(p_ids) < 1 or cardinality(p_ids) > 100 then raise exception 'INVALID_BATCH'; end if;
  foreach job_id in array p_ids loop
    perform public.moderate_job(job_id, p_status, p_reason);
    changed := changed + 1;
  end loop;
  return changed;
end;
$$;

grant execute on function public.moderate_jobs_bulk(uuid[], text, text) to authenticated;

commit;
