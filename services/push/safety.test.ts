import test from 'node:test';
import assert from 'node:assert/strict';
import { allowedPushEndpoint } from './safety';

test('accepts supported HTTPS push endpoints', () => {
  assert.equal(allowedPushEndpoint('https://fcm.googleapis.com/fcm/send/abc'), true);
  assert.equal(allowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'), true);
  assert.equal(allowedPushEndpoint('https://web.push.apple.com/Qx/abc'), true);
  assert.equal(allowedPushEndpoint('https://example.notify.windows.com/wpush/v1/abc'), true);
});

test('rejects insecure or unrelated push endpoints', () => {
  assert.equal(allowedPushEndpoint('http://fcm.googleapis.com/fcm/send/abc'), false);
  assert.equal(allowedPushEndpoint('https://example.com/push/abc'), false);
  assert.equal(allowedPushEndpoint('https://user:pass@fcm.googleapis.com/fcm/send/abc'), false);
  assert.equal(allowedPushEndpoint('https://fcm.googleapis.com:443/fcm/send/abc'), false);
  assert.equal(allowedPushEndpoint('not-a-url'), false);
});
