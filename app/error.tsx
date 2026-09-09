"use client";
import Link from 'next/link';

export default function ErrorPage({ reset }: { reset: () => void }) {
    return <div className="empty">
        <p className="eyebrow">Что-то пошло не так</p>
        <h1>Не удалось загрузить страницу</h1>
        <p>Попробуйте ещё раз. Если ошибка повторяется, вернитесь в каталог подработки.</p>
        <div className="form-actions">
            <button className="button primary" onClick={reset}>Попробовать ещё раз</button>
            <Link className="button" href="/jobs">Вернуться к подработке</Link>
        </div>
    </div>;
}
