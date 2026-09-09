alter table public.jobs
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.jobs
  drop constraint if exists jobs_latitude_range,
  drop constraint if exists jobs_longitude_range;

alter table public.jobs
  add constraint jobs_latitude_range check (latitude is null or latitude between -90 and 90),
  add constraint jobs_longitude_range check (longitude is null or longitude between -180 and 180);

create index if not exists jobs_published_coordinates_idx
  on public.jobs (status, latitude, longitude)
  where latitude is not null and longitude is not null;
