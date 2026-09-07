import { serviceDb, check } from '../lib/service-db';
import { env, appUrl } from '../lib/env';
import { sign } from '../lib/signature';
if (process.env.SANDBOX_PAYMENTS_ENABLED !== 'true' || process.env.PAYMENT_PROVIDER !== 'sandbox')
    throw new Error('Sandbox is disabled');
const id = process.argv[2];
const status = process.argv.includes('--refund') ? 'refunded' : 'paid';
if (!id || !/^[0-9a-f-]{36}$/i.test(id))
    throw new Error('Usage: npm run sandbox:pay -- ORDER_UUID [--refund]');
const { data: o } = check(await serviceDb().from('orders').select('*').eq('id', id).single());
const body = JSON.stringify({ provider: 'sandbox', event_id: `${status}:${id}`, payment_id: `sandbox:${id}`, order_id: id, amount: o.amount, currency: o.currency, status });
const ts = String(Math.floor(Date.now() / 1000));
const r = await fetch(appUrl() + '/api/payments/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-payment-timestamp': ts, 'x-payment-signature': sign(body, ts, env('PAYMENT_WEBHOOK_SECRET')) }, body });
if (!r.ok)
    throw new Error('Webhook rejected test payment');
console.log('Sandbox webhook accepted. No real money was charged.');
