import { setTimeout as sleep } from 'node:timers/promises';
import webpush from 'web-push';
import { serviceDb, check } from '../lib/service-db';
import { env } from '../lib/env';
import { fingerprint } from '../lib/domain';
import { ConservativeParser } from '../services/ai';
import { allowedPushEndpoint } from '../services/push/safety';
const c = serviceDb(), parser = new ConservativeParser();
let stopping = false;
process.on('SIGTERM', () => { stopping = true; });
process.on('SIGINT', () => { stopping = true; });
if (process.env.PARSER_PROVIDER && process.env.PARSER_PROVIDER !== 'conservative')
    throw new Error('Неизвестный parser provider');
const pushReady = Boolean(process.env.PUSH_PUBLIC_KEY && process.env.PUSH_PRIVATE_KEY);
if (pushReady)
    webpush.setVapidDetails(env('PUSH_SUBJECT'), env('PUSH_PUBLIC_KEY'), env('PUSH_PRIVATE_KEY'));
async function processWork(kind: string, p: Record<string, string>) {
    if (kind === 'parse') {
        const { data: m } = check(await c.from('telegram_messages').select('*').eq('id', p.message_id).single());
        const result = await parser.parse(m.message_text);
        const { data: s } = check(await c.from('telegram_sources').select('city_id,cities(name)').eq('id', m.source_id).single());
        // Source city is configured by a human and is explicitly flagged for moderation.
        const city = (s.cities as unknown as {
            name: string;
        })?.name ?? null;
        check(await c.rpc('store_parsed', { p_message: m.id, p_result: result, p_fingerprint: fingerprint({ ...result, city }) }));
        return;
    }
    if (kind === 'notify_job') {
        check(await c.rpc('notify_job', { p_job: p.job_id }));
        return;
    }
    if (kind === 'push') {
        if (!pushReady)
            throw new Error('Push keys not configured');
        const { data: n } = check(await c.from('notifications').select('*').eq('id', p.notification_id).maybeSingle());
        const { data: s } = check(await c.from('push_subscriptions').select('*').eq('id', p.subscription_id).maybeSingle());
        if (!n || !s || s.user_id !== n.user_id)
            return;
        if (n.kind === 'new_job') {
            const { data: j } = check(await c.from('jobs').select('id').eq('id', n.job_id).eq('status', 'published').gt('expires_at', new Date().toISOString()).maybeSingle());
            if (!j)
                return;
        }
        if (!allowedPushEndpoint(s.endpoint))
            throw new Error('Blocked push endpoint');
        try {
            await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ id: n.id, title: n.title, url: n.url }), { TTL: 3600, timeout: 20000 });
        }
        catch (e) {
            const status = (e as {
                statusCode?: number;
            }).statusCode;
            if (status === 404 || status === 410) {
                check(await c.from('push_subscriptions').delete().eq('id', s.id));
                return;
            }
            throw e;
        }
        return;
    }
    throw new Error('Unknown queue kind');
}
async function tick() {
    check(await c.rpc('expire_jobs'));
    const batch = Math.min(20, Math.max(1, Number(process.env.WORKER_BATCH_SIZE) || 10));
    // Claim each item just before processing; later items cannot lose their lease while waiting.
    for (let index = 0; index < batch && !stopping; index++) {
        const { data: items } = check(await c.rpc('claim_work', { batch: 1 }));
        const item = items?.[0];
        if (!item)
            break;
        try {
            await processWork(item.kind, item.payload);
            check(await c.from('work_queue').update({ done_at: new Date().toISOString(), locked_until: null, error: null }).eq('id', item.id).eq('lock_token', item.lock_token));
        }
        catch (e) {
            const error = e instanceof Error ? e.message : 'Worker error';
            console.error('Work item failed', item.id, item.kind);
            check(await c.from('work_queue').update({ error: error.slice(0, 500), locked_until: null, available_at: new Date(Date.now() + Math.min(3600, 2 ** item.attempts * 15) * 1000).toISOString() }).eq('id', item.id).eq('lock_token', item.lock_token));
            if (item.kind === 'parse')
                check(await c.from('parser_runs').insert({ message_id: item.payload.message_id, provider: 'conservative', error: error.slice(0, 500) }));
        }
    }
}
const once = process.argv.includes('--once');
do {
    try {
        await tick();
    }
    catch {
        console.error('Worker tick failed. Check database configuration.');
        if (once)
            process.exitCode = 1;
    }
    if (once || stopping)
        break;
    await sleep(Math.max(10, Number(process.env.WORKER_INTERVAL_SECONDS) || 60) * 1000);
} while (!stopping);
