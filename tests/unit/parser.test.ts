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
    assert.equal(j.time_start, null);
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

test('не принимаем служебное "еще 1" за адрес и заголовок', async () => {
    const j = await parser.parse('еще 1\n\nК 13:00\nдва грузчика\nРодниковая 2/3,(16 коробок 214кг)\n350\\2\n@GruZZexpert544');
    assert.equal(j.address, 'Родниковая 2/3');
    assert.equal(j.title, 'два грузчика');
    assert.equal(j.time_start, '13:00');
});

test('не принимаем "еще 2" за адрес', async () => {
    const j = await parser.parse('еще 2\n12:30\nтэц -6(остановка)\n4 грузчика\nвыгрузить два десятитонника\n@GruZZexpert544');
    assert.equal(j.address, null);
    assert.equal(j.title, '4 грузчика');
    assert.equal(j.time_start, '12:30');
});

test('понимаем способы оплаты и тип занятости', async () => {
    const cases = [
        ['Нужен грузчик\n3000 руб\nРасчет после смены', 'immediate', null],
        ['Нужен помощник\n3500 за смену\nОплата еженедельно\nПодработка', 'weekly', 'Подработка'],
        ['Требуется грузчик\n4500 руб\nОплата на карту\nРазовая работа', 'immediate', 'Разовая работа'],
        ['Нужен водитель\nОплата ежемесячно\nПостоянная', 'monthly', 'Постоянная'],
    ] as const;
    for (const [text, payment, employment] of cases) {
        const j = await parser.parse(text);
        assert.equal(j.payment_type, payment);
        assert.equal(j.employment_type, employment);
    }
});

test('понимаем время внутри строки объявления и не путаем его с концом смены', async () => {
    const j = await parser.parse('На 14.00 нужен 1 чел. в помощь\nБольшая 582\n400 руб/час');
    assert.equal(j.time_start, '14:00');
    assert.equal(j.time_end, null);
    assert.equal(j.address, 'Большая 582');
});

test('адрес и оплата могут находиться в одной строке', async () => {
    const j = await parser.parse('Требуется один человек\nБольшая 582 Оплата 400 руб/час после смены\n79513870400');
    assert.equal(j.address, 'Большая 582');
    assert.equal(j.salary_min, 400);
    assert.equal(j.payment_type, 'immediate');
    assert.equal(j.contact_phone, '79513870400');
});
