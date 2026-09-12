import dns from 'node:dns';
import { createClient } from '@supabase/supabase-js';
import { PublicChannelAdapter, type TelegramMessage } from '../services/telegram/index.ts';

dns.setDefaultResultOrder('ipv4first');

type Source = { id: string; username: string };

const supabaseUrl = process.env.PODRABOTKA154_SUPABASE_URL;
const supabaseKey = process.env.PODRABOTKA154_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error('PODRABOTKA154_SUPABASE_URL is not configured');
if (!supabaseKey) throw new Error('PODRABOTKA154_SUPABASE_SERVICE_ROLE_KEY is not configured');

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: sources, error: sourceError } = await supabase.rpc('list_public_telegram_sources');
if (sourceError) throw new Error(`Cannot list Telegram sources: ${sourceError.message}`);

const activeSources = (sources ?? []) as Source[];
console.log(`Active public Telegram sources: ${activeSources.length}`);

let fetched = 0;
let failed = 0;

for (const source of activeSources) {
  try {
    const adapter = new PublicChannelAdapter(source.username, 20);
    await adapter.connect();
    let messages: TelegramMessage[];
    try {
      messages = await adapter.fetchMessages();
    } finally {
      await adapter.disconnect();
    }

    if (messages.length === 0) {
      console.log(`@${source.username}: no messages`);
      continue;
    }

    const { data, error } = await supabase.rpc('upsert_public_telegram_messages', {
      p_source_id: source.id,
      p_messages: messages,
    });
    if (error) throw new Error(error.message);

    fetched += messages.length;
    console.log(`@${source.username}: fetched=${messages.length}, returned=${Array.isArray(data) ? data.length : 0}`);
  } catch (error) {
    failed += 1;
    console.error(`@${source.username}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log(`Telegram import finished: fetched=${fetched}, failed_sources=${failed}`);
if (failed > 0) process.exitCode = 1;
