import { PublicChannelAdapter } from '@/services/telegram';
import { authorizeCronRequest } from '@/lib/cron-auth';
import { serviceDb, check } from '@/lib/service-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = authorizeCronRequest(request, process.env.CRON_SECRET);

  if (!auth.ok) {
    return Response.json(
      { error: auth.status === 503 ? 'Cron is not configured' : 'Unauthorized' },
      { status: auth.status },
    );
  }

  const client = serviceDb();
  const { data: sources } = check(await client.rpc('list_public_telegram_sources'));

  const results: Array<Record<string, unknown>> = [];
  let queued = 0;
  let failed = 0;

  for (const source of sources ?? []) {
    let adapter: PublicChannelAdapter | null = null;
    let sourceFailed = 0;
    try {
      adapter = new PublicChannelAdapter(source.username, 20);
      await adapter.connect();
      const messages = await adapter.fetchMessages();

      const { data: saved } = check(await client.rpc('upsert_public_telegram_messages', {
        p_source_id: source.id,
        p_messages: messages,
      }));

      const newMessages = saved ?? [];
      queued += newMessages.length;

      await adapter.disconnect();
      adapter = null;
      results.push({
        source: source.username,
        fetched: messages.length,
        saved: saved?.length ?? 0,
        new: newMessages.length,
        queued: newMessages.length,
        failed: sourceFailed,
      });
    } catch (e) {
      if (adapter) {
        try { await adapter.disconnect(); } catch { /* ignore cleanup errors */ }
      }
      const message = e instanceof Error ? e.message : 'Unknown import error';
      failed++;
      sourceFailed++;
      results.push({ source: source.username, error: message, failed: sourceFailed });
    }
  }

  const body = {
    ok: failed === 0,
    results,
    queue: { queued, failed },
  };

  return Response.json(body, { status: failed === 0 ? 200 : 502 });
}
