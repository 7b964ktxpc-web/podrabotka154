import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { JobCard } from '@/components/job-card';
import { ActionForm } from '@/components/action-form';
import { submitJob } from '@/app/actions';
import type { Job } from '@/lib/types';

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return <li style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}><span aria-hidden>{ok ? '✓' : '!'}</span><span>{children}</span></li>;
}

export default async function Preview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { client, user } = await requireUser();
  const { data: j } = check(await client.from('jobs').select('*').eq('id', id).maybeSingle());
  if (!j) notFound();
  const { data: e } = await client.from('employers').select('owner_id').eq('id', j.employer_id).maybeSingle();
  const { data: p } = await client.from('profiles').select('roles').eq('id', user.id).single();
  if (e?.owner_id !== user.id && !p?.roles.includes('admin')) notFound();

  const job = j as Job;
  const hasContact = Boolean(j.contact_phone || j.contact_telegram || j.contact_email);
  const hasPay = j.salary_min != null || j.salary_max != null || j.payment_type;
  const hasSchedule = Boolean(j.date_start || j.time_start || j.date_end || j.time_end);
  const canSubmit = ['draft', 'rejected'].includes(j.status);

  return <section className="panel">
    <p className="eyebrow">Предпросмотр · ещё не опубликовано</p>
    <h1>Проверьте вакансию перед отправкой</h1>
    <p className="lead">Так её увидит кандидат после публикации. Если всё заполнено верно — отправляйте на модерацию.</p>

    <div className="panel" style={{ margin: '20px 0', display: 'grid', gap: 8 }}>
      <strong>Проверка заполнения</strong>
      <ul style={{ margin: 0, paddingLeft: 22, display: 'grid', gap: 6 }}>
        <Check ok={Boolean(j.title && j.description)}>Название и подробное описание заполнены</Check>
        <Check ok={hasPay}>Указана оплата или порядок выплаты</Check>
        <Check ok={hasContact}>Указан хотя бы один контакт</Check>
        <Check ok={Boolean(j.address_raw)}>Указан адрес <span className="muted">(необязательно, но поможет кандидату найти место)</span></Check>
        <Check ok={hasSchedule}>Указана дата или время работы <span className="muted">(если известно)</span></Check>
      </ul>
    </div>

    <JobCard job={job} preview />
    <h2>Описание</h2>
    <p style={{ whiteSpace: 'pre-wrap' }}>{j.description}</p>
    <h2>Контакты</h2>
    <p>{[j.contact_phone, j.contact_telegram, j.contact_email].filter(Boolean).join(' · ') || 'Не указаны'}</p>
    {j.moderation_reason && <p className="message">Комментарий модератора: {j.moderation_reason}</p>}

    <div className="form-actions"><Link className="button" href={'/jobs/' + id + '/edit'}>Изменить</Link></div>
    <hr className="divider" />
    {e?.owner_id === user.id ? <ActionForm action={submitJob} label="Отправить на модерацию" disabled={!canSubmit}>
      <input type="hidden" name="id" value={id} />
      {!canSubmit && <p className="small muted">Сейчас ваканция имеет статус «{j.status}» и уже не может быть повторно отправлена.</p>}
      {canSubmit && <p className="small muted">Администратор проверит объявление. Публикация не происходит автоматически.</p>}
    </ActionForm> : <Link className="button" href="/admin/moderation">Перейти к модерации</Link>}
  </section>;
}
