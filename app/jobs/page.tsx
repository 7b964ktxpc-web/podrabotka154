import Link from 'next/link';
import { db } from '@/lib/db';
import { check } from '@/lib/service-db';
import { configured } from '@/lib/env';
import { isPriorityJobText, readFilters } from '@/lib/domain';
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
    const params = await searchParams;
    const f = readFilters(params);
    const c = await db();
    const { data: rows } = check(await c.rpc('search_jobs', { f }));
    const { data: categories } = check(await c.from('job_categories').select('id,name').eq('active', true));
    const { data: { user } } = await c.auth.getUser();
    const { data: favorites } = user ? check(await c.from('favorites').select('job_id').eq('user_id', user.id)) : { data: [] };
    const saved = new Set((favorites ?? []).map(x => x.job_id));
    const total = Number(rows?.[0]?.total || 0);
    const orderedRows = [...(rows ?? [])].sort((a: { job: Job }, b: { job: Job }) => {
        const ap = isPriorityJobText(a.job.original_text || a.job.description || a.job.title) ? 1 : 0;
        const bp = isPriorityJobText(b.job.original_text || b.job.description || b.job.title) ? 1 : 0;
        return bp - ap;
    });
    const raw: Record<string, string> = {};
    for (const [k, v] of Object.entries(params)) if (typeof v === 'string') raw[k] = v;
    function pageLink(page: number) { return '/jobs?' + new URLSearchParams({ ...raw, page: String(page) }); }
    const hasFilters = Boolean(f.q || f.where || f.category || f.min || f.day || f.payment || f.employment || f.instant || f.employer || f.address);

    return <>
        <div className="hero">
            <p className="eyebrow">Каталог подработки</p>
            <h1>Найти подработку</h1>
            <p className="lead">Свежие объявления в Новосибирске — с оплатой, адресом и временем выхода.</p>
            <Link className="button primary" href="/jobs/new">+ Разместить вакансию</Link>
        </div>
        <Search q={f.q} where={f.where}/>
        <div className="catalog-summary"><span><b>{total}</b> {total === 1 ? 'объявление' : total >= 2 && total <= 4 ? 'объявления' : 'объявлений'}</span>{hasFilters && <Link href="/jobs">Сбросить фильтры</Link>}</div>
        <div className="catalog">
            <CatalogFilters f={f} categories={categories as Option[]}/>
            <section aria-label="Список вакансий">
                <div className="section-head"><h2>{f.q ? `«${f.q}»` : 'Все объявления'}</h2><span className="count">страница {f.page}</span></div>
                {orderedRows.length ? orderedRows.map((r: { job: Job }) => <JobCard key={r.job.id} job={r.job} saved={saved.has(r.job.id)}/>) : <div className="empty"><h2>Пока ничего не нашли</h2><p>Попробуйте изменить запрос, выбрать другую дату или убрать часть фильтров.</p><div className="form-actions"><Link className="button primary" href="/jobs">Показать все</Link><Link className="button" href="/jobs/new">Разместить вакансию</Link></div></div>}
                <nav className="pagination" aria-label="Страницы">{f.page > 1 && <Link className="button" href={pageLink(f.page - 1)}>← Назад</Link>}{total > f.page * 20 && <Link className="button primary" href={pageLink(f.page + 1)}>Дальше →</Link>}</nav>
                <details className="saved-controls"><summary>Сохранить поиск и получать уведомления</summary><ActionForm action={saveSearch} label="Сохранить поиск"><input type="hidden" name="filters" value={JSON.stringify(raw)}/><label>Название<input name="name" required maxLength={100} defaultValue={f.q || 'Мой поиск'} placeholder="Грузчики от 4000"/></label><label className="check"><input type="checkbox" name="notify"/>Уведомлять о новых вакансиях</label><p className="small muted">Push включается отдельно в профиле. Дата «сегодня» сохраняется как конкретная дата.</p></ActionForm></details>
            </section>
        </div>
    </>;
}
