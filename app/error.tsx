"use client";
export default function ErrorPage({ reset }: {
    reset: () => void;
}) { return <div className="empty"><h1>Не удалось загрузить страницу</h1><p>Попробуйте ещё раз. Если это первый запуск, проверьте подключение базы и применение миграций.</p><button onClick={reset}>Попробовать ещё раз</button></div>; }
