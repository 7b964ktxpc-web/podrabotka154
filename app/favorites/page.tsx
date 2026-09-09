import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { JobCard } from '@/components/job-card';
import { Favorite } from '@/components/job-interactions';
import type { Job } from '@/lib/types';

export const metadata = { title: 'Избранное', robots: { index: false } };

export default async function Favorites({ searchParams }: {
    searchParams: Promise<{ page?: string }>;
}) {
    const p = Math.max(1, Math.min(1000, Number((await searchParams).page) || 1));
    const { client, user } = await requireUser();
    const { data, count } = check(await client.from('favorites').select('job_id,jobs(*)', { count: 'exact' }).eq('user_id', user.id).order('created_at', { ascending: false }).range((p - 1) * 20, p * 20 - 1));
    const active = (data ?? []).filter(f => {
        const j = f.jobs as unknown as Job | null;
        return j && j.status === 'published' && new Date(j.expires_at!) > new Date();
    });
    const unavailable = (data ?? []).filter(f => {
        const j = f.jobs as unknown as Job | null;
        return !j || j.status !== 'published' || !j.expires_at || new Date(j.expires_at) <= new Date();
    });

    return <>
        <div className="page-head">
            <div>
                <p className="eyebrow">Твои вакансии</p>
                <h1>Избранное</h1>
                <p className="lead">Сохраняй подходящие объявления, чтобы быстро вернуться к ним.</p>
            </div>
            <Link className="button primary" href="/jobs">Найти подработку</Link>
        </div>
        {active.length ? <section className="favorites-list" aria-label="Сохранённые вакансии">{active.map(f => <JobCard key={f.job_id} job={f.jobs as unknown as Job} saved/>)}</section> : <div className="empty favorite-empty"><h2>В избранном пока пусто</h2><p>Нажми на сердечко у подходящей вакансии — она появится здесь.</p><Link className="button primary" href="/jobs">Перейти к вакансиям →</Link></div>}
        {unavailable.length > 0 && <details className="unavailable-favorites"><summary>Недоступные объявления ({unavailable.length})</summary><div className="data-list">{unavailable.map(f => <div key={f.job_id} className="data-row row"><span>Вакансия больше недоступна</span><Favorite id={f.job_id} initial/></div>)}</div></details>}
        <nav className="pagination" aria-label="Страницы">{p > 1 && <Link className="button" href={'?page=' + (p - 1)}>← Назад</Link>}{(count || 0) > p * 20 && <Link className="button primary" href={'?page=' + (p + 1)}>Дальше →</Link>}</nav>
    </>;
}
