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
    const { data: runs } = check(await client.from('parser_runs').select('*').order('created_at', { ascending: false }).limit(20));

    function form(s?: Record<string, string | boolean>) {
        return <ActionForm action={saveTelegramSource} label="Сохранить источник">
            <input type="hidden" name="id" value={String(s?.id || '')}/>
            <label>Название<input name="name" required defaultValue={String(s?.name || '')} placeholder="Работа Новосибирск"/></label>
            <label>Канал Telegram<input name="username" required defaultValue={String(s?.username || '')} placeholder="@rabota154nsk"/><small>Можно вставить @username, t.me/username или просто username.</small></label>
            <label>Город<select name="city_id" required defaultValue={String(s?.city_id || '')}>{cities?.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
            <label>Способ импорта<select name="adapter" defaultValue={String(s?.adapter || 'public_web')}><option value="public_web">Публичная страница Telegram — бесплатно</option><option value="bot">Bot API, только доступные боту каналы</option><option value="manual">Ручной импорт</option></select></label>
            <label>Telegram chat_id<input name="chat_id" defaultValue={String(s?.chat_id || '')} placeholder="-100…"/><small>Нужен только для Bot API.</small></label>
            <label className="check"><input name="active" type="checkbox" defaultChecked={s?.id ? Boolean(s?.active) : true}/>Источник активен</label>
        </ActionForm>;
    }

    return <>
        <h1>Источники Telegram</h1>
        <p className="message">Добавляй сюда любые открытые Telegram-каналы. Для публичного канала достаточно ссылки или @username — бот не нужен. После сохранения канал сразу проверяется и загружаются последние сообщения. Дальше каждые 15 минут система проверяет все активные публичные источники.</p>
        {sources?.map(s => <details key={s.id}>
            <summary>{s.name} · @{s.username} · {s.active ? 'активен' : 'отключён'}{s.last_error ? ' · ошибка' : ''}</summary>
            {form(s)}
            <ActionForm action={testTelegramSource} label="Проверить канал">
                <input type="hidden" name="id" value={s.id}/>
                <input type="hidden" name="username" value={s.username}/>
                <input type="hidden" name="adapter" value={s.adapter}/>
            </ActionForm>
            {s.last_error && <p role="alert" className="message error">Последняя ошибка: {s.last_error}</p>}
        </details>)}
        <details><summary>+ Добавить источник</summary>{form()}</details>
        <hr className="divider"/>
        <h2>Ручной запуск импорта</h2>
        <p className="message">Можно принудительно забрать последние сообщения любого активного публичного канала. Они не публикуются автоматически: сначала парсер, затем модерация.</p>
        {sources?.filter(s => s.active && s.adapter === 'public_web').map(s => <ActionForm key={s.id} action={importPublicTelegram} label={`Загрузить сейчас — ${s.name}`}><input type="hidden" name="source_id" value={s.id}/></ActionForm>)}
        <h2>Импортировать сообщение вручную</h2>
        <ActionForm action={importMessage} label="Сохранить оригинал и отправить в очередь">
            <label>Источник<select name="source_id" required>{sources?.filter(s => s.active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label>Номер сообщения<input name="telegram_message_id" type="number" min={1} required placeholder="12345"/><small>Последнее число в ссылке t.me/канал/12345.</small></label>
            <label>Дата оригинала, ISO 8601<input name="message_date" required placeholder="2026-09-07T08:00:00Z"/></label>
            <label>Полный оригинальный текст<textarea name="message_text" required maxLength={20000} placeholder="Вставьте текст целиком"/></label>
        </ActionForm>
        <h2 style={{ marginTop: 32 }}>Последние 20 сообщений</h2>
        {messages?.map(m => <details key={m.id}><summary>Сообщение {m.telegram_message_id} · {new Date(m.message_date).toLocaleString('ru-RU')}</summary><p style={{ whiteSpace: 'pre-wrap' }}>{m.message_text}</p><a href={m.message_url} target="_blank" rel="noopener noreferrer">Оригинал ↗</a></details>)}
        <h2 style={{ marginTop: 32 }}>Последние обработки</h2>
        {runs?.map(r => <div className="data-row" key={r.id}>{r.provider} · {r.error || 'Обработано'}<p className="small muted">{r.created_at}</p></div>)}
    </>;
}
