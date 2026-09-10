'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';
import { check, serviceDb } from '@/lib/service-db';
import { friendly } from '@/lib/validation';
import { rate } from '@/lib/rate';
import { PublicChannelAdapter } from '@/services/telegram';
import type { ActionState } from '@/app/actions';

function normalizeUsername(value: string): string {
    let v = value.trim();
    v = v.replace(/^https?:\/\/(?:www\.)?t\.me\//i, '');
    v = v.replace(/^@/, '');
    v = v.replace(/^s\//i, '');
    v = v.split(/[?#]/, 1)[0].replace(/\/$/, '');
    if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v)) {
        throw new Error('Укажите ссылку на публичный Telegram-канал: https://t.me/channel или @channel');
    }
    return v;
}

const sourceSchema = z.object({
    channel_url: z.string().trim().min(1).max(200),
    city_id: z.string().uuid(),
    adapter: z.literal('public_web'),
});

async function importLatest(sourceId: string, username: string) {
    const adapter = new PublicChannelAdapter(username, 20);
    await adapter.connect();
    try {
        const messages = await adapter.fetchMessages();
        const db = serviceDb();
        let inserted = 0;
        for (const message of messages) {
            const result = check(await db.from('telegram_messages').upsert(
                { ...message, source_id: sourceId },
                { onConflict: 'source_id,telegram_message_id', ignoreDuplicates: true },
            ).select('id'));
            if (result.data?.length) inserted += 1;
        }
        await db.from('telegram_sources').update({ last_error: null }).eq('id', sourceId);
        return { fetched: messages.length, inserted };
    } finally {
        await adapter.disconnect();
    }
}

export async function saveTelegramSource(_: ActionState, form: FormData): Promise<ActionState> {
    try {
        const { user } = await requireAdmin();
        await rate('telegram-source:' + user.id, 20, 300);
        const raw = sourceSchema.parse(Object.fromEntries(form));
        const username = normalizeUsername(raw.channel_url);
        const db = serviceDb();
        const requestedId = form.get('id') ? z.string().uuid().parse(form.get('id')) : null;

        const existing = check(await db.from('telegram_sources').select('id').eq('username', username).limit(1));
        const id = requestedId || existing.data?.[0]?.id || crypto.randomUUID();

        check(await db.from('telegram_sources').upsert({
            id,
            name: `@${username}`,
            username,
            city_id: raw.city_id,
            adapter: 'public_web',
            chat_id: null,
            active: true,
            last_error: null,
        }));
        check(await db.from('admin_logs').insert({ actor_id: user.id, action: 'source_update', target_id: id, details: { adapter: 'public_web', username, duplicate_reused: Boolean(existing.data?.length && !requestedId) } }));

        try {
            const result = await importLatest(id, username);
            revalidatePath('/admin/telegram');
            return { ok: `Канал подключён: получено ${result.fetched}, новых сообщений ${result.inserted}.` };
        } catch (e) {
            const error = friendly(e);
            await db.from('telegram_sources').update({ last_error: error }).eq('id', id);
            revalidatePath('/admin/telegram');
            return { ok: `Канал сохранён, но проверить его сейчас не удалось: ${error}` };
        }
    } catch (e) {
        return { error: friendly(e) };
    }
}

export async function testTelegramSource(_: ActionState, form: FormData): Promise<ActionState> {
    try {
        const { user } = await requireAdmin();
        await rate('telegram-source-test:' + user.id, 10, 300);
        const username = normalizeUsername(String(form.get('channel_url') || form.get('username') || ''));
        const sourceId = z.string().uuid().parse(form.get('id'));
        const result = await importLatest(sourceId, username);
        revalidatePath('/admin/telegram');
        return { ok: `Канал доступен: найдено ${result.fetched} сообщений, новых сохранено ${result.inserted}.` };
    } catch (e) {
        return { error: friendly(e) };
    }
}
