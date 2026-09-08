import test from 'node:test';
import assert from 'node:assert/strict';
import { ConservativeParser } from '../../services/ai/index.ts';

const parser = new ConservativeParser();

test('новость не вакансия', async () => assert.equal((await parser.parse('В Новосибирске сегодня тепло и солнечно.')).is_job, false));

test('сохраняем неизвестные поля null', async () => {
    const j = await parser.parse('Требуется грузчик. Подробности при встрече.');
    assert.equal(j.is_job, true);
    for (const k of ['salary_min', 'address', 'contact_phone', 'date_start', 'city'] as const) assert.equal(j[k], null);
});

test('извлекаем только явно указанное', async () => {
    const j = await parser.parse('Требуется грузчик\nОплата 4500 ₽ / смена\nАдрес: ул. Большевистская, 45\nКонтакт @employer_nsk');
    assert.equal(j.salary_min, 4500);
    assert.equal(j.address, 'ул. Большевистская, 45');
    assert.equal(j.contact_telegram, 'employer_nsk');
    assert.ok(j.confidence < 0.5);
});

test('извлекаем адрес из обычной строки Telegram', async () => {
    const j = await parser.parse('Нужен помощник на ближайшее\nСтанционная улица, д. 59А\n350/3\n89231305754');
    assert.equal(j.is_job, true);
    assert.equal(j.address, 'Станционная улица, д. 59А');
    assert.equal(j.contact_phone, '89231305754');
});

test('извлекаем дату и время из объявления', async () => {
    const j = await parser.parse('Нужен грузчик\nДата: 09.09.2026 08:00\nСпортивная 21/1\n3000 руб');
    assert.equal(j.date_start, '2026-09-09');
    assert.equal(j.time_start, '08:00');
    assert.equal(j.address, 'Спортивная 21/1');
});

test('понимаем адрес без номера из поста диспетчера', async () => {
    const j = await parser.parse('срочно на ближайшее\n1 грузчика\nУлица широкая\nтранспортная компания.\nДо 20:00\n3000₽.\nНЕ ЗВОНИТЬ\nРасчет после смены\n8-952-923-47-50 Таня');
    assert.equal(j.is_job, true);
    assert.equal(j.address, 'Улица широкая');
    assert.equal(j.time_end, '20:00');
    assert.equal(j.salary_min, 3000);
    assert.equal(j.contact_phone, '8-952-923-47-50');
});

test('понимаем несколько распространенных адресных форматов', async () => {
    const cases = [
        ['К 13:00\nдва грузчика\nРодниковая 2/3, (16 коробок 214кг)', 'Родниковая 2/3'],
        ['Нужен грузчик\nБольшая 582 (ЖК самоцветы)\n400 руб/час', 'Большая 582'],
        ['Нужен грузчик\nКраснообск, 99\n350 руб', 'Краснообск, 99'],
        ['Нужен грузчик\nул. Станционная 104\n450 руб', 'ул. Станционная 104'],
    ] as const;
    for (const [text, expected] of cases) assert.equal((await parser.parse(text)).address, expected);
});

test('понимаем время "К 13:00" как начало смены', async () => {
    const j = await parser.parse('На ближайшее\nдва грузчика\nРодниковая 2/3\nК 13:00');
    assert.equal(j.time_start, '13:00');
    assert.equal(j.time_end, null);
});
