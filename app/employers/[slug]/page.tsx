import { notFound } from 'next/navigation';
import Image from 'next/image';
import { db } from '@/lib/db';
import { check } from '@/lib/service-db';
import { JobCard } from '@/components/job-card';
import type { Job } from '@/lib/types';
export async function generateMetadata({ params }: {
    params: Promise<{
        slug: string;
    }>;
}) { const { slug } = await params; const c = await db(); const { data: e } = await c.from('employers').select('name,description').eq('slug', slug).maybeSingle(); return { title: e?.name || 'Работодатель', description: e?.description?.slice(0, 155), alternates: { canonical: '/employers/' + slug } }; }
export default async function PublicEmployer({ params, searchParams }: {
    params: Promise<{
        slug: string;
    }>;
    searchParams: Promise<{
        page?: string;
    }>;
}) { const { slug } = await params; const page = Math.max(1, Math.min(1000, Number((await searchParams).page) || 1)); const c = await db(); const { data: e } = check(await c.from('employers').select('*').eq('slug', slug).maybeSingle()); if (!e)
    notFound(); const { data: jobs, count } = check(await c.from('jobs').select('*', { count: 'exact' }).eq('employer_id', e.id).eq('status', 'published').gt('expires_at', new Date().toISOString()).order('published_at', { ascending: false }).range((page - 1) * 20, page * 20 - 1)); return <>{e.logo_url && /^https:\/\//.test(e.logo_url) && <Image src={e.logo_url} alt="Логотип компании" width={80} height={80} unoptimized/>}<h1>{e.name}</h1><p style={{ whiteSpace: 'pre-wrap' }}>{e.description}</p><p>{e.contact_person}</p><div className="row">{e.contact_phone && /^\+?[\d ()-]{7,24}$/.test(e.contact_phone) && <a className="button" href={'tel:' + e.contact_phone.replace(/[^+\d]/g, '')}>Позвонить</a>}{e.contact_telegram && /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(e.contact_telegram) && <a className="button" href={'https://t.me/' + e.contact_telegram} target="_blank" rel="noopener noreferrer">Telegram ↗</a>}{e.website && /^https:\/\//.test(e.website) && <a className="button" href={e.website} target="_blank" rel="noopener noreferrer">Сайт ↗</a>}</div><hr className="divider"/><h2>Активные вакансии</h2>{jobs?.length ? (jobs as Job[]).map(j => <JobCard key={j.id} job={j}/>) : <p>Сейчас нет активных вакансий.</p>}<nav>{page > 1 && <a href={'?page=' + (page - 1)}>← Назад</a>}{(count || 0) > page * 20 && <a href={'?page=' + (page + 1)}>Дальше →</a>}</nav></>; }
