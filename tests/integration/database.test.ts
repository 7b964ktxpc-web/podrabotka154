import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { ConservativeParser } from '../../services/ai';
import { fingerprint } from '../../lib/domain';

// Explicit opt-in. Never run this against the production database.
const url = process.env.TEST_SUPABASE_URL;
const anon = process.env.TEST_SUPABASE_ANON_KEY;
const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
function ok<T extends { error: unknown }>(r: T): Extract<T, { error: null }> {
    assert.equal(r.error, null, JSON.stringify(r.error));
    return r as Extract<T, { error: null }>;
}
test('RLS, employer, moderation, favorites, import and payment transaction', {
    skip: !(url && anon && key)
}, async () => {
    assert.notEqual(url, process.env.SUPABASE_URL, 'Use a disposable testing project');
    const service = createClient(url!, key!, { auth: { persistSession: false } });
    const auth = createClient(url!, anon!, { auth: { persistSession: false } });
    const guest = createClient(url!, anon!, { auth: { persistSession: false } });
    const email = `integration-${crypto.randomUUID()}@example.org`;
    const password = crypto.randomUUID() + 'Ab1!';
    const { data: created } = ok(await service.auth.admin.createUser({ email, password, email_confirm: true }));
    const uid = created.user!.id;
    ok(await auth.auth.signInWithPassword({ email, password }));
    const { data: city } = ok(await service.from('cities').select('id').limit(1).single());
    const { data: employer } = ok(await auth.rpc('save_employer', { p: {
        slug: 'test-' + crypto.randomUUID(), name: 'Тестовая компания',
        description: 'Integration fixture', city_id: city.id
    } }));
    assert.ok(employer);
    const { data: jobId } = ok(await auth.rpc('save_job', { p: {
        title: 'Тестовая вакансия ' + crypto.randomUUID(),
        description: 'Тестовые данные, не для реальных посетителей', city_id: city.id,
        salary_min: 4500, salary_max: 4500, salary_type: 'shift', address_raw: 'ул. Большевистская, 45'
    }, p_id: null }));
    assert.equal(ok(await guest.from('jobs').select('id').eq('id', jobId)).data.length, 0, 'Draft leaked');
    assert.ok((await auth.rpc('moderate_job', { p_id: jobId, p_status: 'published', p_reason: '' })).error);
    assert.ok((await auth.from('profiles').update({ roles: ['admin'] }).eq('id', uid)).error);
    ok(await auth.rpc('submit_job', { p_id: jobId }));
    ok(await service.from('profiles').update({ roles: ['user', 'employer', 'admin'] }).eq('id', uid));
    ok(await auth.rpc('moderate_job', { p_id: jobId, p_status: 'published', p_reason: 'Integration test' }));
    assert.equal(ok(await guest.from('jobs').select('id').eq('id', jobId)).data.length, 1);
    ok(await auth.from('favorites').insert({ user_id: uid, job_id: jobId }));
    assert.equal(ok(await auth.from('favorites').select('*').eq('job_id', jobId)).data.length, 1);
    const { data: product } = ok(await service.from('products').select('*').eq('code', 'BOOST').single());
    ok(await service.from('products').update({ active: true }).eq('id', product.id));
    const token = crypto.randomUUID();
    const args = { p_product: product.id, p_job: jobId, p_key: token };
    const { data: order } = ok(await auth.rpc('make_order', args));
    assert.equal(ok(await auth.rpc('make_order', args)).data, order);
    const event = {
        provider: 'sandbox', event_id: crypto.randomUUID(), payment_id: crypto.randomUUID(),
        order_id: order, amount: product.price_kopecks, currency: 'RUB', status: 'paid'
    };
    assert.ok((await auth.rpc('settle_payment', { event })).error, 'Client settled payment');
    assert.ok((await service.rpc('settle_payment', { event: { ...event, amount: product.price_kopecks + 1 } })).error);
    ok(await service.rpc('settle_payment', { event }));
    ok(await service.rpc('settle_payment', { event }));
    assert.equal(ok(await service.from('job_promotions').select('id').eq('order_id', order)).data.length, 1);
    ok(await service.rpc('settle_payment', { event: { ...event, event_id: crypto.randomUUID(), status: 'refunded' } }));
    assert.equal(ok(await service.from('orders').select('status').eq('id', order).single()).data.status, 'refunded');
    const { data: source } = ok(await service.from('telegram_sources').insert({
        name: 'Integration', username: 'test_' + crypto.randomUUID().replaceAll('-', '').slice(0, 12), city_id: city.id, active: true
    }).select().single());
    const text = 'Требуется грузчик ' + crypto.randomUUID() + '\nОплата 4500 ₽ / смена';
    const { data: message } = ok(await service.from('telegram_messages').insert({
        source_id: source.id, telegram_message_id: 1, message_text: text,
        message_date: new Date().toISOString(), message_url: `https://t.me/${source.username}/1`, raw_payload: { text }
    }).select().single());
    assert.equal(ok(await service.from('work_queue').select('id').eq('dedupe_key', 'parse:' + message.id)).data.length, 1);
    const parsed = await new ConservativeParser().parse(text);
    const params = { p_message: message.id, p_result: parsed, p_fingerprint: fingerprint(parsed) };
    const { data: imported } = ok(await service.rpc('store_parsed', params));
    assert.equal(ok(await service.rpc('store_parsed', params)).data, imported);
    assert.equal(ok(await service.from('jobs').select('status').eq('id', imported).single()).data.status, 'pending_moderation');
    console.log('Test records remain for audit. Reset the disposable database after the run.');
});
