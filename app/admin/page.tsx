import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { check } from '@/lib/service-db';

export default async function Admin() {
    const { client } = await requireAdmin();
    const counts = await Promise.all(['jobs', 'employers', 'profiles', 'orders'].map(async (table) => {
        const { count } = check(await client.from(table).select('id', { count: 'exact', head: true }));
        return { table, count };
    }));
    const [{ data: queue }, { count: moderationCount }] = await Promise.all([
        client.from('work_queue').select('id,kind,attempts,error').is('done_at', null).order('created_at', { ascending: false }).limit(20),
        client.from('jobs').select('id', { count: 'exact', head: true }).in('status', ['pending_moderation', 'draft']),
    ]);

    return <>
        <h1>Обзор сервиса</h1>
        <div className="data-list">
            {counts.map(x => <div className="data-row row" key={x.table}><b>{{ jobs: 'Вакансии', employers: 'Работодатели', profiles: 'Пользователи', orders: 'Заказы' }[x.table]}</b><span>{x.count}</span></div>)}
            <div className="data-row row"><b>На модерации</b><span>{moderationCount || 0}</span></div>
        </div>

        <h2 style={{ marginTop: 32 }}>Очередь обработки</h2>
        <p className="small muted">Последние 20 незавершённых задач. После 8 ошибок требуется разбор и повторный запуск.</p>
        {queue?.length ? queue.map(q => <div className="data-row" key={q.id}>{q.kind} · попыток: {q.attempts}<p>{q.error || 'Ожидает worker'}</p></div>) : <p>Очередь пуста.</p>}

        <div className="row" style={{ marginTop: 20, flexWrap: 'wrap' }}>
            <Link href="/admin/moderation" className="button primary">Проверить объявления{moderationCount ? ` (${moderationCount})` : ''}</Link>
            <Link href="/admin/reparse" className="button">Переразобрать Telegram</Link>
        </div>
    </>;
}
