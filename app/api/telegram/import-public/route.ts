import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { serviceDb } from '@/lib/service-db';
import { fingerprint } from '@/lib/domain';
import { createVacancyParser } from '@/services/ai/agent';
import { PublicChannelAdapter } from '@/services/telegram';
import { geocodeAddress } from '@/services/geocoder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const parser = createVacancyParser();

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'Cron is not configured' }, { status: 503 });
  }

  if (request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = await db();
  const admin = serviceDb();
  const { data: sources, error } = await client.rpc('list_public_telegram_sources');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<Record<string, unknown>> = [];
  let processed = 0;
  let failed = 0;
  let geocoded = 0;
  let geocodeFailed = 0;

  for (const source of sources ?? []) {
    let adapter: PublicChannelAdapter | null = null;
    let sourceFailed = 0;
    let sourceGeocoded = 0;
    try {
      adapter = new PublicChannelAdapter(source.username, 20);
      await adapter.connect();
      const messages = await adapter.fetchMessages();

      const { data: saved, error: saveError } = await client.rpc('upsert_public_telegram_messages', {
        p_source_id: source.id,
        p_messages: messages,
      });
      if (saveError) throw saveError;

      const newMessages = saved ?? [];
      let parsed = 0;

      for (const message of newMessages) {
        try {
          const parsedJob = await parser.parse(message.message_text);
          const stored = checkPublicResult(
            await client.rpc('store_public_telegram_parsed', {
              p_message: message.id,
              p_result: parsedJob,
              p_fingerprint: fingerprint({ ...parsedJob, city: null }),
            }),
          );

          const jobId = stored.data;
          if (jobId && parsedJob.address) {
            try {
              const geo = await geocodeAddress(parsedJob.address, source.city);
              if (geo) {
                const { error: geoError } = await admin
                  .from('jobs')
                  .update({
                    latitude: geo.latitude,
                    longitude: geo.longitude,
                    location_precision: geo.precision,
                  })
                  .eq('id', jobId)
                  .eq('source_type', 'telegram');

                if (geoError) throw geoError;
                geocoded++;
                sourceGeocoded++;
              }
            } catch (e) {
              geocodeFailed++;
              console.error('Public Telegram geocoding failed', {
                source: source.username,
                messageId: message.id,
                error: e instanceof Error ? e.message : 'Unknown geocoding error',
              });
            }
          }

          parsed++;
          processed++;
        } catch (e) {
          failed++;
          sourceFailed++;
          console.error('Public Telegram parse failed', {
            source: source.username,
            messageId: message.id,
            error: e instanceof Error ? e.message : 'Unknown parse error',
          });
        }
      }

      await adapter.disconnect();
      adapter = null;
      results.push({
        source: source.username,
        fetched: messages.length,
        saved: saved?.length ?? 0,
        new: newMessages.length,
        parsed,
        failed: sourceFailed,
        geocoded: sourceGeocoded,
      });
    } catch (e) {
      if (adapter) {
        try { await adapter.disconnect(); } catch { /* ignore cleanup errors */ }
      }
      const message = e instanceof Error ? e.message : 'Unknown import error';
      results.push({ source: source.username, error: message });
    }
  }

  // Backfill coordinates for older Telegram jobs that were imported before
  // automatic geocoding was enabled. Only exact-address jobs are eligible.
  if (process.env.YANDEX_GEOCODER_API_KEY) {
    const { data: pendingGeo, error: pendingGeoError } = await admin
      .from('jobs')
      .select('id,address_raw,city')
      .eq('source_type', 'telegram')
      .eq('location_precision', 'exact')
      .is('latitude', null)
      .not('address_raw', 'is', null)
      .limit(20);

    if (pendingGeoError) {
      console.error('Telegram geocode queue read failed', pendingGeoError);
    } else {
      for (const job of pendingGeo ?? []) {
        try {
          const geo = await geocodeAddress(job.address_raw, job.city);
          if (!geo) continue;
          const { error: updateError } = await admin
            .from('jobs')
            .update({ latitude: geo.latitude, longitude: geo.longitude, location_precision: geo.precision })
            .eq('id', job.id)
            .is('latitude', null);
          if (updateError) throw updateError;
          geocoded++;
        } catch (e) {
          geocodeFailed++;
          console.error('Telegram geocode backfill failed', {
            jobId: job.id,
            error: e instanceof Error ? e.message : 'Unknown geocoding error',
          });
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    results,
    queue: { processed, failed, geocoded, geocodeFailed },
  });
}

function checkPublicResult<T extends { error: unknown; data?: unknown }>(result: T): T {
  if (result.error) throw result.error;
  return result;
}
