import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { check } from '@/lib/service-db';

export default async function Admin() {
  const { client } = await requireAdmin();
  const tables = await Promise.all(
    ['jobs', 'employers', 'profiles', 'orders'].map(async (table) => {
      const { count } = check(await client.from(table).select('id', { count: 'exact', head: true }));
      return { table, count };
    }),
  );
  const { count: pendingCount } = check(
    await client.from('jobs').select('id', { count: 'exact', head: true }).in('status', ['pending_moderation', 'draft']),
  );
  const { data: queue } = check(
    await client.from('work_queue').select('id,kind,attempts,error').is('done_at', null).order('created_at', { ascending: false }).limit(20),
  );

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">Администрирование</p>
          <h1>Обзор сервиса</h1>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <Link href="/api/telegram/import-public" className="button">Импорт Telegram ↻</Link>
          <Link href="/admin/moderation" className="button primary">
            Модерация{pendingCount ? ` · ${pendingCount}` : ''}
          </Link>
        </div>
      </div>

      <div className="data-list">
        {tables.map((x) => (
          <div className="data-row row" key={x.table}>
            <b>{{ jobs: 'Вакансии', employers: 'Работодатели', profiles: 'Пользователи', orders: 'Заказы' }[x.table]}</b>
            <span>{x.count}</span>
          </div>
        ))}
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0 }}>Очередь обработки</h2>
            <p className="small muted">Незавершённые задачи worker.</p>
          </div>
          <span className="badge">{queue?.length || 0}</span>
        </div>
        {queue?.length ? queue.map((q) => (
          <div className="data-row" key={q.id}>
            <b>{q.kind}</b> · попыток: {q.attempts}
            <p className="small">{q.error || 'Ожидает worker'}</p>
          </div>
        )) : <p>Очередь пуста.</p>}
      </section>
    </>
  );
}
