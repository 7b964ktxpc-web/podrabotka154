import test from 'node:test';
import assert from 'node:assert/strict';
import { ConservativeParser } from '../../services/ai/index.ts';
const parser = new ConservativeParser();
test('новость не вакансия', async () => assert.equal((await parser.parse('В Новосибирске сегодня тепло и солнечно.')).is_job, false));
test('сохраняем неизвестные поля null', async () => { const j = await parser.parse('Требуется грузчик. Подробности при встрече.'); assert.equal(j.is_job, true); for (const k of ['salary_min', 'address', 'contact_phone', 'date_start', 'city'] as const)
    assert.equal(j[k], null); });
test('извлекаем только явно указанное', async () => { const j = await parser.parse('Требуется грузчик\nОплата 4500 ₽ / смена\nАдрес: ул. Большевистская, 45\nКонтакт @employer_nsk'); assert.equal(j.salary_min, 4500); assert.equal(j.address, 'ул. Большевистская, 45'); assert.equal(j.contact_telegram, 'employer_nsk'); assert.ok(j.confidence < 0.5); });
