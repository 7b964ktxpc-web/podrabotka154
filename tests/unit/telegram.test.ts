import test from 'node:test';
import assert from 'node:assert/strict';
import { ManualImportAdapter, PublicChannelAdapter } from '../../services/telegram/index.ts';

test('public Telegram adapter rejects invalid username', async () => {
    const adapter = new PublicChannelAdapter('bad');
    await assert.rejects(() => adapter.connect(), /Некорректный username Telegram/);
});

test('public Telegram adapter normalizes a validated message', () => {
    const adapter = new PublicChannelAdapter('rabota154NsK');
    const message = adapter.normalizeMessage({
        telegram_message_id: 123,
        message_text: 'Требуется грузчик',
        message_date: '2026-09-08T10:00:00.000Z',
        message_url: 'https://t.me/rabota154NsK/123',
        raw_payload: null,
    });

    assert.equal(message.telegram_message_id, 123);
    assert.equal(message.message_text, 'Требуется грузчик');
    assert.equal(message.message_url, 'https://t.me/rabota154NsK/123');
    assert.deepEqual(message.raw_payload, {
        telegram_message_id: 123,
        message_text: 'Требуется грузчик',
        message_date: '2026-09-08T10:00:00.000Z',
        message_url: 'https://t.me/rabota154NsK/123',
        raw_payload: null,
    });
});

test('manual Telegram adapter validates message URL and timestamp', () => {
    const adapter = new ManualImportAdapter();
    const message = adapter.normalizeMessage({
        telegram_message_id: 1,
        message_text: 'Нужен грузчик',
        message_date: '2026-09-08T10:00:00.000Z',
        message_url: 'https://t.me/rabota154NsK/1',
        raw_payload: { imported: true },
    });
    assert.equal(message.telegram_message_id, 1);
    assert.equal(message.message_text, 'Нужен грузчик');
    assert.deepEqual(message.raw_payload, { imported: true });

    assert.throws(() => adapter.normalizeMessage({
        telegram_message_id: 1,
        message_text: 'Нужен грузчик',
        message_date: 'not-a-date',
        message_url: 'https://t.me/rabota154NsK/1',
        raw_payload: null,
    }), /Некорректное сообщение/);
});
