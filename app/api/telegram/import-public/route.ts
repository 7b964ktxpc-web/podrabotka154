import { NextResponse } from 'next/server';
import { serviceDb, check } from '@/lib/service-db';
import { PublicChannelAdapter } from '@/services/telegram';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const db = serviceDb();
    const { data: sources, error } = await db
        .from('telegram_sources')
        .select('id,username,adapter')
        .eq('active', true)
        .eq('adapter', 'public_web');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const results: Array<Record<string, unknown>> = [];
    for (const source of sources ?? []) {
        try {
            const adapter = new PublicChannelAdapter(source.username, 20);
            await adapter.connect();
            const messages = await adapter.fetchMessages();
            let inserted = 0;
            for (const message of messages) {
                const result = check(await db.from('telegram_messages').upsert(
                    { ...message, source_id: source.id },
                    { onConflict: 'source_id,telegram_message_id', ignoreDuplicates: true },
                ).select('id'));
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

    return NextResponse.json({ ok: true, results });
}
