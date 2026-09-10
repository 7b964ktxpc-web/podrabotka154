import test from 'node:test';
import assert from 'node:assert/strict';
import { fullAddress } from '../../lib/maps.ts';

test('адрес без города получает город источника', () => {
  assert.equal(fullAddress('Новосибирск', 'ул. Кирова, 20'), 'Новосибирск, ул. Кирова, 20');
});

test('пустой адрес остаётся пустым', () => {
  assert.equal(fullAddress('Новосибирск', '   '), null);
});
