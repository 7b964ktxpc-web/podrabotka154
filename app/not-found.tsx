import Link from 'next/link';
export default function NotFound() { return <div className="empty"><h1>Объявление недоступно</h1><p>Возможно, срок публикации закончился или адрес страницы изменился.</p><Link className="button primary" href="/jobs">Найти другую подработку</Link></div>; }
