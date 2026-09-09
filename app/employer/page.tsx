import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { EmployerForm } from '@/components/employer-form';
import { ActionForm } from '@/components/action-form';
import { createOrder } from '@/app/actions';

export const metadata = { title: 'Кабинет работодателя', robots: { index: false } };

const statuses: Record<string, string> = {
  draft: 'Черновик', pending_moderation: 'На модерации', published: 'Опубликована',
  rejected: 'Отклонена', expired: 'Срок истёк', archived: 'В архиве'
};

const eventLabels: Record<string, string> = {
  view: 'Просмотры', favorite: 'Избранное', phone_click: 'Телефон',
  telegram_click: 'Telegram', email_click: 'Email'
};

export default async function Employer({ searchParams }: { searchParams: Promise<{ page?: string; notice?: string }> }) {
  const params = await searchParams;
  const page = Math.max(1, Math.min(1000, Number(params.page) || 1));
  const { client, user } = await requireUser();
  const { data: e } = check(await client.from('employers').select('*').eq('owner_id', user.id).maybeSingle());
  const { data: cities } = check(await client.from('cities').select('id,name').eq('active', true));

  if (!e) return <section className="panel employer-onboarding">
    <span className="eyebrow">Работодателям</span>
    <h1>Профиль компании</h1>
    <p className="lead">Заполните данные один раз — потом сможете быстро размещать новые смены.</p>
    <div className="hero-points">
      <span><b>01</b>Ваш профиль увидят соискатели</span>
      <span><b>02</b>Вакансии проходят модерацию</span>
      <span><b>03</b>Размещение начинается с бесплатного лимита</span>
    </div>
    <EmployerForm cities={cities!}/>
  </section>;

  const { data: jobs, count } = check(await client.from('jobs').select('*', { count: 'exact' }).eq('employer_id', e.id).order('created_at', { ascending: false }).range((page - 1) * 20, page * 20 - 1));
  const { data: stats } = check(await client.rpc('employer_stats'));
  const { data: products } = check(await client.from('products').select('*').eq('active', true).neq('kind', 'normal'));
  const { data: orders } = check(await client.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20));
  const enabled = process.env.SANDBOX_PAYMENTS_ENABLED === 'true';

  return <>
    <section className="employer-head">
      <div><span className="eyebrow">Кабинет работодателя</span><h1>{e.name}</h1><p className="muted">Управляйте вакансиями и смотрите отклики интереса к ним.</p></div>
      <div className="form-actions"><Link className="button primary" href="/employer/jobs/new">+ Разместить вакансию</Link><Link className="button" href={'/employers/' + e.slug}>Публичная страница</Link></div>
    </section>

    {params.notice === 'submitted' && <p role="status" className="message">Вакансия отправлена на модерацию. Решение появится здесь.</p>}

    <section className="employer-section">
      <div className="section-head"><div><h2>Мои вакансии</h2><p className="muted small">Все размещения в одном месте.</p></div><span className="count">{count || 0} всего</span></div>
      {jobs?.length ? <div className="employer-jobs">{jobs.map(j => {
        const jobStats = eventLabels;
        return <article className="employer-job" key={j.id}>
          <div className="job-top"><div><div className="row"><h3>{j.title}</h3><span className="badge">{statuses[j.status]}</span></div>{j.moderation_reason && <p className="small muted">Причина: {j.moderation_reason}</p>}</div></div>
          <div className="employer-job-actions">{j.status === 'published' ? <Link className="button" href={'/jobs/' + j.id}>Открыть</Link> : <Link className="button" href={'/jobs/' + j.id + '/preview'}>Предпросмотр</Link>}{['draft', 'rejected'].includes(j.status) && <Link className="button" href={'/jobs/' + j.id + '/edit'}>Изменить</Link>}</div>
          <div className="employer-stats">{Object.entries(jobStats).map(([type, label]) => <span key={type}><b>{stats?.find((s: { job_id: string; event_type: string; event_count: number }) => s.job_id === j.id && s.event_type === type)?.event_count || 0}</b> {label.toLowerCase()}</span>)}</div>
        </article>;
      })}</div> : <div className="empty employer-empty"><h2>Здесь пока пусто</h2><p>Создайте первую вакансию — она появится в списке после отправки на модерацию.</p><Link className="button primary" href="/employer/jobs/new">Создать вакансию</Link></div>}
      <nav className="pagination" aria-label="Страницы">{page > 1 && <Link className="button" href={'?page=' + (page - 1)}>← Назад</Link>}{(count || 0) > page * 20 && <Link className="button" href={'?page=' + (page + 1)}>Дальше →</Link>}</nav>
    </section>

    <section className="employer-section">
      <div className="section-head"><div><h2>Продвижение</h2><p className="muted small">Дополнительные возможности для опубликованных вакансий.</p></div></div>
      <p className="message">{enabled ? 'Тестовый режим: реальные деньги не списываются.' : 'Покупки пока отключены. Бесплатное размещение доступно в рамках лимита.'}</p>
      {products?.map(p => <details className="product-card" key={p.id}><summary><b>{p.name}</b><span>{(p.price_kopecks / 100).toLocaleString('ru-RU')} ₽ · {p.days} дн.</span></summary><ActionForm action={createOrder} label="Создать тестовый заказ" disabled={!enabled}><input type="hidden" name="product_id" value={p.id}/><input type="hidden" name="idempotency_key" value={crypto.randomUUID()}/>{['boost', 'highlight', 'vip'].includes(p.kind) ? <label>Опубликованная вакансия<select name="job_id" required>{jobs?.filter(j => j.status === 'published').map(j => <option key={j.id} value={j.id}>{j.title}</option>)}</select></label> : <p>Количество размещений: {p.placements}. Срок использования: {p.days} дней.</p>}</ActionForm></details>)}
    </section>

    <section className="employer-section"><div className="section-head"><div><h2>Последние заказы</h2><p className="muted small">История операций кабинета.</p></div></div>{orders?.length ? orders.map(o => <div className="data-row" key={o.id}><Link href={'/orders/' + o.id}>{o.product_snapshot.name}: {o.amount / 100} ₽ · {o.status}</Link></div>) : <p className="muted">Заказов пока нет.</p>}</section>
    <details className="employer-edit"><summary>Изменить профиль компании</summary><EmployerForm cities={cities!} employer={e}/></details>
  </>;
}
