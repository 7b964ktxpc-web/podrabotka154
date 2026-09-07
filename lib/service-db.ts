import { createClient } from '@supabase/supabase-js';
import { env } from './env';
// Server/worker only. Importing this module from a client component is prohibited.
export function serviceDb() { return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } }); }
// Preserve Supabase's success-branch data type: .single() is non-null,
// .maybeSingle() remains nullable, and head/count queries can return null data.
export function check<T extends {
    error: unknown;
}>(result: T): Extract<T, {
    error: null;
}> {
    if (result.error)
        throw result.error;
    return result as Extract<T, {
        error: null;
    }>;
}
