import test from 'node:test';
import assert from 'node:assert/strict';

import { GET } from '../../app/api/telegram/import-public/route.ts';

test('telegram import route fails closed when cron secret is missing', async () => {
  const previous = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;

  try {
    const response = await GET(new Request('http://localhost/api/telegram/import-public'));

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'Cron is not configured' });
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test('telegram import route rejects an invalid bearer token', async () => {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = 'test-secret';

  try {
    const response = await GET(new Request('http://localhost/api/telegram/import-public', {
      headers: { authorization: 'Bearer wrong-secret' },
    }));

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});
