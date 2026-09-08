import test from 'node:test';
import assert from 'node:assert/strict';
import { ConservativeParser } from '../../services/ai/index.ts';

test('does not treat generic Cyrillic wording as an address', async () => {
  const parsed = await new ConservativeParser().parse('Требуется 1 чел\nПЕР БЛИЖАЙШЕЕ\nТЦ Невский\nОплата сразу');
  assert.equal(parsed.address, null);
});

test('keeps explicit end time as time_end', async () => {
  const parsed = await new ConservativeParser().parse('Нужен грузчик\nДо 20:00\nОплата после смены');
  assert.equal(parsed.time_start, null);
  assert.equal(parsed.time_end, '20:00');
});

test('accepts explicit street address with house number', async () => {
  const parsed = await new ConservativeParser().parse('Требуется грузчик\nул. Станционная 104\nОплата 400 руб/час');
  assert.equal(parsed.address, 'ул. Станционная 104');
});

test('does not invent salary from ambiguous split notation', async () => {
  const parsed = await new ConservativeParser().parse('Нужен человек\nРодниковая 2/3\n350/2');
  assert.equal(parsed.salary_min, null);
  assert.equal(parsed.salary_max, null);
});
