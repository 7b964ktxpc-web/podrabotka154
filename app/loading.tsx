export default function Loading() {
    return <div className="empty" role="status" aria-live="polite" aria-busy="true">
        <p className="eyebrow">Подработка 154</p>
        <h1>Загружаем объявления…</h1>
        <p className="muted">Получаем актуальные подработки и применяем выбранные фильтры.</p>
    </div>;
}
