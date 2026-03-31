import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLoopbackCallbackResult } from './login.js';

const validPayload = JSON.stringify({
  state: 'test-state',
  session: {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
  },
  user: {
    id: 'user-id',
  },
});

test('allows CORS preflight for loopback callback', () => {
  const result = buildLoopbackCallbackResult(
    {
      method: 'OPTIONS',
      url: '/callback',
      headers: {
        'access-control-request-private-network': 'true',
      },
    },
    'test-state',
  );

  assert.equal(result.statusCode, 204);
  assert.equal(result.headers['Access-Control-Allow-Origin'], '*');
  assert.equal(result.headers['Access-Control-Allow-Methods'], 'POST, OPTIONS');
  assert.equal(result.headers['Access-Control-Allow-Private-Network'], 'true');
  assert.equal(result.body, '');
});

test('accepts valid callback payload', () => {
  const result = buildLoopbackCallbackResult(
    {
      method: 'POST',
      url: '/callback',
      headers: {},
    },
    'test-state',
    validPayload,
  );

  assert.equal(result.statusCode, 200);
  assert.ok(result.payload);
  assert.equal(result.payload?.user?.id, 'user-id');
});

test('rejects callback with wrong state', () => {
  const result = buildLoopbackCallbackResult(
    {
      method: 'POST',
      url: '/callback',
      headers: {},
    },
    'expected-state',
    validPayload,
  );

  assert.equal(result.statusCode, 400);
  assert.match(result.body, /State mismatch/);
});
