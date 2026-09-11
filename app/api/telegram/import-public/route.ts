import { PublicChannelAdapter } from '@/services/telegram';
import { authorizeCronRequest } from '@/lib/cron-auth';
import { db } from '@/lib/db';
import { hasRole } from '@/lib/domain';
import { serviceDb, check } from '@/lib/service-db';

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
      adapter = new PublicChannelAdapter(source.username, 20);
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
      const message = e instanceof Error ? e.message : 'Unknown import error';
      failed++;
      results.push({ source: source.username, error: message, failed: 1 });
    }
  }

  return Response.json({ ok: failed === 0, results, queue: { queued, failed } }, { status: failed === 0 ? 200 : 502 });
}
