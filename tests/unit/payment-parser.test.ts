import test from 'node:test';
import assert from 'node:assert/strict';
import { ConservativeParser } from '../../services/ai/index.ts';

const parser = new ConservativeParser();

test('парсер сохраняет способы оплаты в DB enum', async () => {
    assert.equal((await parser.parse('Требуется грузчик\nОплата наличкой 3000₽')).payment_type, 'immediate');
    assert.equal((await parser.parse('Требуется грузчик\nОплата ежедневно 3000₽')).payment_type, 'daily');
    assert.equal((await parser.parse('Требуется грузчик\nОплата раз в неделю 3000₽')).payment_type, 'weekly');
    assert.equal((await parser.parse('Требуется грузчик\nОплата раз в месяц 3000₽')).payment_type, 'monthly');
});

test('парсер понимает время 14.00', async () => {
    const j = await parser.parse('На 14.00 нужен 1 чел. в помощь\nУл. Станционная 104\n1500 руб');
    assert.equal(j.time_start, '14:00');
    assert.equal(j.address, 'Ул. Станционная 104');
});
