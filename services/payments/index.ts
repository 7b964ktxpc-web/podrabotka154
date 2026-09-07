import { verifySignature } from '../../lib/signature';
import { serviceDb, check } from '../../lib/service-db';
import { env } from '../../lib/env';
import { z } from 'zod';
export const paymentEventSchema = z.object({ provider: z.literal('sandbox'), event_id: z.string().min(1).max(150), payment_id: z.string().min(1).max(150), order_id: z.string().uuid(), amount: z.number().int().nonnegative(), currency: z.literal('RUB'), status: z.enum(['paid', 'refunded']) }).strict();
export type PaymentEvent = z.infer<typeof paymentEventSchema>;
export interface PaymentProvider {
    createPayment(orderId: string): Promise<{
        id: string;
        mode: 'sandbox';
    }>;
    verifyPayment(body: string, timestamp: string, signature: string): PaymentEvent;
    handleWebhook(event: PaymentEvent): Promise<void>;
    refundPayment(orderId: string): Promise<void>;
}
export class SandboxPaymentProvider implements PaymentProvider {
    private enabled() { if (process.env.PAYMENT_PROVIDER !== 'sandbox' || process.env.SANDBOX_PAYMENTS_ENABLED !== 'true')
        throw new Error('Тестовые платежи отключены'); }
    async createPayment(orderId: string) { this.enabled(); check(await serviceDb().from('orders').select('id').eq('id', orderId).single()); return { id: `sandbox:${orderId}`, mode: 'sandbox' as const }; }
    verifyPayment(body: string, timestamp: string, signature: string) { this.enabled(); if (!verifySignature(body, timestamp, signature, env('PAYMENT_WEBHOOK_SECRET')))
        throw new Error('Неверная подпись'); return paymentEventSchema.parse(JSON.parse(body)); }
    async handleWebhook(event: PaymentEvent) { this.enabled(); check(await serviceDb().rpc('settle_payment', { event })); }
    async refundPayment(orderId: string) { this.enabled(); const { data: o } = check(await serviceDb().from('orders').select('*').eq('id', orderId).single()); await this.handleWebhook({ provider: 'sandbox', event_id: `refund:${orderId}`, payment_id: `sandbox:${orderId}`, order_id: orderId, amount: o.amount, currency: 'RUB', status: 'refunded' }); }
}
export class PaymentService {
    constructor(public provider: PaymentProvider) { }
    createPayment(id: string) { return this.provider.createPayment(id); }
    verifyPayment(b: string, t: string, s: string) { return this.provider.verifyPayment(b, t, s); }
    handleWebhook(e: PaymentEvent) { return this.provider.handleWebhook(e); }
    refundPayment(id: string) { return this.provider.refundPayment(id); }
}
