-- Keep job location precision truthful and derived from stored coordinates/address.
-- Exact means coordinates are explicitly present; an address without coordinates is only approximate.

alter table public.jobs
  add column if not exists location_precision text not null default 'unknown';

alter table public.jobs
  drop constraint if exists jobs_location_precision_check;

alter table public.jobs
  add constraint jobs_location_precision_check
  check (location_precision in ('exact', 'approximate', 'unknown'));

create or replace function public.set_job_location_precision()
returns trigger
language plpgsql
as $function$
begin
  if new.latitude is not null and new.longitude is not null then
    new.location_precision := 'exact';
  elsif nullif(trim(coalesce(new.address_raw, '')), '') is not null then
    new.location_precision := 'approximate';
  else
    new.location_precision := 'unknown';
  end if;

  return new;
end;
$function$;

drop trigger if exists jobs_location_precision_trigger on public.jobs;

create trigger jobs_location_precision_trigger
before insert or update of latitude, longitude, address_raw
on public.jobs
for each row
execute function public.set_job_location_precision();

update public.jobs
set location_precision = case
  when latitude is not null and longitude is not null then 'exact'
  when nullif(trim(coalesce(address_raw, '')), '') is not null then 'approximate'
  else 'unknown'
end;

create index if not exists jobs_location_precision_idx
  on public.jobs (status, location_precision, created_at desc);
