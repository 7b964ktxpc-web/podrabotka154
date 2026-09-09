import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { check } from '@/lib/service-db';
import { serviceDb } from '@/lib/service-db';
import { ActionForm } from '@/components/action-form';
import type { ActionState } from '@/app/actions';
import { fingerprint } from '@/lib/domain';
import { createVacancyParser } from '@/services/ai/agent';
import { EnhancedConservativeParser } from '@/services/ai/enhanced-parser';

const parser = process.env.PARSER_PROVIDER === 'ai' || process.env.AI_PARSER_ENABLED === 'true'
    ? createVacancyParser()
    : new EnhancedConservativeParser();

async function reparsePending(_: ActionState, form: FormData): Promise<ActionState> {
    'use server';
    try {
        const { user } = await requireAdmin();
        const rawLimit = Number(form.get('limit') || 50);
        const limit = Number.isInteger(rawLimit) ? Math.max(1, Math.min(100, rawLimit)) : 50;
        const client = serviceDb();
        const { data: jobs } = check(await client.from('jobs').select('id,source_message_id').eq('status', 'pending_moderation').not('source_message_id', 'is', null).order('created_at', { ascending: false }).limit(limit));
        const ids = (jobs ?? []).map((job) => job.source_message_id).filter((id): id is string => typeof id === 'string');
        if (!ids.length) return { ok: 'Нет Telegram-объявлений для переразбора.' };
        const { data: messages } = check(await client.from('telegram_messages').select('id,message_text,message_date,message_url').in('id', ids));
        const byId = new Map((messages ?? []).map((message) => [message.id, message]));
        let updated = 0;
        let failed = 0;
        for (const id of ids) {
            const message = byId.get(id);
            if (!message) { failed++; continue; }
            try {
                const parsedJob = await parser.parse(message.message_text, { referenceDate: message.message_date });
                const stored = await client.rpc('store_public_telegram_parsed', {
                    p_message: message.id,
                    p_result: parsedJob,
                    p_fingerprint: fingerprint({ ...parsedJob, city: null }),
                });
                if (stored.error) throw stored.error;
                if (stored.data) updated++; else failed++;
            } catch { failed++; }
        }
        check(await client.from('admin_logs').insert({ actor_id: user.id, action: 'telegram_pending_reparse', details: { requested: ids.length, updated, failed } }));
        return { ok: `Переразобрано: ${updated}. Ошибок: ${failed}. Объявления не публиковались и остаются на ручной модерации.` };
    } catch (e) {
        return { error: e instanceof Error ? e.message : 'Не удалось выполнить переразбор.' };
    }
}

export default async function ReparsePage() {
    await requireAdmin();
    const client = serviceDb();
    const { count } = check(await client.from('jobs').select('id', { count: 'exact', head: true }).eq('status', 'pending_moderation').not('source_message_id', 'is', null));
    return <>
        <h1>Переразбор Telegram</h1>
        <p>Обновляет поля только у объявлений со статусом <strong>pending_moderation</strong>. Публикация автоматически не выполняется.</p>
        <div className="panel" style={{ margin: '16px 0' }}>
            <strong>Сейчас доступно для переразбора: {count ?? 0}</strong>
            <p className="small muted">Полезно после улучшения парсера: например, чтобы старые объявления получили корректные дату, время, оплату и приоритетные признаки.</p>
        </div>
        <ActionForm action={reparsePending} label="Переразобрать объявления">
            <label>Максимум объявлений
                <input name="limit" type="number" min="1" max="100" defaultValue="50" />
            </label>
            <p className="small muted">Используется текущий консервативный парсер. Если включён AI-парсер через настройки окружения, будет использован он.</p>
        </ActionForm>
        <p><Link className="button" href="/admin/moderation">← Вернуться к модерации</Link></p>
    </>;
}
