import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
export const metadata = { title: 'Администрирование', robots: { index: false, follow: false } };
export default async function AdminLayout({ children }: {
    children: React.ReactNode;
}) { await requireAdmin(); const links = [['', 'Обзор'], ['jobs', 'Вакансии'], ['users', 'Пользователи'], ['employers', 'Работодатели'], ['telegram', 'Telegram'], ['moderation', 'Модерация'], ['reparse', 'Переразбор'], ['monetization', 'Монетизация'], ['payments', 'Платежи'], ['promotions', 'Продвижение'], ['subscriptions', 'Подписки'], ['analytics', 'Аналитика'], ['settings', 'Настройки'], ['logs', 'Логи']]; return <><p className="eyebrow">Администратор</p><nav className="chips">{links.map(([s, t]) => <Link className="chip" href={'/admin' + (s ? '/' + s : '')} key={s}>{t}</Link>)}</nav>{children}</>; }
