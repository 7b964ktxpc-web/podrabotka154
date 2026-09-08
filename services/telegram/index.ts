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
    async *subscribe(signal: AbortSignal) { for (const m of await this.fetchMessages()) { if (signal.aborted) return; yield m; } }
    normalizeMessage(raw: unknown): TelegramMessage {
        if (!raw || typeof raw !== 'object') throw new Error('Некорректный импорт');
        const p = raw as TelegramMessage;
        if (!Number.isSafeInteger(p.telegram_message_id) || p.telegram_message_id <= 0 || typeof p.message_text !== 'string' || !p.message_text.trim() || Number.isNaN(Date.parse(p.message_date)) || !/^https:\/\/t\.me\/[A-Za-z0-9_]+\/\d+$/.test(p.message_url)) throw new Error('Некорректное сообщение');
        return { ...p, raw_payload: p.raw_payload ?? raw };
    }
}
function decodeHtml(value: string): string {
    return value.replace(/<br\s*\/?>(?:\r?\n)?/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n))).replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
/** Reads only the public Telegram web page; it does not bypass access controls. */
export class PublicChannelAdapter implements TelegramSourceAdapter {
    private connected = false;
    private username: string;
    private limit: number;
    constructor(username: string, limit = 20) {
        this.username = username;
        this.limit = limit;
    }
    async connect() {
        if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(this.username)) throw new Error('Некорректный username Telegram');
        this.connected = true;
    }
    async disconnect() { this.connected = false; }
    normalizeMessage(raw: unknown): TelegramMessage {
        if (!raw || typeof raw !== 'object') throw new Error('Некорректное сообщение');
        const p = raw as TelegramMessage;
        if (!Number.isSafeInteger(p.telegram_message_id) || p.telegram_message_id <= 0 || !p.message_text.trim() || Number.isNaN(Date.parse(p.message_date)) || !/^https:\/\/t\.me\/[A-Za-z0-9_]+\/\d+$/.test(p.message_url)) throw new Error('Некорректное сообщение');
        return { ...p, raw_payload: p.raw_payload ?? raw };
    }
    async fetchMessages(): Promise<TelegramMessage[]> {
        if (!this.connected) throw new Error('Адаптер не подключён');
        const response = await fetch(`https://t.me/s/${encodeURIComponent(this.username)}`, { headers: { 'User-Agent': 'Mozilla/5.0 Podrabotka154/1.0' }, cache: 'no-store', signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw new Error(`Telegram вернул HTTP ${response.status}`);
        const html = await response.text();
        const blocks = [...html.matchAll(/<div class="tgme_widget_message_wrap[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi)].map(m => m[0]);
        const out: TelegramMessage[] = [];
        for (const block of blocks.slice(-this.limit)) {
            const post = block.match(/data-post="([A-Za-z0-9_]+)\/(\d+)"/i);
            const time = block.match(/<time[^>]+datetime="([^"]+)"/i);
            const text = block.match(/<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i);
            if (!post || !time || !text) continue;
            const message = decodeHtml(text[1]);
            if (!message) continue;
            out.push(this.normalizeMessage({ telegram_message_id: Number(post[2]), message_text: message, message_date: new Date(time[1]).toISOString(), message_url: `https://t.me/${post[1]}/${post[2]}`, raw_payload: { source: 'telegram_public_web', post: post[0] } }));
        }
        return out;
    }
    async *subscribe(signal: AbortSignal) { if (signal.aborted) return; for (const m of await this.fetchMessages()) { if (signal.aborted) return; yield m; } }
}
export class BotApiAdapter implements TelegramSourceAdapter {
    private offset = 0;
    private connected = false;
    private token: string;
    private username: string;
    private chatId: number;
    constructor(token: string, username: string, chatId: number) {
        this.token = token;
        this.username = username;
        this.chatId = chatId;
    }
    private async api(method: string, body: unknown) { const r = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(35000) }); const data = await r.json(); if (!r.ok || !data.ok) throw new Error('Telegram не принял запрос'); return data.result; }
    async connect() { await this.api('getMe', {}); this.connected = true; }
    async disconnect() { this.connected = false; }
    normalizeMessage(raw: unknown): TelegramMessage {
        const p = raw as { message_id: number; text?: string; caption?: string; date: number; chat: { id: number } };
        if (p.chat?.id !== this.chatId || !Number.isSafeInteger(p.message_id) || !Number.isFinite(p.date)) throw new Error('Неверный источник');
        return { telegram_message_id: p.message_id, message_text: p.text ?? p.caption ?? '', message_date: new Date(p.date * 1000).toISOString(), message_url: `https://t.me/${this.username}/${p.message_id}`, raw_payload: raw };
    }
    async fetchMessages(): Promise<TelegramMessage[]> { if (!this.connected) throw new Error('Адаптер не подключён'); const updates = await this.api('getUpdates', { offset: this.offset, timeout: 20, allowed_updates: ['channel_post'] }); const out: TelegramMessage[] = []; for (const u of updates) { this.offset = Math.max(this.offset, u.update_id + 1); if (u.channel_post?.chat?.id === this.chatId && (u.channel_post.text || u.channel_post.caption)) out.push(this.normalizeMessage(u.channel_post)); } return out; }
    async *subscribe(signal: AbortSignal) { while (!signal.aborted && this.connected) { for (const m of await this.fetchMessages()) yield m; } }
}
// Production web deployment uses authenticated webhook delivery, not getUpdates.
// Never run polling for multiple sources on one bot token: it would consume shared updates.
