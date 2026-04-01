import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeRequestFailure,
  getApiErrorMessage,
  isTransientResponseStatus,
  shouldRetryRequest,
} from './client.js';

test('describeRequestFailure normalizes undici fetch failures', () => {
  const error = new TypeError('fetch failed', {
    cause: {
      code: 'ECONNRESET',
    },
  });

  assert.equal(describeRequestFailure(error), 'Ağ isteği tamamlanamadı (ECONNRESET).');
});

test('describeRequestFailure normalizes timeout failures', () => {
  const error = new Error('The operation was aborted due to timeout');
  error.name = 'TimeoutError';

  assert.match(describeRequestFailure(error), /zaman aşımına uğradı/u);
});

test('isTransientResponseStatus marks worker-side hiccups as retryable', () => {
  assert.equal(isTransientResponseStatus(503), true);
  assert.equal(isTransientResponseStatus(429), true);
  assert.equal(isTransientResponseStatus(401), false);
});

test('shouldRetryRequest only retries transient GET failures', () => {
  assert.equal(shouldRetryRequest('GET', 1, 3, { status: 503 }), true);
  assert.equal(shouldRetryRequest('GET', 3, 3, { status: 503 }), false);
  assert.equal(shouldRetryRequest('POST', 1, 3, { status: 503 }), false);
  assert.equal(shouldRetryRequest('GET', 1, 3, { error: new TypeError('fetch failed') }), true);
});

test('getApiErrorMessage gives a clearer message for transient 5xx failures', () => {
  assert.match(getApiErrorMessage(503), /Sunucu geçici olarak yanıt veremedi/u);
});
