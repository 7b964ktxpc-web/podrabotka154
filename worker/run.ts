import webpush from 'web-push';
import { serviceDb, check } from '../lib/service-db';
import { env } from '../lib/env';
import { fingerprint } from '../lib/domain';
import { createVacancyParser } from '../services/ai/agent';
import { allowedPushEndpoint } from '../services/push/safety';
import type { SupabaseClient } from '@supabase/supabase-js';

function assertParserProvider() {
  if (process.env.PARSER_PROVIDER && !['conservative', 'ai'].includes(process.env.PARSER_PROVIDER)) {
    throw new Error('Неизвестный parser provider');
  }
}

function createRuntime(c: SupabaseClient) {
  const parser = createVacancyParser();
  const pushReady = Boolean(process.env.PUSH_PUBLIC_KEY && process.env.PUSH_PRIVATE_KEY);
  if (pushReady) webpush.setVapidDetails(env('PUSH_SUBJECT'), env('PUSH_PUBLIC_KEY'), env('PUSH_PRIVATE_KEY'));

  async function processWork(kind: string, p: Record<string, string>) {
    if (kind === 'parse') {
      const { data: m } = check(await c.from('telegram_messages').select('*').eq('id', p.message_id).single());
      const { data: s } = check(await c.from('telegram_sources').select('adapter,city_id,cities(name)').eq('id', m.source_id).single());
      if (s?.adapter === 'public_web' && m.parse_status === 'processed') return;
      const result = await parser.parse(m.message_text);
      const city = (s?.cities as unknown as { name: string })?.name ?? null;
      const params = { p_message: m.id, p_result: result, p_fingerprint: fingerprint({ ...result, city }) };
      if (s?.adapter === 'public_web') {
        check(await c.rpc('store_public_telegram_parsed', params));
      } else {
        check(await c.rpc('store_parsed', params));
      }
      return;
    }
    if (kind === 'notify_job') { check(await c.rpc('notify_job', { p_job: p.job_id })); return; }
    if (kind === 'push') {
      if (!pushReady) throw new Error('Push keys not configured');
      const { data: n } = check(await c.from('notifications').select('*').eq('id', p.notification_id).maybeSingle());
      const { data: s } = check(await c.from('push_subscriptions').select('*').eq('id', p.subscription_id).maybeSingle());
      if (!n || !s || s.user_id !== n.user_id) return;
      if (n.kind === 'new_job') {
        const { data: j } = check(await c.from('jobs').select('id').eq('id', n.job_id).eq('status', 'published').gt('expires_at', new Date().toISOString()).maybeSingle());
        if (!j) return;
      }
      if (!allowedPushEndpoint(s.endpoint)) throw new Error('Blocked push endpoint');
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ id: n.id, title: n.title, url: n.url }), { TTL: 3600, timeout: 20000 }); }
      catch (e) { const status = (e as { statusCode?: number }).statusCode; if (status === 404 || status === 410) { check(await c.from('push_subscriptions').delete().eq('id', s.id)); return; } throw e; }
      return;
    }
    throw new Error('Unknown queue kind');
  }

  return { processWork, parser };
}

/**
 * Runs one worker cycle: expires stale jobs, claims a batch of work queue items
 * and processes them. Used both by the standalone worker loop and by the
 * Telegram import endpoint so incoming messages are parsed without a separate service.
 */
export async function runWorkerTick(options: { batch?: number; signal?: AbortSignal } = {}) {
  assertParserProvider();
  const c = serviceDb();
  const { processWork } = createRuntime(c);

  check(await c.rpc('expire_jobs'));
  const batch = Math.min(50, Math.max(1, Number(options.batch) || Number(process.env.WORKER_BATCH_SIZE) || 10));
  const { data: items } = check(await c.rpc('claim_work', { batch }));

  let processed = 0;
  for (const item of items ?? []) {
    if (options.signal?.aborted) break;
    try {
      await processWork(item.kind, item.payload);
      check(await c.from('work_queue').update({ done_at: new Date().toISOString(), locked_until: null, error: null }).eq('id', item.id).eq('lock_token', item.lock_token));
      processed++;
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Worker error';
      console.error('Work item failed', item.id, item.kind);
      check(await c.from('work_queue').update({ error: error.slice(0, 500), locked_until: null, available_at: new Date(Date.now() + Math.min(3600, 2 ** item.attempts * 15) * 1000).toISOString() }).eq('id', item.id).eq('lock_token', item.lock_token));
      if (item.kind === 'parse') check(await c.from('parser_runs').insert({ message_id: item.payload.message_id, provider: process.env.AI_PARSER_ENABLED === 'true' || process.env.PARSER_PROVIDER === 'ai' ? 'ai' : 'conservative', error: error.slice(0, 500) }));
    }
  }

  return { processed };
}