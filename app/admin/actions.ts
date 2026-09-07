'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { serviceDb, check } from '@/lib/service-db';
import { friendly } from '@/lib/validation';
import type { ActionState } from '@/app/actions';
export async function setRoles(_: ActionState, f: FormData): Promise<ActionState> { try {
    const { client } = await requireAdmin();
    const id = z.string().uuid().parse(f.get('id'));
    const roles = ['user', ...(f.get('employer') === 'on' ? ['employer'] : []), ...(f.get('admin') === 'on' ? ['admin'] : [])];
    check(await client.rpc('set_roles', { p_id: id, p_roles: roles }));
    revalidatePath('/admin/users');
    return { ok: 'Роли изменены.' };
}
catch (e) {
    return { error: friendly(e) };
} }
export async function retryWork(_: ActionState, f: FormData): Promise<ActionState> { try {
    const { user } = await requireAdmin();
    const id = z.string().uuid().parse(f.get('id'));
    const c = serviceDb();
    check(await c.from('work_queue').update({ attempts: 0, available_at: new Date().toISOString(), error: null }).eq('id', id).is('done_at', null).is('locked_until', null));
    check(await c.from('admin_logs').insert({ actor_id: user.id, action: 'queue_retry', target_id: id }));
    revalidatePath('/admin/logs');
    return { ok: 'Повторный запуск запрошен.' };
}
catch (e) {
    return { error: friendly(e) };
} }
export async function deleteSource(_: ActionState, f: FormData): Promise<ActionState> { try {
    const { user } = await requireAdmin();
    if (f.get('confirm') !== 'on')
        return { error: 'Подтвердите удаление источника.' };
    const id = z.string().uuid().parse(f.get('id'));
    const c = serviceDb();
    const { count } = check(await c.from('telegram_messages').select('id', { count: 'exact', head: true }).eq('source_id', id));
    if (count)
        return { error: 'Источник содержит оригиналы сообщений. Для сохранения происхождения объявлений его можно отключить, но не удалить.' };
    check(await c.from('telegram_sources').delete().eq('id', id));
    check(await c.from('admin_logs').insert({ actor_id: user.id, action: 'source_deleted', target_id: id }));
    revalidatePath('/admin/telegram');
    return { ok: 'Пустой источник удалён.' };
}
catch (e) {
    return { error: friendly(e) };
} }
