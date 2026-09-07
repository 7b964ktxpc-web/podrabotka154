export type TelegramMessage = {
    telegram_message_id: number;
    message_text: string;
    message_date: string;
    message_url: string;
    raw_payload: unknown;
};
export interface TelegramSourceAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    fetchMessages(): Promise<TelegramMessage[]>;
    subscribe(signal: AbortSignal): AsyncIterable<TelegramMessage>;
    normalizeMessage(raw: unknown): TelegramMessage;
}
export class ManualImportAdapter implements TelegramSourceAdapter {
    private pending: TelegramMessage[] = [];
    async connect() { }
    async disconnect() { }
    add(raw: TelegramMessage) { this.pending.push(this.normalizeMessage(raw)); }
    async fetchMessages() { return this.pending.splice(0); }
    async *subscribe(signal: AbortSignal) { for (const m of await this.fetchMessages()) {
        if (signal.aborted)
            return;
        yield m;
    } }
    normalizeMessage(raw: unknown): TelegramMessage {
        if (!raw || typeof raw !== 'object')
            throw new Error('Некорректный импорт');
        const p = raw as TelegramMessage;
        if (!Number.isSafeInteger(p.telegram_message_id) || p.telegram_message_id <= 0 || typeof p.message_text !== 'string' || !p.message_text.trim() || Number.isNaN(Date.parse(p.message_date)) || !/^https:\/\/t\.me\/[A-Za-z0-9_]+\/\d+$/.test(p.message_url))
            throw new Error('Некорректное сообщение');
        return { ...p, raw_payload: p.raw_payload ?? raw };
    }
}
export class BotApiAdapter implements TelegramSourceAdapter {
    private offset = 0;
    private connected = false;
    constructor(private token: string, private username: string, private chatId: number) { }
    private async api(method: string, body: unknown) { const r = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(35000) }); const data = await r.json(); if (!r.ok || !data.ok)
        throw new Error('Telegram не принял запрос'); return data.result; }
    async connect() { await this.api('getMe', {}); this.connected = true; }
    async disconnect() { this.connected = false; }
    normalizeMessage(raw: unknown): TelegramMessage {
        const p = raw as {
            message_id: number;
            text?: string;
            caption?: string;
            date: number;
            chat: {
                id: number;
            };
        };
        if (p.chat?.id !== this.chatId || !Number.isSafeInteger(p.message_id) || !Number.isFinite(p.date))
            throw new Error('Неверный источник');
        return { telegram_message_id: p.message_id, message_text: p.text ?? p.caption ?? '', message_date: new Date(p.date * 1000).toISOString(), message_url: `https://t.me/${this.username}/${p.message_id}`, raw_payload: raw };
    }
    async fetchMessages(): Promise<TelegramMessage[]> { if (!this.connected)
        throw new Error('Адаптер не подключён'); const updates = await this.api('getUpdates', { offset: this.offset, timeout: 20, allowed_updates: ['channel_post'] }); const out: TelegramMessage[] = []; for (const u of updates) {
        this.offset = Math.max(this.offset, u.update_id + 1);
        if (u.channel_post?.chat?.id === this.chatId && (u.channel_post.text || u.channel_post.caption))
            out.push(this.normalizeMessage(u.channel_post));
    } return out; }
    async *subscribe(signal: AbortSignal) { while (!signal.aborted && this.connected) {
        for (const m of await this.fetchMessages())
            yield m;
    } }
}
// Production web deployment uses authenticated webhook delivery, not getUpdates.
// Never run polling for multiple sources on one bot token: it would consume shared updates.
