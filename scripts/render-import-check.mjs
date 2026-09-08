const base = process.env.RENDER_URL || 'https://podrabotka154.onrender.com';
const secret = process.env.CRON_SECRET;
const headers = secret ? { authorization: `Bearer ${secret}` } : {};

const response = await fetch(`${base}/api/telegram/import-public`, { headers });
const text = await response.text();
if (!response.ok) throw new Error(`Import endpoint returned ${response.status}: ${text}`);

const payload = JSON.parse(text);
if (payload.ok !== true || !Array.isArray(payload.results)) {
  throw new Error(`Unexpected import response: ${text}`);
}

console.log(JSON.stringify({
  ok: payload.ok,
  results: payload.results.map((r) => ({
    source: r.source,
    fetched: r.fetched,
    saved: r.saved,
    new_messages: r.new_messages,
    parsed: r.parsed,
    error: r.error ?? null,
  })),
  queue: payload.queue,
}, null, 2));
