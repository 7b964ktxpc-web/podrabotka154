import { NextResponse } from 'next/server';
import { serviceDb, check } from '@/lib/service-db';
import { fingerprint } from '@/lib/domain';
import { createVacancyParser } from '@/services/ai/agent';
import { PublicChannelAdapter } from '@/services/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const parser = createVacancyParser();

async function processQueue(db: any, limit = 20) {
    let processed = 0;
    let failed = 0;
    for (let i = 0; i < limit; i++) {
        const { data: items } = check(await db.rpc('claim_work', { batch: 1 }));
        const item: any = items?.[0];
        if (!item) break;
        try {
            if (item.kind === 'parse') {
                const { data: message } = check(await db.from('telegram_messages').select('*').eq('id', item.payload.message_id).single());
                const { data: source }: any = check(await db.from('telegram_sources').select('city_id,cities(name)').eq('id', message.source_id).single());
                const city = source?.cities?.name ?? null;
                const parsed = await parser.parse(message.message_text);
                check(await db.rpc('store_parsed', {
                    p_message: message.id,
                    p_result: parsed,
                    p_fingerprint: fingerprint({ ...parsed, city }),
                }));
            } else if (item.kind === 'notify_job') {
                check(await db.rpc('notify_job', { p_job: item.payload.job_id }));
            }
            check(await db.from('work_queue').update({ done_at: new Date().toISOString(), locked_until: null, error: null }).eq('id', item.id).eq('lock_token', item.lock_token));
            processed++;
        } catch (e) {
            const error = e instanceof Error ? e.message : 'Worker error';
            failed++;
            await db.from('work_queue').update({ error: error.slice(0, 500), locked_until: null, available_at: new Date(Date.now() + 60_000).toISOString() }).eq('id', item.id).eq('lock_token', item.lock_token);
        }
    }
    return { processed, failed };
}

export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const db = serviceDb();
    const { data: sources, error } = await db.from('telegram_sources').select('id,username,adapter').eq('active', true).eq('adapter', 'public_web');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const results: Array<Record<string, unknown>> = [];
    for (const source of sources ?? []) {
        try {
            const adapter = new PublicChannelAdapter(source.username, 20);
            await adapter.connect();
            const messages = await adapter.fetchMessages();
            let inserted = 0;
            for (const message of messages) {
                const result = check(await db.from('telegram_messages').upsert({ ...message, source_id: source.id }, { onConflict: 'source_id,telegram_message_id', ignoreDuplicates: true }).select('id'));
                if (result.data?.length) inserted += 1;
            }
            await adapter.disconnect();
            await db.from('telegram_sources').update({ last_error: null }).eq('id', source.id);
            results.push({ source: source.username, fetched: messages.length, inserted });
        } catch (e) {
            const message = e instanceof Error ? e.message : 'Unknown import error';
            await db.from('telegram_sources').update({ last_error: message }).eq('id', source.id);
            results.push({ source: source.username, error: message });
        }
    }
    const queue = await processQueue(db);
    return NextResponse.json({ ok: true, results, queue });
}
