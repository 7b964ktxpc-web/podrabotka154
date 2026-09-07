'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
function session() { let id = sessionStorage.getItem('p154-session'); if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem('p154-session', id);
} return id; }
function track(id: string, type: string) { try {
    void fetch('/api/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: id, type, session: session() }), keepalive: true });
}
catch { /* Analytics must never block a contact link. */ } }
export function Favorite({ id, initial }: {
    id: string;
    initial: boolean;
}) { const [saved, setSaved] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState(''); const router = useRouter(); return <div><button className="favorite" aria-label={saved ? 'Убрать из избранного' : 'Сохранить вакансию'} aria-pressed={saved} disabled={busy} onClick={async () => { setBusy(true); setError(''); try {
    const r = await fetch('/api/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: id, saved: !saved }) });
    if (r.status === 401) {
        router.push('/login');
        return;
    }
    const data = await r.json();
    if (!r.ok)
        throw new Error(data.error);
    setSaved(data.saved);
    router.refresh();
}
catch {
    setError('Не удалось сохранить');
}
finally {
    setBusy(false);
} }}>{saved ? '♥' : '♡'}</button>{error && <span role="alert" className="small">{error}</span>}</div>; }
export function ViewEvent({ id }: {
    id: string;
}) { useEffect(() => { const key = 'view:' + id; try {
    if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        track(id, 'view');
    }
}
catch { /* Storage may be unavailable. */ } }, [id]); return null; }
export function Contact({ id, type, href, children }: {
    id: string;
    type: string;
    href: string;
    children: React.ReactNode;
}) { return <a className="button primary" href={href} target={href.startsWith('https:') ? '_blank' : undefined} rel="noopener noreferrer" onClick={() => track(id, type)}>{children}</a>; }
export function Share({ id, title }: {
    id: string;
    title: string;
}) { const [message, setMessage] = useState(''); return <><button onClick={async () => { try {
    if (navigator.share)
        await navigator.share({ title, url: location.href });
    else
        await navigator.clipboard.writeText(location.href);
    track(id, 'share');
    setMessage('Ссылка готова');
}
catch {
    setMessage('Скопируйте адрес из строки браузера');
} }}>Поделиться</button><span role="status" className="small">{message}</span></>; }
