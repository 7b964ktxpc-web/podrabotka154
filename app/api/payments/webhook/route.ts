import { PaymentService, SandboxPaymentProvider } from '@/services/payments';
import { smallBody } from '@/lib/http';
export async function POST(req: Request) { if (process.env.SANDBOX_PAYMENTS_ENABLED !== 'true')
    return Response.json({ error: 'Платежи отключены' }, { status: 503 }); try {
    const body = await smallBody(req);
    const p = new PaymentService(new SandboxPaymentProvider());
    const event = p.verifyPayment(body, req.headers.get('x-payment-timestamp') || '', req.headers.get('x-payment-signature') || '');
    await p.handleWebhook(event);
    return Response.json({ ok: true });
}
catch {
    return Response.json({ error: 'Платёж не подтверждён' }, { status: 400 });
} }
