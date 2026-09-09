import Link from 'next/link';

export default function NotFound() {
    return <div className="empty">
        <p className="eyebrow">404</p>
        <h1>Объявление недоступно</h1>
        <p>Возможно, срок публикации закончился, объявление сняли с публикации или адрес страницы изменился.</p>
        <div className="form-actions">
            <Link className="button primary" href="/jobs">Найти другую подработку</Link>
            <Link className="button" href="/">На главную</Link>
        </div>
    </div>;
}
