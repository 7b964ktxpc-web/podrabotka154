import { NextResponse } from 'next/server';
import { serviceDb } from '@/lib/service-db';
import { fingerprint } from '@/lib/domain';
import { createVacancyParser } from '@/services/ai/agent';
import { EnhancedConservativeParser } from '@/services/ai/enhanced-parser';
import { PublicChannelAdapter } from '@/services/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const parser = process.env.PARSER_PROVIDER === 'ai' || process.env.AI_PARSER_ENABLED === 'true'
  ? createVacancyParser()
  : new EnhancedConservativeParser();

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!cronSecret) return NextResponse.json({ error: 'Cron protection is not configured' }, { status: 503 });

  const client = serviceDb();
  const { data: sources, error } = await client.rpc('list_public_telegram_sources');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<Record<string, unknown>> = [];
  let processed = 0;
  let failed = 0;

  for (const source of sources ?? []) {
    let adapter: PublicChannelAdapter | null = null;
    try {
      adapter = new PublicChannelAdapter(source.username, 20);
      await adapter.connect();
      const messages = await adapter.fetchMessages();

      const { data: saved, error: saveError } = await client.rpc('upsert_public_telegram_messages', {
        p_source_id: source.id,
        p_messages: messages,
      });
      if (saveError) throw saveError;

      let parsed = 0;
      const newMessages = (saved ?? []).filter((message: { is_new?: boolean }) => message.is_new === true);
      for (const message of newMessages) {
        try {
          const parsedJob = await parser.parse(message.message_text, { referenceDate: message.message_date });
          const stored = await client.rpc('store_public_telegram_parsed', {
            p_message: message.id,
            p_result: parsedJob,
            p_fingerprint: fingerprint({ ...parsedJob, city: null }),
          });
          if (stored.error) throw stored.error;
          parsed++;
          processed++;
        } catch {
          failed++;
        }
      }

      await adapter.disconnect();
      adapter = null;
      results.push({ source: source.username, fetched: messages.length, saved: saved?.length ?? 0, new_messages: newMessages.length, parsed });
    } catch (e) {
      if (adapter) {
        try { await adapter.disconnect(); } catch { /* ignore cleanup errors */ }
      }
      const message = e instanceof Error ? e.message : 'Unknown import error';
      results.push({ source: source.username, error: message });
    }
  }

  return NextResponse.json({ ok: true, results, queue: { processed, failed } });
}
