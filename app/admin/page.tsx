import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { check } from '@/lib/service-db';

export default async function Admin() {
    const { client } = await requireAdmin();
    const counts = await Promise.all(['jobs', 'employers', 'profiles', 'orders'].map(async (table) => {
        const { count } = check(await client.from(table).select('id', { count: 'exact', head: true }));
        return { table, count };
    }));
    const [{ data: queue }, { count: moderationCount }, { data: telegramSources }] = await Promise.all([
        client.from('work_queue').select('id,kind,attempts,error').is('done_at', null).order('created_at', { ascending: false }).limit(20),
        client.from('jobs').select('id', { count: 'exact', head: true }).in('status', ['pending_moderation', 'draft']),
        client.from('telegram_sources').select('id,name,username,active,last_error').order('created_at').limit(100),
    ]);
    const activeSources = telegramSources?.filter(s => s.active).length ?? 0;
    const sourceErrors = telegramSources?.filter(s => s.active && s.last_error).length ?? 0;

    return <>
        <h1>Обзор сервиса</h1>
        <div className="data-list">
            {counts.map(x => <div className="data-row row" key={x.table}><b>{{ jobs: 'Вакансии', employers: 'Работодатели', profiles: 'Пользователи', orders: 'Заказы' }[x.table]}</b><span>{x.count}</span></div>)}
            <div className="data-row row"><b>На модерации</b><span>{moderationCount || 0}</span></div>
            <div className="data-row row"><b>Telegram-источники</b><span>{activeSources}{sourceErrors ? ` · ошибок: ${sourceErrors}` : ''}</span></div>
        </div>

        {sourceErrors > 0 && <div className="message error" role="alert" style={{ marginTop: 20 }}>
            <b>Проблемы с Telegram-источниками</b>
            {telegramSources?.filter(s => s.active && s.last_error).map(s => <p key={s.id}><b>{s.name}</b> · @{s.username}: {s.last_error}</p>)}
            <Link href="/admin/telegram" className="button" style={{ marginTop: 8 }}>Открыть Telegram</Link>
        </div>}

        <h2 style={{ marginTop: 32 }}>Очередь обработки</h2>
        <p className="small muted">Последние 20 незавершённых задач. После 8 ошибок требуется разбор и повторный запуск.</p>
        {queue?.length ? queue.map(q => <div className="data-row" key={q.id}>{q.kind} · попыток: {q.attempts}<p>{q.error || 'Ожидает worker'}</p></div>) : <p>Очередь пуста.</p>}

        <div className="row" style={{ marginTop: 20, flexWrap: 'wrap' }}>
            <Link href="/admin/moderation" className="button primary">Проверить объявления{moderationCount ? ` (${moderationCount})` : ''}</Link>
            <Link href="/admin/reparse" className="button">Переразобрать Telegram</Link>
            <Link href="/admin/telegram" className="button">Источники Telegram</Link>
        </div>
    </>;
}
