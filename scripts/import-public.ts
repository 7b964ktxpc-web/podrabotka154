const appUrl = process.env.APP_URL?.replace(/\/+$/, "");
const cronSecret = process.env.CRON_SECRET;

if (!appUrl) {
  throw new Error("APP_URL is not configured");
}

if (!cronSecret) {
  throw new Error("CRON_SECRET is not configured");
}

const response = await fetch(`${appUrl}/api/telegram/import-public`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${cronSecret}`,
  },
});

const body = await response.text();

console.log(body);

if (!response.ok) {
  throw new Error(`Public Telegram import failed with HTTP ${response.status}`);
}
