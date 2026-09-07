import { appUrl } from './env';
export function checkOrigin(req: Request) { if (req.headers.get('origin') !== new URL(appUrl()).origin)
    throw new Error('Запрос отклонён'); }
export async function smallBody(req: Request, max = 65536) { if (Number(req.headers.get('content-length') || 0) > max)
    throw new Error('Слишком большой запрос'); const reader = req.body?.getReader(); if (!reader)
    return ''; const parts: Uint8Array[] = []; let size = 0; while (true) {
    const { done, value } = await reader.read();
    if (done)
        break;
    size += value.length;
    if (size > max) {
        await reader.cancel();
        throw new Error('Слишком большой запрос');
    }
    parts.push(value);
} return Buffer.concat(parts).toString('utf8'); }
