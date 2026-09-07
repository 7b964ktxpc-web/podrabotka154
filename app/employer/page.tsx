import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { EmployerForm } from '@/components/employer-form';
import { ActionForm } from '@/components/action-form';
import { createOrder } from '@/app/actions';
export const metadata = { title: 'Кабинет работодателя', robots: { index: false } };
const statuses: Record<string, string> = { draft: 'Черновик', pending_moderation: 'На модерации', published: 'Опубликована', rejected: 'Отклонена', expired: 'Срок истёк', archived: 'В архиве' };
export default async function Employer({ searchParams }: {
    searchParams: Promise<{
        page?: string;
        notice?: string;
    }>;
}) {
    const params = await searchParams;
    const page = Math.max(1, Math.min(1000, Number(params.page) || 1));
    const { client, user } = await requireUser();
    const { data: e } = check(await client.from('employers').select('*').eq('owner_id', user.id).maybeSingle());
    const { data: cities } = check(await client.from('cities').select('id,name').eq('active', true));
    if (!e)
        return <section className="panel"><h1>Профиль работодателя</h1><p className="lead">Отдельный аккаунт не нужен. Заполните данные компании и переходите к размещению.</p><EmployerForm cities={cities!}/></section>;
    const { data: jobs, count } = check(await client.from('jobs').select('*', { count: 'exact' }).eq('employer_id', e.id).order('created_at', { ascending: false }).range((page - 1) * 20, page * 20 - 1));
    const { data: stats } = check(await client.rpc('employer_stats'));
    const { data: products } = check(await client.from('products').select('*').eq('active', true).neq('kind', 'normal'));
    const { data: orders } = check(await client.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20));
    const enabled = process.env.SANDBOX_PAYMENTS_ENABLED === 'true';
    return <><h1>{e.name}</h1><div className="row"><Link className="button primary" href="/employer/jobs/new">+ Разместить вакансию</Link><Link className="button" href={'/employers/' + e.slug}>Публичная страница</Link></div>{params.notice === 'submitted' && <p role="status" className="message">Вакансия отправлена на модерацию. Решение появится в кабинете.</p>}<hr className="divider"/><h2>Мои вакансии</h2>{jobs?.length ? jobs.map(j => <div className="data-row" key={j.id}><div className="row"><h3>{j.title}</h3><span className="badge">{statuses[j.status]}</span></div>{j.moderation_reason && <p className="small muted">{j.moderation_reason}</p>}<div className="row">{j.status === 'published' ? <Link href={'/jobs/' + j.id}>Открыть →</Link> : <Link href={'/jobs/' + j.id + '/preview'}>Предпросмотр →</Link>}{['draft', 'rejected'].includes(j.status) && <Link href={'/jobs/' + j.id + '/edit'}>Изменить</Link>}</div><p className="small muted">{['view', 'favorite', 'phone_click', 'telegram_click', 'email_click'].map(t => ({ view: 'Просмотры', favorite: 'Добавления в избранное', phone_click: 'Телефон', telegram_click: 'Telegram', email_click: 'Email' }[t] + ': ' + (stats?.find((s: {
        job_id: string;
        event_type: string;
        event_count: number;
    }) => s.job_id === j.id && s.event_type === t)?.event_count || 0))).join(' · ')}</p></div>) : <p>Вы ещё не разместили вакансии.</p>}<nav>{page > 1 && <Link href={'?page=' + (page - 1)}>← Назад</Link>}{(count || 0) > page * 20 && <Link href={'?page=' + (page + 1)}>Дальше →</Link>}</nav><hr className="divider"/><h2>Продвижение и пакеты</h2><p className="message">{enabled ? 'Тестовый режим. Реальные деньги не списываются. Тестовый платёж подтверждает администратор через серверный скрипт.' : 'Покупки отключены, пока не подключён платёжный провайдер. Бесплатное размещение доступно в рамках лимита.'}</p>{products?.map(p => <details key={p.id}><summary>{p.name} · {(p.price_kopecks / 100).toLocaleString('ru-RU')} ₽ · {p.days} дн.</summary><ActionForm action={createOrder} label="Создать тестовый заказ" disabled={!enabled}><input type="hidden" name="product_id" value={p.id}/><input type="hidden" name="idempotency_key" value={crypto.randomUUID()}/>{['boost', 'highlight', 'vip'].includes(p.kind) ? <label>Опубликованная вакансия<select name="job_id" required>{jobs?.filter(j => j.status === 'published').map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select></label> : <p>Количество размещений: {p.placements}. Срок использования: {p.days} дней.</p>}</ActionForm></details>)}<h2 style={{ marginTop: 32 }}>Последние заказы</h2>{orders?.length ? orders.map(o => <div className="data-row" key={o.id}><Link href={'/orders/' + o.id}>{o.product_snapshot.name}: {o.amount / 100} ₽ · {o.status}</Link></div>) : <p>Заказов пока нет.</p>}<details><summary>Изменить профиль компании</summary><EmployerForm cities={cities!} employer={e}/></details></>;
}
