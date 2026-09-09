import Link from 'next/link';
import { db } from '@/lib/db';
import { check } from '@/lib/service-db';
import { configured } from '@/lib/env';
import { readFilters } from '@/lib/domain';
import { Search } from '@/components/search';
import { CatalogFilters } from '@/components/catalog-filters';
import { JobCard } from '@/components/job-card';
import { Setup } from '@/components/setup';
import { ActionForm } from '@/components/action-form';
import { saveSearch } from '@/app/actions';
import type { Job, Option } from '@/lib/types';
export const metadata = { title: 'Поиск подработки', alternates: { canonical: '/jobs' } };
export default async function Jobs({ searchParams }: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    if (!configured()) return <Setup />;
    const params = await searchParams, f = readFilters(params);
    const c = await db();
    const { data: rows } = check(await c.rpc('search_jobs', { f }));
    const { data: categories } = check(await c.from('job_categories').select('id,name').eq('active', true));
    const { data: { user } } = await c.auth.getUser();
    const { data: favorites } = user ? check(await c.from('favorites').select('job_id').eq('user_id', user.id)) : { data: [] };
    const saved = new Set((favorites ?? []).map(x => x.job_id));
    const total = Number(rows?.[0]?.total || 0);
    const jobs = (rows ?? []).map((r: { job: Job }) => r.job).filter(Boolean);
    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) if (typeof v === 'string') raw[k] = v;
    function pageLink(page: number) { return '/jobs?' + new URLSearchParams({ ...raw, page: String(page) }); }
    return <><h1>Найти подработку</h1><Search q={f.q} where={f.where}/><hr className="divider"/><div className="catalog"><CatalogFilters f={f} categories={categories as Option[]}/><section><div className="section-head"><h2>{f.q ? `«${f.q}»` : 'Все объявления'}</h2><span className="count">{total} найдено</span></div>{jobs.length ? jobs.map(job => <JobCard key={job.id} job={job} saved={saved.has(job.id)}/>) : <div className="empty"><h2>Пока ничего не нашли</h2><p>Попробуйте изменить запрос или фильтры.</p></div>}<nav aria-label="Страницы">{f.page > 1 && <Link className="button" href={pageLink(f.page - 1)}>← Назад</Link>}{total > f.page * 20 && <Link className="button" href={pageLink(f.page + 1)}>Дальше →</Link>}</nav><details className="saved-controls"><summary>Сохранить поиск и получать уведомления</summary><ActionForm action={saveSearch} label="Сохранить поиск"><input type="hidden" name="filters" value={JSON.stringify(raw)}/><label>Название<input name="name" required maxLength={100} defaultValue={f.q || 'Мой поиск'} placeholder="Грузчики от 4000"/></label><label className="check"><input type="checkbox" name="notify"/>Уведомлять о новых вакансиях</label><p className="small muted">Push включается отдельно в профиле. Дата «сегодня» сохраняется как конкретная дата.</p></ActionForm></details></section></div></>;
}
