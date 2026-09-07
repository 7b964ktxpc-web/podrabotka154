import test from 'node:test';
import assert from 'node:assert/strict';
import { ConservativeParser } from '../../services/ai/index.ts';
import { parseSalary, readFilters } from '../../lib/domain.ts';
test('email не становится Telegram-контактом', async () => { const j = await new ConservativeParser().parse('Требуется грузчик, пишите work@example.org'); assert.equal(j.contact_telegram, null); assert.equal(j.contact_email, 'work@example.org'); });
test('нижняя граница не создаёт верхнюю', () => assert.deepEqual(parseSalary('Оплата от 4000 ₽ за смену'), { salary_min: 4000, salary_max: null, salary_type: 'shift' }));
test('верхняя граница не создаёт нижнюю', () => assert.deepEqual(parseSalary('до 5000 руб за смену'), { salary_min: null, salary_max: 5000, salary_type: 'shift' }));
test('копейки распознаются', () => assert.equal(parseSalary('Оплата 4500,50 ₽').salary_min, 4500.5));
test('несуществующая дата не передаётся в SQL', () => assert.equal(readFilters({ day: '2026-02-31' }).day, null));
