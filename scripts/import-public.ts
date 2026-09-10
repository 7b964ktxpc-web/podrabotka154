export {};

const appHost = process.env.APP_HOST?.replace(/^https?:\/\//, "").replace(/\/+$/, "");
const cronSecret = process.env.CRON_SECRET;

if (!appHost) {
  throw new Error("APP_HOST is not configured");
}

if (!cronSecret) {
  throw new Error("CRON_SECRET is not configured");
}

const response = await fetch(`https://${appHost}/api/telegram/import-public`, {
  method: "GET",
  headers: {
    authorization: `Bearer ${cronSecret}`,
  },
});

const body = await response.text();

console.log(body);

if (!response.ok) {
  throw new Error(`Public Telegram import failed with HTTP ${response.status}`);
}
