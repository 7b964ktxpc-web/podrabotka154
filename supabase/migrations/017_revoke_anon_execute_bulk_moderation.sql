revoke execute on function public.moderate_jobs_bulk(uuid[], text, text) from public;
revoke execute on function public.moderate_jobs_bulk(uuid[], text, text) from anon;
grant execute on function public.moderate_jobs_bulk(uuid[], text, text) to authenticated;
