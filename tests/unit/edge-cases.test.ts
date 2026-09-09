import test from 'node:test';
import assert from 'node:assert/strict';
import { ConservativeParser } from '../../services/ai/index.ts';
import { parseSalary, readFilters } from '../../lib/domain.ts';
import { jobSchema } from '../../lib/validation.ts';

test('email не становится Telegram-контактом', async () => { const j = await new ConservativeParser().parse('Требуется грузчик, пишите work@example.org'); assert.equal(j.contact_telegram, null); assert.equal(j.contact_email, 'work@example.org'); });
test('нижняя граница не создаёт верхнюю', () => assert.deepEqual(parseSalary('Оплата от 4000 ₽ за смену'), { salary_min: 4000, salary_max: null, salary_type: 'shift' }));
test('верхняя граница не создаёт нижнюю', () => assert.deepEqual(parseSalary('до 5000 руб за смену'), { salary_min: null, salary_max: 5000, salary_type: 'shift' }));
test('копейки распознаются', () => assert.equal(parseSalary('Оплата 4500,50 ₽').salary_min, 4500.5));
test('несуществующая дата не передаётся в SQL', () => assert.equal(readFilters({ day: '2026-02-31' }).day, null));

const validJob = {
  title: 'Грузчик на склад',
  description: 'Разгрузка товара на складе, смена 8 часов.',
  city_id: 'ae5ab97d-b644-4814-a393-a22bf30ed6e8',
  category: '',
  salary_min: '3000',
  salary_max: '4000',
  salary_type: 'shift',
  address_raw: 'ул. Большевистская, 45',
  employment_type: 'Разовая работа',
  payment_type: 'immediate',
  date_start: '2026-09-10',
  date_end: '2026-09-10',
  time_start: '09:00',
  time_end: '18:00',
  contact_phone: '+79000000000',
  contact_telegram: '@gruzchik_nsk',
  contact_email: '',
  photo_url: '',
};

test('форма вакансии принимает корректные данные', () => {
  const result = jobSchema.safeParse(validJob);
  assert.equal(result.success, true);
});

test('форма вакансии отклоняет оплату, где максимум меньше минимума', () => {
  const result = jobSchema.safeParse({ ...validJob, salary_min: '5000', salary_max: '4000' });
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.error.issues.some(x => x.path.join('.') === 'salary_max'));
});

test('форма вакансии отклоняет дату окончания раньше начала', () => {
  const result = jobSchema.safeParse({ ...validJob, date_start: '2026-09-12', date_end: '2026-09-10' });
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.error.issues.some(x => x.path.join('.') === 'date_end'));
});

test('форма вакансии отклоняет время окончания раньше начала', () => {
  const result = jobSchema.safeParse({ ...validJob, time_start: '18:00', time_end: '09:00' });
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.error.issues.some(x => x.path.join('.') === 'time_end'));
});

test('форма вакансии допускает только время окончания для приоритетной вакансии', () => {
  const result = jobSchema.safeParse({ ...validJob, time_start: '', time_end: '17:30' });
  assert.equal(result.success, true);
});

test('форма вакансии отклоняет некорректный телефон', () => {
  const result = jobSchema.safeParse({ ...validJob, contact_phone: 'abc' });
  assert.equal(result.success, false);
});

test('форма вакансии отклоняет некорректный Telegram username', () => {
  const result = jobSchema.safeParse({ ...validJob, contact_telegram: '@bad' });
  assert.equal(result.success, false);
});
