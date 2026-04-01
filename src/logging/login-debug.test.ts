import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLoginDebugEvents } from './login-debug.js';

test('summarizeLoginDebugEvents clears stale errors after successful login', () => {
  const summary = summarizeLoginDebugEvents(
    [
      {
        ts: '2026-04-01T12:00:00.000Z',
        type: 'login-url-generated',
        meta: {
          loginUrl: 'https://akademikasistan.com/login?code=ABCD-EFGH',
          userCode: 'ABCD-EFGH',
          requestId: 'request-1',
        },
      },
      {
        ts: '2026-04-01T12:01:00.000Z',
        type: 'login-error',
        message: 'CLI giriş isteğinin süresi doldu.',
        meta: {
          requestId: 'request-1',
        },
      },
      {
        ts: '2026-04-01T12:02:00.000Z',
        type: 'login-start',
      },
      {
        ts: '2026-04-01T12:03:00.000Z',
        type: 'session-stored',
        meta: {
          requestId: 'request-2',
        },
      },
      {
        ts: '2026-04-01T12:04:00.000Z',
        type: 'profile-fetch',
        meta: {
          requestId: 'request-2',
          userId: 'user-1',
        },
      },
    ],
    '/tmp/cli-debug-2026-04-01.jsonl',
  );

  assert.ok(summary);
  assert.equal(summary?.lastError, null);
  assert.equal(summary?.lastEventType, 'profile-fetch');
  assert.equal(summary?.lastRequestId, 'request-2');
  assert.equal(summary?.lastCode, 'ABCD-EFGH');
});
