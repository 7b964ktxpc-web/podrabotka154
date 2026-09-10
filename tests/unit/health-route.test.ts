import test from 'node:test';
import assert from 'node:assert/strict';
import { GET } from '../../app/api/health/route.ts';

test('health endpoint returns HTTP 200 and ok status', async () => {
  const response = await GET();

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});
