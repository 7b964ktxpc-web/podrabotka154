import assert from 'node:assert/strict';
import test from 'node:test';
import { EnhancedConservativeParser } from '../../services/ai/enhanced-parser.ts';

test('парсер понимает явную дату и время внутри Telegram-текста', async () => {
  const parser = new EnhancedConservativeParser();
  const result = await parser.parse(
    '‼️На сегодня 08.09.26‼️\nНужен 1 человек в 17:00\nАдрес: Тихая, 1\nСтавка 380₽/час',
    { referenceDate: '2026-09-08T10:00:00+07:00' },
  );

  assert.equal(result.is_job, true);
  assert.equal(result.date_start, '2026-09-08');
  assert.equal(result.time_start, '17:00');
  assert.equal(result.salary_min, 380);
  assert.equal(result.salary_type, 'hour');
  assert.equal(result.address, 'Тихая, 1');
});

test('парсер понимает завтра и диапазон времени', async () => {
  const parser = new EnhancedConservativeParser();
  const result = await parser.parse(
    'Завтра в 09:00\n2 грузчика\n2-я Станционная ул, д. 21\nСтавка 2800\nРабота до 18:00',
    { referenceDate: '2026-09-08T10:00:00+07:00' },
  );

  assert.equal(result.date_start, '2026-09-09');
  assert.equal(result.time_start, '09:00');
  assert.equal(result.time_end, '18:00');
  assert.equal(result.salary_min, 2800);
  assert.equal(result.salary_max, 2800);
});

test('не превращает неоднозначную запись 400/2 в зарплату', async () => {
  const parser = new EnhancedConservativeParser();
  const result = await parser.parse('К 13:00\nдва грузчика\nРодниковая 2/3\n400/2\n@GruZZexpert544');

  assert.equal(result.is_job, true);
  assert.equal(result.time_start, '13:00');
  assert.equal(result.salary_min, null);
  assert.equal(result.salary_max, null);
});
