import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverConcurrentSession } from './client.js';
import type { StoredSession } from '../types.js';

function createSession(overrides: Partial<StoredSession> = {}): StoredSession {
  return {
    session: {
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_at: 1_900_000_000,
    },
    user: {
      id: 'user-1',
      email: 'user@example.com',
    },
    updatedAt: '2026-04-01T18:00:00.000Z',
    ...overrides,
  };
}

test('recoverConcurrentSession prefers a newer refresh token written by another process', () => {
  const current = createSession();
  const candidate = createSession({
    session: {
      ...current.session,
      access_token: 'access-2',
      refresh_token: 'refresh-2',
    },
    updatedAt: '2026-04-01T18:00:10.000Z',
  });

  assert.deepEqual(recoverConcurrentSession(current, candidate), candidate);
});

test('recoverConcurrentSession ignores identical on-disk sessions', () => {
  const current = createSession();
  const candidate = createSession();

  assert.equal(recoverConcurrentSession(current, candidate), null);
});

test('recoverConcurrentSession accepts newer timestamps even when tokens match', () => {
  const current = createSession();
  const candidate = createSession({
    updatedAt: '2026-04-01T18:00:10.000Z',
  });

  assert.deepEqual(recoverConcurrentSession(current, candidate), candidate);
});
