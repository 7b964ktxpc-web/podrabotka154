import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { JobForm } from '@/components/job-form';
import type { Job } from '@/lib/types';

export default async function Edit({ params }: {
  params: Promise<{ id: string }>;
}) {
  const { client, user } = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const { data: j } = check(await client.from('jobs').select('*').eq('id', id).maybeSingle());
  if (!j) notFound();

  const { data: e } = check(await client.from('employers').select('owner_id').eq('id', j.employer_id).maybeSingle());
  const { data: p } = check(await client.from('profiles').select('roles').eq('id', user.id).single());
  const isAdmin = p?.roles?.includes('admin');
  if (e?.owner_id !== user.id && !isAdmin) notFound();

  const { data: cities } = check(await client.from('cities').select('id,name').eq('active', true));
  const { data: categories } = check(await client.from('job_categories').select('id,name').eq('active', true));

  return (
    <section className="panel">
      <h1>Изменить вакансию</h1>
      <p>Сохранение вернёт объявление в черновик. Публикация требует повторной проверки.</p>
      <JobForm cities={cities!} categories={categories!} job={j as Job} />
    </section>
  );
}
