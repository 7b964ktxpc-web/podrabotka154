import { z } from 'zod';
import { db } from '@/lib/db';
import { serviceDb, check } from '@/lib/service-db';
import { checkOrigin, smallBody } from '@/lib/http';
import { allowedPushEndpoint } from '@/services/push/safety';
import { rate } from '@/lib/rate';
export async function POST(req: Request) { if (!process.env.PUSH_PUBLIC_KEY || !process.env.PUSH_PRIVATE_KEY)
    return Response.json({ error: 'Push ещё не настроен администратором' }, { status: 503 }); try {
    checkOrigin(req);
    const c = await db();
    const { data: { user } } = await c.auth.getUser();
    if (!user)
        return Response.json({ error: 'Сначала войдите' }, { status: 401 });
    await rate('push:' + user.id, 5);
    const p = z.object({ endpoint: z.string().max(2000).refine(allowedPushEndpoint), keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{20,30}$/) }) }).parse(JSON.parse(await smallBody(req)));
    const s = serviceDb();
    const { data: old } = check(await s.from('push_subscriptions').select('user_id').eq('endpoint', p.endpoint).maybeSingle());
    if (old && old.user_id !== user.id)
        return Response.json({ error: 'Этот браузер подписан под другим аккаунтом. Отключите подписку в нём.' }, { status: 409 });
    check(await s.from('push_subscriptions').upsert({ user_id: user.id, endpoint: p.endpoint, ...p.keys }, { onConflict: 'endpoint' }));
    return Response.json({ ok: true });
}
catch {
    return Response.json({ error: 'Не удалось включить уведомления' }, { status: 400 });
} }
export async function DELETE(req: Request) { try {
    checkOrigin(req);
    const c = await db();
    const { data: { user } } = await c.auth.getUser();
    if (!user)
        return Response.json({ error: 'Сначала войдите' }, { status: 401 });
    const p = z.object({ endpoint: z.string().max(2000) }).parse(JSON.parse(await smallBody(req)));
    check(await c.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', p.endpoint));
    return Response.json({ ok: true });
}
catch {
    return Response.json({ error: 'Не удалось отключить подписку' }, { status: 400 });
} }
