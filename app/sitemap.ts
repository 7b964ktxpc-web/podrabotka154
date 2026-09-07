import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { configured, appUrl } from '@/lib/env';
import { check } from '@/lib/service-db';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> { const base = appUrl(); const out: MetadataRoute.Sitemap = [{ url: base, changeFrequency: 'daily' }, { url: base + '/jobs', changeFrequency: 'hourly' }]; if (!configured())
    return out; const c = await db(); for (const table of ['jobs', 'employers']) {
    let from = 0;
    while (true) {
        let q = c.from(table).select(table === 'jobs' ? 'id,updated_at' : 'id,slug,created_at').order('id').range(from, from + 499);
        if (table === 'jobs')
            q = q.eq('status', 'published').gt('expires_at', new Date().toISOString());
        const { data } = check(await q);
        const rows = (data || []) as unknown as {
            id: string;
            slug?: string;
            updated_at?: string;
            created_at?: string;
        }[];
        out.push(...rows.map(r => ({ url: base + (table === 'jobs' ? '/jobs/' + r.id : '/employers/' + r.slug), lastModified: r.updated_at || r.created_at })));
        if (rows.length < 500)
            break;
        from += 500;
    }
} return out; }
