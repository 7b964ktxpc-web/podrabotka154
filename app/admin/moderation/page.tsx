import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { ActionForm } from '@/components/action-form';
import { BulkModeration } from '@/components/bulk-moderation';
import { moderateJob } from '@/app/actions';
import { employmentLabel, paymentLabel, salaryLabel } from '@/lib/domain';

function value(v: unknown) { return v === null || v === undefined || v === '' ? '—' : String(v); }

function reviewState(job: { title?: string | null; address_raw?: string | null; contact_phone?: string | null; contact_telegram?: string | null; salary_min?: number | null; salary_max?: number | null; date_start?: string | null; time_start?: string | null; ai_confidence?: number | null; }) {
    const missing: string[] = [];
    if (!job.title?.trim()) missing.push('название');
    if (!job.address_raw?.trim()) missing.push('адрес');
    if (!job.contact_phone && !job.contact_telegram) missing.push('контакт');
    if (job.salary_min == null && job.salary_max == null) missing.push('оплата');
    if (!job.date_start) missing.push('дата');
    if (!job.time_start) missing.push('время');
    const confidence = typeof job.ai_confidence === 'number' ? Math.round(job.ai_confidence * 100) : null;
    return { missing, confidence };
}

export default async function Moderation({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    const page = Math.max(1, Math.min(1000, Number((await searchParams).page) || 1));
    const { client } = await requireAdmin();
    const { data: jobs, count } = check(await client.from('jobs').select('*,employers(name)', { count: 'exact' }).in('status', ['pending_moderation', 'draft']).order('created_at', { ascending: false }).range((page - 1) * 20, page * 20 - 1));
    return <>
        <div className="row" style={{justifyContent:'space-between',alignItems:'end',gap:12,marginBottom:18}}>
            <div><span className="eyebrow">Контроль публикаций</span><h1 style={{marginBottom:6}}>Модерация</h1><p className="muted" style={{margin:0}}>Проверьте источник, оплату, адрес, дату и контакт перед публикацией.</p></div>
            <span className="badge">{count || 0} на проверке</span>
        </div>
        {jobs?.length ? <>
            <BulkModeration jobs={jobs.map(j => ({ id: j.id, title: j.title || 'Без названия' }))} />
            {jobs.map(j => {
                const review = reviewState(j);
                const title = j.title || 'Без названия';
                return <details key={j.id} open>
                    <summary>{title} · {j.status}</summary>
                    <p className="small muted">Работодатель: {j.employers?.name || 'Не указан'} · confidence: {review.confidence === null ? 'не применяется' : `${review.confidence}%`} · {new Date(j.created_at).toLocaleString('ru-RU')}</p>
                    {review.missing.length > 0 && <p className="message" role="status">⚠️ Перед публикацией проверьте: {review.missing.join(', ')}.</p>}
                    <div className="panel" style={{ margin: '12px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
                        <div><strong>Оплата</strong><br />{salaryLabel(j)}</div>
                        <div><strong>Способ оплаты</strong><br />{paymentLabel(j.payment_type) || '—'}</div>
                        <div><strong>Занятость</strong><br />{employmentLabel(j.employment_type) || '—'}</div>
                        <div><strong>Адрес</strong><br />{value(j.address_raw)}</div>
                        <div><strong>Карта</strong><br />{j.map_url ? <a className="button" href={j.map_url} target="_blank" rel="noopener noreferrer">Открыть карту ↗</a> : 'Ссылка не добавлена'}</div>
                        <div><strong>Дата</strong><br />{value(j.date_start)}</div>
                        <div><strong>Время</strong><br />{j.time_start || j.time_end ? `${j.time_start ? `с ${j.time_start}` : ''}${j.time_start && j.time_end ? ' ' : ''}${j.time_end ? `до ${j.time_end}` : ''}` : '—'}</div>
                        <div><strong>Телефон</strong><br />{value(j.contact_phone)}</div>
                        <div><strong>Telegram</strong><br />{value(j.contact_telegram)}</div>
                    </div>
                    <div className="row" style={{flexWrap:'wrap',margin:'10px 0'}}>
                        {j.source_url && <a className="button" href={j.source_url} target="_blank" rel="noopener noreferrer">Оригинал в Telegram ↗</a>}
                        {j.source_message_id && <span className="badge">Источник привязан</span>}
                    </div>
                    <p className="message">{j.moderation_reason || 'Ручная проверка'}</p>
                    <p style={{ whiteSpace: 'pre-wrap' }}>{j.original_text || j.description}</p>
                    <p><Link className="button" href={'/jobs/' + j.id + '/edit'}>Проверить и исправить поля</Link></p>
                    <ActionForm action={moderateJob} label="Применить решение">
                        <input type="hidden" name="id" value={j.id}/>
                        <label>Решение<select name="status" defaultValue="draft"><option value="draft">Запросить изменения, вернуть в черновик</option><option value="published">Опубликовать</option><option value="rejected">Отклонить</option><option value="archived">Архивировать</option></select></label>
                        <label>Причина<textarea name="reason" maxLength={1000} placeholder="Что нужно исправить или почему принято решение"/></label>
                    </ActionForm>
                </details>;
            })}
        </> : <div className="empty"><h2>Очередь пуста</h2><p className="muted">Новых объявлений на ручную проверку нет.</p></div>}
        <nav>{page > 1 && <Link href={'?page=' + (page - 1)}>← Назад</Link>}{(count || 0) > page * 20 && <Link href={'?page=' + (page + 1)}>Дальше →</Link>}</nav>
    </>;
}
