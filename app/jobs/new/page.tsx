import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { JobForm } from '@/components/job-form';
export default async function NewJob() { const { client, user } = await requireUser(); const { data: e } = check(await client.from('employers').select('id').eq('owner_id', user.id).maybeSingle()); if (!e)
    redirect('/employer?setup=1'); const { data: cities } = check(await client.from('cities').select('id,name').eq('active', true)); const { data: categories } = check(await client.from('job_categories').select('id,name').eq('active', true)); return <section className="panel"><h1>Разместить вакансию</h1><p className="lead">Заполни форму — мы покажем предпросмотр перед отправкой на модерацию.</p><JobForm cities={cities!} categories={categories!}/></section>; }
