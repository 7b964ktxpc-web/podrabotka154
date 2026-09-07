import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { serviceDb, check } from '@/lib/service-db';
import { smallBody } from '@/lib/http';
import { BotApiAdapter } from '@/services/telegram';
const schema = z.object({ channel_post: z.object({ message_id: z.number().int().positive(), date: z.number().int().positive(), chat: z.object({ id: z.number().int() }), text: z.string().max(20000).optional(), caption: z.string().max(20000).optional() }).passthrough().optional() }).passthrough();
export async function POST(req: Request) {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    const given = req.headers.get('x-telegram-bot-api-secret-token');
    if (!secret || !given || Buffer.byteLength(secret) !== Buffer.byteLength(given) || !timingSafeEqual(Buffer.from(secret), Buffer.from(given)))
        return Response.json({ error: 'Нет доступа' }, { status: 401 });
    try {
        const raw = JSON.parse(await smallBody(req));
        const p = schema.parse(raw).channel_post;
        if (!p || !(p.text || p.caption))
            return Response.json({ ok: true });
        const c = serviceDb();
        const { data: s, error } = await c.from('telegram_sources').select('*').eq('chat_id', p.chat.id).eq('adapter', 'bot').eq('active', true).maybeSingle();
        if (error)
            throw error;
        if (!s)
            return Response.json({ ok: true });
        const a = new BotApiAdapter(process.env.TELEGRAM_BOT_TOKEN || '', s.username, p.chat.id);
        const m = a.normalizeMessage(p);
        check(await c.from('telegram_messages').upsert({ ...m, source_id: s.id, raw_payload: raw }, { onConflict: 'source_id,telegram_message_id', ignoreDuplicates: true }));
        return Response.json({ ok: true });
    }
    catch {
        return Response.json({ error: 'Не удалось сохранить сообщение' }, { status: 400 });
    }
}
