import dns from 'node:dns';
import { PublicChannelAdapter, FALLBACK_PUBLIC_BASES } from '@/services/telegram';
import { authorizeCronRequest } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { hasRole } from '@/lib/domain';
import { serviceDb, check } from '@/lib/service-db';
import { runWorkerTick } from '@/worker/run';

dns.setDefaultResultOrder('ipv4first');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function authorize(request: Request) {
  const cron = authorizeCronRequest(request, process.env.CRON_SECRET);
  if (cron.ok) return true;

  const client = await db();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return false;
  const { data: profile } = await client.from('profiles').select('roles').eq('id', user.id).maybeSingle();
  return hasRole(profile?.roles ?? null, 'admin');
}

function errorText(e: unknown): string {
  if (e instanceof Error) {
    const cause = e.cause instanceof Error ? `: ${e.cause.message}` : '';
    return `${e.message}${cause}`.trim();
  }
  return String(e);
}

export async function GET(request: Request) {
  const authorized = await authorize(request);
  if (!authorized) {
    const cronConfigured = Boolean(process.env.CRON_SECRET);
    return Response.json(
      { error: cronConfigured ? 'Unauthorized' : 'Cron is not configured' },
      { status: cronConfigured ? 401 : 503 },
    );
  }

  const client = serviceDb();
  const { data: sources } = check(await client.rpc('list_public_telegram_sources'));

  const results: Array<Record<string, unknown>> = [];
  let queued = 0;
  let failed = 0;

  for (const source of sources ?? []) {
    let adapter: PublicChannelAdapter | null = null;
    try {
      adapter = new PublicChannelAdapter(source.username, 20, FALLBACK_PUBLIC_BASES, 8000);
      await adapter.connect();
      const messages = await adapter.fetchMessages();

      const { data: saved } = check(await client.rpc('upsert_public_telegram_messages', {
        p_source_id: source.id,
        p_messages: messages,
      }));

      const newMessages = saved ?? [];
      // New Telegram messages are queued for parsing, but publication remains
      // a separate moderation step. The worker may parse; it must not approve.
      queued += newMessages.length;

      await adapter.disconnect();
      adapter = null;
      results.push({
        source: source.username,
        fetched: messages.length,
        saved: saved?.length ?? 0,
        new: newMessages.length,
        queued: newMessages.length,
        failed: 0,
      });
    } catch (e) {
      if (adapter) {
        try { await adapter.disconnect(); } catch { /* ignore cleanup errors */ }
      }
      failed++;
      results.push({ source: source.username, error: errorText(e), failed: 1 });
    }
  }

  // Drain the parse queue in the same request so imported messages become jobs
  // even when no dedicated worker service is running.
  let parsed: number | null = null;
  let parsedError: string | null = null;
  try {
    const drained = await runWorkerTick({ batch: 25, signal: request.signal });
    parsed = drained.processed;
  } catch (e) {
    parsedError = errorText(e);
    console.error('Parse drain failed', e);
  }

  return Response.json(
    { ok: failed === 0, results, queue: { queued, failed }, parsed, parsedError },
    { status: failed === 0 ? 200 : 502 },
  );
}