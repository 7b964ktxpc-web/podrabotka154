import { db } from '@/lib/db';
import { serviceDb, check } from '@/lib/service-db';
import { checkOrigin, smallBody } from '@/lib/http';
import { rate } from '@/lib/rate';
import { z } from 'zod';
import { createHash } from 'node:crypto';
export async function POST(req: Request) { try {
    checkOrigin(req);
    const p = z.object({ job_id: z.string().uuid(), type: z.enum(['view', 'phone_click', 'telegram_click', 'email_click', 'share', 'contact_view']), session: z.string().uuid() }).parse(JSON.parse(await smallBody(req)));
    await rate('event:' + p.job_id + ':' + p.session, 20, 3600);
    const c = await db();
    const { data: { user } } = await c.auth.getUser();
    const { data: j } = await c.from('jobs').select('id').eq('id', p.job_id).eq('status', 'published').gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!j)
        return Response.json({ error: 'Вакансия недоступна' }, { status: 404 });
    check(await serviceDb().from('job_events').insert({ job_id: p.job_id, type: p.type, user_id: user?.id ?? null }));
    return Response.json({ ok: true });
}
catch {
    return Response.json({ error: 'Не удалось записать событие' }, { status: 400 });
} }
