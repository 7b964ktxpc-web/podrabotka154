alter table public.jobs
  add column if not exists location_precision text not null default 'unknown';

alter table public.jobs
  drop constraint if exists jobs_location_precision_check;

alter table public.jobs
  add constraint jobs_location_precision_check
  check (location_precision in ('exact', 'approximate', 'unknown'));

create index if not exists jobs_location_precision_idx
  on public.jobs (status, location_precision)
  where status = 'published';
