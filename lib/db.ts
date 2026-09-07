import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from './env';
export async function db() {
    const store = await cookies();
    return createServerClient(env('SUPABASE_URL'), env('SUPABASE_ANON_KEY'), {
        cookies: {
            getAll() { return store.getAll(); },
            setAll(values) {
                try {
                    for (const { name, value, options } of values)
                        store.set(name, value, options);
                }
                catch { /* Server Components cannot write cookies; actions and routes can. */ }
            }
        }
    });
}
