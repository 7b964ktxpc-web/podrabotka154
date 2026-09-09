begin;

drop policy if exists public_read on public.cities;
create policy public_read on public.cities for select to anon, authenticated using (active);

drop policy if exists public_read on public.job_categories;
create policy public_read on public.job_categories for select to anon, authenticated using (active);

drop policy if exists public_read on public.products;
create policy public_read on public.products for select to anon, authenticated using (active);

drop policy if exists visible on public.jobs;
create policy public_read_published on public.jobs for select to anon, authenticated using (status='published' and expires_at>now());
create policy employer_read_own on public.jobs for select to authenticated using (employer_id in (select id from public.employers where owner_id=auth.uid()));

drop policy if exists public_read on public.job_sources;
create policy public_read on public.job_sources for select to anon, authenticated using (exists(select 1 from public.jobs j where j.id=job_id and j.status='published' and j.expires_at>now()));

commit;
