begin;

-- Keep a claimed queue item locked longer than the GitHub Actions worker timeout.
-- This prevents a slow worker from losing its lease just before the job is finished.
create or replace function public.claim_work(batch int)
returns setof public.work_queue
language sql
security definer
set search_path=public
as $$
  update public.work_queue
  set locked_until = now() + interval '10 minutes',
      lock_token = gen_random_uuid(),
      attempts = attempts + 1
  where id in (
    select id
    from public.work_queue
    where done_at is null
      and attempts < 8
      and available_at <= now()
      and (locked_until is null or locked_until < now())
    order by available_at
    for update skip locked
    limit least(greatest(batch, 1), 50)
  )
  returning *;
$$;

grant execute on function public.claim_work(integer) to service_role;

commit;
