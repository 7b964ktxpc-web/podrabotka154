import test from 'node:test';
import assert from 'node:assert/strict';

import { authorizeCronRequest } from '../../lib/cron-auth.ts';

test('telegram import authorization fails closed when cron secret is missing', () => {
  const response = authorizeCronRequest(
    new Request('http://localhost/api/telegram/import-public'),
    undefined,
  );

  assert.deepEqual(response, { ok: false, status: 503 });
});

test('telegram import authorization rejects an invalid bearer token', () => {
  const response = authorizeCronRequest(
    new Request('http://localhost/api/telegram/import-public', {
      headers: { authorization: 'Bearer wrong-secret' },
    }),
    'test-secret',
  );

  assert.deepEqual(response, { ok: false, status: 401 });
});

test('telegram import authorization accepts the configured bearer token', () => {
  const response = authorizeCronRequest(
    new Request('http://localhost/api/telegram/import-public', {
      headers: { authorization: 'Bearer test-secret' },
    }),
    'test-secret',
  );

  assert.deepEqual(response, { ok: true });
});
