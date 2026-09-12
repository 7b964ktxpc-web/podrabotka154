import { serviceDb, check } from './service-db';
export async function rate(key: string, limit = 30, seconds = 60) { const { data } = check(await serviceDb().rpc('consume_rate', { p_key: key, p_limit: limit, p_seconds: seconds })); if (!data)
    throw new Error('RATE_LIMIT'); }
export async function softRate(key: string, limit = 30, seconds = 60) { try {
        await rate(key, limit, seconds);
    }
    catch (e) { if (e instanceof Error && e.message === 'RATE_LIMIT')
            throw e; } }
