import Link from 'next/link';
import { db } from '@/lib/db';
import { configured } from '@/lib/env';
import { check } from '@/lib/service-db';
import { Search } from '@/components/search';
import { JobCard } from '@/components/job-card';
import { Setup } from '@/components/setup';
import type { Job, Option } from '@/lib/types';

export const metadata = { alternates: { canonical: '/' } };

function priorityScore(job: Job) {
  const text = `${job.title ?? ''} ${job.description ?? ''} ${job.original_text ?? ''}`.toLowerCase();
  return /\b(ближайш\w*|срочно|сейчас|немедленно)\b/i.test(text) ? 1 : 0;
}

export default async function Home() {
  if (!configured()) return <Setup />;
  const c = await db();
  const { data: categories } = check(await c.from('job_categories').select('id,name').eq('active', true).order('name'));
  const { data: jobs } = check(await c.from('jobs').select('*').eq('status', 'published').gt('expires_at', new Date().toISOString()).order('published_at', { ascending: false }).limit(20));
  const visibleJobs = ((jobs ?? []) as Job[])
    .sort((a, b) => priorityScore(b) - priorityScore(a) || new Date(b.published_at ?? 0).getTime() - new Date(a.published_at ?? 0).getTime())
    .slice(0, 5);

  return <><section className="hero"><span className="eyebrow">Городские объявления · без лишних шагов</span><h1>Подработка в Новосибирске</h1><p className="lead">Найди подработку на сегодня, завтра или на несколько дней.</p><Search /></section><div className="chips" aria-label="Категории">{(categories as Option[]).map(x => <Link className="chip" key={x.id} href={'/jobs?category=' + x.id}>{x.name} ↗</Link>)}</div><div className="row"><Link className="chip" href="/jobs?day=today">Сегодня</Link><Link className="chip" href="/jobs?day=tomorrow">Завтра</Link><Link className="chip" href="/jobs?min=3000">От 3 000 ₽ / смена</Link><Link className="chip" href="/jobs?instant=1">С оплатой сразу</Link><Link className="chip" href="/jobs?employer=1">От работодателя</Link><Link className="chip" href="/jobs?address=1">С адресом</Link></div><div className="section-head"><h2>Свежие объявления</h2><Link href="/jobs">Весь каталог →</Link></div>{visibleJobs.length ? visibleJobs.map(j => <JobCard key={j.id} job={j}/>) : <div className="empty"><h2>Пока нет опубликованных вакансий</h2><p className="muted">Объявления появятся после импорта и проверки. Работодатель может разместить первую вакансию.</p><Link className="button" href="/employer/jobs/new">Разместить вакансию</Link></div>}</>;
}
