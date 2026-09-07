import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { ActionForm } from '@/components/action-form';
import { setRoles, retryWork, deleteSource } from '../actions';
const sections: Record<string, {
    title: string;
    table: string;
    order: string;
}> = { jobs: { title: 'Вакансии', table: 'jobs', order: 'created_at' }, users: { title: 'Пользователи', table: 'profiles', order: 'created_at' }, employers: { title: 'Работодатели', table: 'employers', order: 'created_at' }, payments: { title: 'Платежи', table: 'payments', order: 'created_at' }, promotions: { title: 'Продвижение', table: 'job_promotions', order: 'starts_at' }, subscriptions: { title: 'Права размещения и подписки', table: 'employer_subscriptions', order: 'starts_at' }, analytics: { title: 'События вакансий', table: 'job_events', order: 'created_at' }, logs: { title: 'Очередь и ошибки', table: 'work_queue', order: 'created_at' }, audit: { title: 'Журнал администратора', table: 'admin_logs', order: 'created_at' }, sources: { title: 'Удаление пустых источников', table: 'telegram_sources', order: 'created_at' } };
export default async function Section({ params, searchParams }: {
    params: Promise<{
        section: string;
    }>;
    searchParams: Promise<{
        page?: string;
    }>;
}) { const { section } = await params; const config = sections[section]; if (!config)
    notFound(); const page = Math.max(1, Math.min(1000, Number((await searchParams).page) || 1)); const { client } = await requireAdmin(); const { data: rows, count } = check(await client.from(config.table).select('*', { count: 'exact' }).order(config.order, { ascending: false }).range((page - 1) * 50, page * 50 - 1)); return <><h1>{config.title}</h1><p className="small muted">Всего записей: {count}. По 50 на страницу.</p>{section === 'logs' && <Link className="button" href="/admin/audit">Журнал действий администратора →</Link>}{rows?.length ? rows.map(row => <details key={row.id}><summary>{row.title || row.name || row.display_name || row.kind || row.type || row.action || 'Запись'} · {row.status || row.created_at || row.starts_at}</summary><div className="data-row"><pre>{JSON.stringify(row, null, 2)}</pre></div>{section === 'jobs' && <Link className="button" href={'/jobs/' + row.id + '/edit'}>Открыть редактор</Link>}{section === 'employers' && <Link className="button" href={'/employers/' + row.slug}>Открыть компанию</Link>}{section === 'users' && <ActionForm action={setRoles} label="Изменить роли"><input type="hidden" name="id" value={row.id}/><label className="check"><input name="employer" type="checkbox" defaultChecked={row.roles.includes('employer')}/>Работодатель</label><label className="check"><input name="admin" type="checkbox" defaultChecked={row.roles.includes('admin')}/>Администратор</label></ActionForm>}{section === 'logs' && !row.done_at && row.error && <ActionForm action={retryWork} label="Повторить обработку"><input type="hidden" name="id" value={row.id}/><p>Сначала устраните причину ошибки.</p></ActionForm>}{section === 'sources' && <ActionForm action={deleteSource} label="Удалить пустой источник"><input type="hidden" name="id" value={row.id}/><label className="check"><input type="checkbox" name="confirm" required/>Подтверждаю удаление источника без сообщений</label></ActionForm>}</details>) : <p>Пока нет записей.</p>}<nav>{page > 1 && <Link href={'?page=' + (page - 1)}>← Назад</Link>}{(count || 0) > page * 50 && <Link href={'?page=' + (page + 1)}>Дальше →</Link>}</nav></>; }
