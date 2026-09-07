import Link from 'next/link';
import type { Job } from '@/lib/types';
import { salaryLabel } from '@/lib/domain';
import { build2GisUrl, buildYandexMapsUrl, fullAddress } from '@/lib/maps';
import { Favorite } from './job-interactions';
export function Address({ job }: {
    job: Pick<Job, 'city' | 'address_raw' | 'address_normalized'>;
}) { const address = fullAddress(job.city, job.address_normalized || job.address_raw); return <><p className="address">📍 {address || 'Адрес не указан'}</p>{address && <div className="map-links"><a href={build2GisUrl(address)} target="_blank" rel="noopener noreferrer">Открыть в 2ГИС ↗</a><a href={buildYandexMapsUrl(address)} target="_blank" rel="noopener noreferrer">Яндекс Карты ↗</a></div>}</>; }
export function JobCard({ job, saved = false, preview = false }: {
    job: Job;
    saved?: boolean;
    preview?: boolean;
}) { return <article className={'job' + ((job.commercial || 0) >= 2 ? ' highlight' : '')}><div className="job-top"><div><p className="small muted">{job.source_type === 'employer' ? 'От работодателя' : job.source_type === 'telegram' ? 'Источник: Telegram' : 'Объявление редакции'}</p><h2>{preview ? job.title : <Link href={'/jobs/' + job.id}>{job.title}</Link>}</h2></div>{!preview && <Favorite id={job.id} initial={saved}/>}</div><p className="salary">{salaryLabel(job)}</p><Address job={job}/><div className="meta"><span>📅 {job.date_start ? new Date(job.date_start + 'T12:00:00Z').toLocaleDateString('ru-RU') : 'Дата не указана'}{job.date_end && job.date_end !== job.date_start ? ' по ' + new Date(job.date_end + 'T12:00:00Z').toLocaleDateString('ru-RU') : ''}</span><span>◷ {job.time_start?.slice(0, 5) || 'Время не указано'}{job.time_end ? ' - ' + job.time_end.slice(0, 5) : ''}</span></div><div className="job-foot"><span className="small muted">{job.city}</span>{!preview && <Link className="button" href={'/jobs/' + job.id}>Подробнее →</Link>}</div></article>; }
