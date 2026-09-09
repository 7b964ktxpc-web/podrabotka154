import Link from 'next/link';
import { requireUser } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { ActionForm } from '@/components/action-form';
import { logout, saveName, removeSearch } from '@/app/actions';
import { PushControls } from '@/components/push-controls';

export const metadata = { title: 'Мой кабинет', robots: { index: false } };

function searchUrl(f: Record<string, unknown>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v !== null && v !== '' && v !== false && k !== 'page') p.set(k, v === true ? '1' : String(v));
  return '/jobs?' + p;
}

export default async function Profile() {
  const { client, user } = await requireUser();
  const { data: p } = check(await client.from('profiles').select('*').eq('id', user.id).single());
  const { data: searches } = check(await client.from('saved_searches').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50));
  const { data: notifications } = check(await client.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30));
  return <>
    <div className="profile-head">
      <div><p className="eyebrow">Личный кабинет</p><h1>Мой кабинет</h1><p className="lead">Управляй избранным, поисками и настройками аккаунта.</p></div>
      <div className="profile-actions"><Link className="button" href="/favorites">♡ Избранное</Link><Link className="button primary" href="/employer">Мои вакансии</Link><Link className="button" href="/profile/password">Сменить пароль</Link>{p.roles.includes('admin') && <Link className="button" href="/admin">Админка</Link>}<form action={logout}><button>Выйти</button></form></div>
    </div>
    <div className="profile-grid">
      <section className="profile-card panel"><div className="profile-card-head"><div><h2>Профиль</h2><p className="small muted">Данные аккаунта</p></div><span className="profile-avatar">{(p.display_name || user.email || '?').slice(0,1).toUpperCase()}</span></div><p className="profile-email">{user.email}</p><ActionForm action={saveName}><label>Как к вам обращаться<input name="display_name" maxLength={100} defaultValue={p.display_name} placeholder="Например, Дмитрий"/></label></ActionForm></section>
      <section className="profile-card panel"><h2>Уведомления</h2><p className="small muted">Получай новые вакансии по сохранённым поискам.</p><PushControls publicKey={process.env.PUSH_PUBLIC_KEY || ''}/></section>
    </div>
    <section className="profile-section"><div className="section-head"><div><h2>Сохранённые поиски</h2><p className="small muted">Последние 50 поисков.</p></div><Link className="button" href="/jobs">Новый поиск</Link></div>{searches?.length ? <div className="profile-list">{searches.map(s => <div className="data-row profile-row" key={s.id}><div><Link className="profile-link" href={searchUrl(s.filters)}>{s.name} →</Link><span className="small muted">{s.notify ? 'Уведомления включены' : 'Без уведомлений'}</span></div><form action={removeSearch}><input type="hidden" name="id" value={s.id}/><button>Удалить</button></form></div>)}</div> : <div className="empty profile-empty"><h3>Сохранённых поисков пока нет</h3><p>Настрой фильтры в каталоге и сохрани поиск, чтобы быстро возвращаться к нему.</p><Link className="button primary" href="/jobs">Найти подработку</Link></div>}</section>
    <section className="profile-section"><div className="section-head"><div><h2>Последние уведомления</h2><p className="small muted">Здесь появятся новые сообщения сервиса.</p></div></div>{notifications?.length ? <div className="profile-list">{notifications.map(n => <div className="data-row" key={n.id}><Link className="profile-link" href={n.url}>{n.title}</Link><p className="small muted">{new Date(n.created_at).toLocaleString('ru-RU')}</p></div>)}</div> : <div className="profile-empty compact"><p className="muted">Пока нет уведомлений.</p></div>}</section>
  </>;
}
