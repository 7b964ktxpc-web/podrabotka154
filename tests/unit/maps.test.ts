import test from 'node:test';
import assert from 'node:assert/strict';
import { build2GisUrl, buildYandexMapsUrl, fullAddress } from '../../lib/maps.ts';

test('2ГИС: адрес кодируется целиком', () => {
  const address = 'Новосибирск, ул. Большевистская, 45';
  assert.equal(build2GisUrl(address), 'https://2gis.ru/search/%D0%9D%D0%BE%D0%B2%D0%BE%D1%81%D0%B8%D0%B1%D0%B8%D1%80%D1%81%D0%BA%2C%20%D1%83%D0%BB.%20%D0%91%D0%BE%D0%BB%D1%8C%D1%88%D0%B5%D0%B2%D0%B8%D1%81%D1%82%D1%81%D0%BA%D0%B0%D1%8F%2C%2045');
});

test('Яндекс: адрес кодируется целиком', () => {
  const address = 'Новосибирск, ул. Ленина, 5, корпус 2';
  assert.equal(buildYandexMapsUrl(address), 'https://yandex.ru/maps/?text=%D0%9D%D0%BE%D0%B2%D0%BE%D1%81%D0%B8%D0%B1%D0%B8%D1%80%D1%81%D0%BA%2C%20%D1%83%D0%BB.%20%D0%9B%D0%B5%D0%BD%D0%B8%D0%BD%D0%B0%2C%205%2C%20%D0%BA%D0%BE%D1%80%D0%BF%D1%83%D1%81%202');
});

test('адрес без города получает город источника', () => {
  assert.equal(fullAddress('Новосибирск', 'ул. Кирова, 20'), 'Новосибирск, ул. Кирова, 20');
});

test('пустой адрес остаётся пустым', () => {
  assert.equal(fullAddress('Новосибирск', '   '), null);
});
