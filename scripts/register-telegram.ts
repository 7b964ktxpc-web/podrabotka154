import { env, appUrl } from '../lib/env';
const url = appUrl();
if (!url.startsWith('https://'))
    throw new Error('Telegram needs a public HTTPS URL');
const secret = env('TELEGRAM_WEBHOOK_SECRET');
if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret))
    throw new Error('Use 32+ random A-Z/a-z/0-9/_/- characters for the webhook secret');
const r = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/setWebhook`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url + '/api/telegram/webhook', secret_token: secret, allowed_updates: ['channel_post'], drop_pending_updates: false }) });
const result = await r.json();
if (!r.ok || !result.ok)
    throw new Error('Webhook registration failed. Check the bot token and HTTPS deployment.');
console.log('Webhook registered. The bot still needs access to each configured channel.');
