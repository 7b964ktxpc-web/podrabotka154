import { requireAdmin } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { ActionForm } from '@/components/action-form';
import { importMessage, importPublicTelegram } from '@/app/actions';
import { saveTelegramSource, testTelegramSource } from './actions';

export default async function Telegram() {
    const { client } = await requireAdmin();
    const { data: sources } = check(await client.from('telegram_sources').select('*').order('created_at').limit(100));
    const { data: cities } = check(await client.from('cities').select('id,name').eq('active', true));
    const { data: messages } = check(await client.from('telegram_messages').select('*').order('created_at', { ascending: false }).limit(20));
    const { data: allMessageStates } = check(await client.from('telegram_messages').select('parse_status').limit(5000));
    const { data: runs } = check(await client.from('parser_runs').select('*').order('created_at', { ascending: false }).limit(20));

    const status = { pending: 0, processing: 0, processed: 0, error: 0 };
    for (const message of allMessageStates ?? []) {
        if (message.parse_status === 'pending') status.pending++;
        else if (message.parse_status === 'processing') status.processing++;
        else if (message.parse_status === 'processed') status.processed++;
        else if (message.parse_status === 'error') status.error++;
    }

    const defaultCity = cities?.find(c => c.name.trim().toLowerCase() === 'новосибирск') ?? cities?.[0];
    const defaultCityId = defaultCity?.id ?? '';

    function form(s?: Record<string, string | boolean>) {
        const username = String(s?.username || '');
        return <ActionForm action={saveTelegramSource} label={s?.id ? 'Сохранить канал' : 'Добавить канал'}>
            <input type="hidden" name="id" value={String(s?.id || '')}/>
            <input type="hidden" name="city_id" value={String(s?.city_id || defaultCityId)}/>
            <input type="hidden" name="adapter" value="public_web"/>
            <label>Ссылка на Telegram-канал<input name="channel_url" required defaultValue={username ? `https://t.me/${username}` : ''} placeholder="https://t.me/rabota154NsK"/><small>Просто вставь ссылку на открытый канал. Можно также вставить @username.</small></label>
            {!s?.id && <p className="small muted">Город по умолчанию: {defaultCity?.name || 'не настроен'}</p>}
            {s?.id && <p className="small muted">Канал: @{username} · город: {cities?.find(c => c.id === s.city_id)?.name || 'не указан'}</p>}
        </ActionForm>;
    }

    return <>
        <h1>Источники Telegram</h1>
        <p className="message">Добавляй открытые Telegram-каналы одной ссылкой. Система сама подключит канал, заберёт новые сообщения, поставит их в очередь на AI-разбор и не создаст дубли.</p>

        <h2>Состояние обработки</h2>
        <div className="data-row">
            <strong>Всего сообщений: {allMessageStates?.length ?? 0}</strong>
            <p className="small muted">В очереди: {status.pending} · Обрабатываются: {status.processing} · Обработано: {status.processed} · Ошибки: {status.error}</p>
        </div>
        {status.error > 0 && <p role="alert" className="message error">Есть сообщения с ошибкой парсинга. Открой последние сообщения ниже и проверь поле ошибки.</p>}

        <h2>Подключённые каналы</h2>
        {sources?.map(s => <details key={s.id}>
            <summary>{s.name} · {s.active ? 'активен' : 'отключён'}{s.last_error ? ' · ошибка' : ''}</summary>
            {form(s)}
            <ActionForm action={testTelegramSource} label="Проверить канал">
                <input type="hidden" name="id" value={s.id}/>
                <input type="hidden" name="channel_url" value={`https://t.me/${s.username}`}/>
            </ActionForm>
            {s.last_error && <p role="alert" className="message error">Последняя ошибка: {s.last_error}</p>}
        </details>)}
        <details open><summary>+ Добавить Telegram-канал</summary>{form()}</details>
        <hr className="divider"/>
        <h2>Ручной запуск импорта</h2>
        <p className="message">Можно принудительно забрать последние сообщения любого активного публичного канала. Они не публикуются автоматически: сначала AI-разбор, затем модерация.</p>
        {sources?.filter(s => s.active && s.adapter === 'public_web').map(s => <ActionForm key={s.id} action={importPublicTelegram} label={`Загрузить сейчас — ${s.name}`}><input type="hidden" name="source_id" value={s.id}/></ActionForm>)}
        <h2>Импортировать сообщение вручную</h2>
        <ActionForm action={importMessage} label="Сохранить оригинал и отправить в очередь">
            <label>Источник<select name="source_id" required>{sources?.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label>Номер сообщения<input name="telegram_message_id" type="number" min={1} required placeholder="12345"/><small>Последнее число в ссылке t.me/канал/12345.</small></label>
            <label>Дата оригинала, ISO 8601<input name="message_date" required placeholder="2026-09-07T08:00:00Z"/></label>
            <label>Полный оригинальный текст<textarea name="message_text" required maxLength={20000} placeholder="Вставьте текст целиком"/></label>
        </ActionForm>
        <h2 style={{ marginTop: 32 }}>Последние 20 сообщений</h2>
        {messages?.map(m => <details key={m.id}>
            <summary>Сообщение {m.telegram_message_id} · {new Date(m.message_date).toLocaleString('ru-RU')} · {m.parse_status === 'error' ? 'ОШИБКА' : m.parse_status === 'processed' ? 'обработано' : m.parse_status === 'processing' ? 'обрабатывается' : 'в очереди'}</summary>
            <p style={{ whiteSpace: 'pre-wrap' }}>{m.message_text}</p>
            {m.parse_error && <p role="alert" className="message error">Ошибка парсинга: {m.parse_error}</p>}
            {m.parse_attempts > 0 && <p className="small muted">Попыток: {m.parse_attempts}{m.parsed_at ? ` · обработано ${new Date(m.parsed_at).toLocaleString('ru-RU')}` : ''}</p>}
            <a href={m.message_url} target="_blank" rel="noopener noreferrer">Оригинал ↗</a>
        </details>)}
        <h2 style={{ marginTop: 32 }}>Последние обработки</h2>
        {runs?.map(r => <div className="data-row" key={r.id}>{r.provider} · {r.error || 'Обработано'}<p className="small muted">{r.created_at}</p></div>)}
    </>;
}
