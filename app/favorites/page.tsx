import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { JobCard } from '@/components/job-card';
import { Favorite } from '@/components/job-interactions';
import type { Job } from '@/lib/types';
export const metadata = { title: 'Избранное', robots: { index: false } };
export default async function Favorites({ searchParams }: {
    searchParams: Promise<{
        page?: string;
    }>;
}) { const p = Math.max(1, Math.min(1000, Number((await searchParams).page) || 1)); const { client, user } = await requireUser(); const { data, count } = check(await client.from('favorites').select('job_id,jobs(*)', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false }).range((p - 1) * 20, p * 20 - 1)); return <><h1>Избранное</h1>{data?.length ? data.map(f => { const j = f.jobs as unknown as Job | null; return j && j.status === 'published' && new Date(j.expires_at!) > new Date() ? <JobCard key={f.job_id} job={j} saved/> : <div key={f.job_id} className="data-row row"><span>Вакансия больше недоступна</span><Favorite id={f.job_id} initial/></div>; }) : <div className="empty"><h2>Вы ещё не сохраняли вакансии</h2><p>Нажмите на сердечко у подходящего объявления.</p><Link className="button" href="/jobs">Найти подработку</Link></div>}<nav>{p > 1 && <Link href={'?page=' + (p - 1)}>← Назад</Link>}{(count || 0) > p * 20 && <Link href={'?page=' + (p + 1)}>Дальше →</Link>}</nav></>; }
