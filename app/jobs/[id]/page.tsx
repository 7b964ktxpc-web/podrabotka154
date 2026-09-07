import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { db } from '@/lib/db';
import { check } from '@/lib/service-db';
import { salaryLabel } from '@/lib/domain';
import { Address } from '@/components/job-card';
import { Contact, Favorite, Share, ViewEvent } from '@/components/job-interactions';
import type { Job } from '@/lib/types';
import { appUrl } from '@/lib/env';
async function load(id: string) { if (!/^[0-9a-f-]{36}$/i.test(id))
    notFound(); const c = await db(); const { data } = check(await c.from('jobs').select('*').eq('id', id).eq('status', 'published').gt('expires_at', new Date().toISOString()).maybeSingle()); if (!data)
    notFound(); return data as Job; }
export async function generateMetadata({ params }: {
    params: Promise<{
        id: string;
    }>;
}) { const { id } = await params; const j = await load(id); return { title: j.title, description: j.description.slice(0, 155), alternates: { canonical: '/jobs/' + id }, openGraph: { title: j.title, description: j.description.slice(0, 155), url: '/jobs/' + id } }; }
export default async function Detail({ params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    const j = await load(id);
    const c = await db();
    const { data: { user } } = await c.auth.getUser();
    const { data: f } = user ? await c.from('favorites').select('job_id').eq('user_id', user.id).eq('job_id', id).maybeSingle() : { data: null };
    const { data: e } = j.employer_id ? check(await c.from('employers').select('*').eq('id', j.employer_id).maybeSingle()) : { data: null };
    const { data: sources } = check(await c.from('job_sources').select('source_url').eq('job_id', id));
    const phone = j.contact_phone && /^\+?[\d ()-]{7,24}$/.test(j.contact_phone) ? j.contact_phone : null;
    const tg = j.contact_telegram && /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(j.contact_telegram) ? j.contact_telegram : null;
    const email = j.contact_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(j.contact_email) ? j.contact_email : null;
    const structured = e && j.address_raw ? { '@context': 'https://schema.org', '@type': 'JobPosting', title: j.title, description: j.description, datePosted: j.published_at, validThrough: j.expires_at, hiringOrganization: { '@type': 'Organization', name: e.name }, jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: j.city, streetAddress: j.address_raw, addressCountry: 'RU' } } } : null;
    return <><ViewEvent id={id}/>{structured && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replace(/</g, '\\u003c') }}/>}<Link href="/jobs" className="muted small">← К объявлениям</Link><div className="detail"><article><p className="eyebrow">{j.source_type === 'employer' ? 'От работодателя' : 'Источник: ' + (j.source_type === 'telegram' ? 'Telegram' : 'редакция')}</p><h1>{j.title}</h1><p className="salary">{salaryLabel(j)}</p><div className="meta"><span>Дата: {j.date_start || 'не указана'}{j.date_end ? ' по ' + j.date_end : ''}</span><span>Время: {j.time_start?.slice(0, 5) || 'не указано'}{j.time_end ? ' - ' + j.time_end.slice(0, 5) : ''}</span></div><hr className="divider"/><h2>Что нужно делать</h2><p className="description">{j.description}</p>{j.photo_url && /^https:\/\//.test(j.photo_url) && <Image className="job-image" src={j.photo_url} alt="Фото из объявления" width={760} height={420} unoptimized/>}<hr className="divider"/><h2>Место работы</h2><Address job={j}/>{e && <p>Работодатель: <Link href={'/employers/' + e.slug}>{e.name}</Link></p>}<p className="small muted">Опубликовано: {new Date(j.published_at!).toLocaleDateString('ru-RU')}</p><div className="row">{(sources?.length ? sources : j.source_url ? [{ source_url: j.source_url }] : []).filter(x => /^https:\/\/t\.me\//.test(x.source_url)).map(x => <a key={x.source_url} className="small" href={x.source_url} target="_blank" rel="noopener noreferrer">Оригинал в Telegram ↗</a>)}</div>{j.original_text && <details><summary>Оригинальный текст объявления</summary><p className="description">{j.original_text}</p></details>}</article><aside className="aside"><h2>Связаться напрямую</h2><p className="small muted">Уточните, актуальна ли вакансия, и договоритесь об условиях.</p>{phone && <Contact id={id} type="phone_click" href={'tel:' + phone.replace(/[^+\d]/g, '')}>Позвонить</Contact>}{tg && <Contact id={id} type="telegram_click" href={'https://t.me/' + tg}>Написать в Telegram</Contact>}{email && <Contact id={id} type="email_click" href={'mailto:' + encodeURIComponent(email)}>Написать на email</Contact>}{!phone && !tg && !email && <p>Прямые контакты не указаны. Проверьте оригинал объявления.</p>}<hr className="divider"/><div className="row"><Favorite id={id} initial={Boolean(f)}/><span>Сохранить</span></div><p><Share id={id} title={j.title}/></p><p className="small muted">Не переводите деньги за доступ к работе.</p></aside></div></>;
}
