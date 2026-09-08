const base = process.env.RENDER_URL || 'https://podrabotka154.onrender.com';
const secret = process.env.CRON_SECRET;

if (!secret) {
  console.error('CRON_SECRET is not configured');
  process.exit(1);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 60_000);

try {
  const response = await fetch(`${base}/api/telegram/import-public`, {
    headers: { authorization: `Bearer ${secret}` },
    signal: controller.signal,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Import endpoint returned ${response.status}: ${text}`);
  }
  console.log(text);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unknown cron import error');
  process.exit(1);
} finally {
  clearTimeout(timeout);
}
