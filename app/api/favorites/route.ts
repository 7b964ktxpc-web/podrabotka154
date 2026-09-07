import { db } from '@/lib/db';
import { serviceDb, check } from '@/lib/service-db';
import { checkOrigin, smallBody } from '@/lib/http';
import { rate } from '@/lib/rate';
import { z } from 'zod';
export async function POST(req: Request) { try {
    checkOrigin(req);
    const c = await db();
    const { data: { user } } = await c.auth.getUser();
    if (!user)
        return Response.json({ error: 'Войдите, чтобы сохранить вакансию' }, { status: 401 });
    await rate('favorite:' + user.id, 40);
    const p = z.object({ job_id: z.string().uuid(), saved: z.boolean() }).parse(JSON.parse(await smallBody(req)));
    if (p.saved) {
        check(await c.from('favorites').upsert({ user_id: user.id, job_id: p.job_id }, { onConflict: 'user_id,job_id', ignoreDuplicates: true }));
    }
    else {
        check(await c.from('favorites').delete().eq('user_id', user.id).eq('job_id', p.job_id));
    }
    return Response.json({ saved: p.saved });
}
catch {
    return Response.json({ error: 'Не удалось изменить избранное' }, { status: 400 });
} }
