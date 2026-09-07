import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { JobCard, Address } from '@/components/job-card';
import { ActionForm } from '@/components/action-form';
import { submitJob } from '@/app/actions';
import type { Job } from '@/lib/types';
export default async function Preview({ params }: {
    params: Promise<{
        id: string;
    }>;
}) { const { id } = await params; const { client, user } = await requireUser(); const { data: j } = check(await client.from('jobs').select('*').eq('id', id).maybeSingle()); if (!j)
    notFound(); const { data: e } = await client.from('employers').select('owner_id').eq('id', j.employer_id).maybeSingle(); const { data: p } = await client.from('profiles').select('roles').eq('id', user.id).single(); if (e?.owner_id !== user.id && !p?.roles.includes('admin'))
    notFound(); return <section className="panel"><p className="eyebrow">Предпросмотр · ещё не опубликовано</p><h1>Всё верно?</h1><JobCard job={j as Job} preview/><h2>Описание</h2><p style={{ whiteSpace: 'pre-wrap' }}>{j.description}</p><p className="small muted">Контакты: {[j.contact_phone, j.contact_telegram, j.contact_email].filter(Boolean).join(' · ') || 'не указаны'}</p><div className="form-actions"><Link className="button" href={'/jobs/' + id + '/edit'}>Изменить</Link></div><hr className="divider"/>{e?.owner_id === user.id ? <ActionForm action={submitJob} label="Отправить на публикацию" disabled={!['draft', 'rejected'].includes(j.status)}><input type="hidden" name="id" value={id}/><p>После отправки объявление проверит администратор. Текущий статус: {j.status}.</p></ActionForm> : <Link className="button" href="/admin/moderation">Перейти к модерации</Link>}</section>; }
