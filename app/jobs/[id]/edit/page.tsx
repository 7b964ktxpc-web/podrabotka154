import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { JobForm } from '@/components/job-form';
import type { Job } from '@/lib/types';
export default async function Edit({ params }: {
    params: Promise<{
        id: string;
    }>;
}) { const { client } = await requireUser(); const { id } = await params; const { data: j } = check(await client.from('jobs').select('*').eq('id', id).maybeSingle()); if (!j)
    notFound(); const { data: cities } = check(await client.from('cities').select('id,name').eq('active', true)); const { data: categories } = check(await client.from('job_categories').select('id,name').eq('active', true)); return <section className="panel"><h1>Изменить вакансию</h1><p>Сохранение вернёт объявление в черновик. Публикация требует повторной проверки.</p><JobForm cities={cities!} categories={categories!} job={j as Job}/></section>; }
