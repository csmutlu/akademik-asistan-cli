import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFallbackProfile, secondsUntil } from './login.js';

test('secondsUntil returns null when no expiry is provided', () => {
  assert.equal(secondsUntil(null), null);
});

test('secondsUntil never returns a negative value', () => {
  const past = new Date(Date.now() - 10_000).toISOString();
  assert.equal(secondsUntil(past), 0);
});

test('buildFallbackProfile keeps redeemed user identity', () => {
  const profile = buildFallbackProfile({
    status: 'approved',
    expiresAt: new Date().toISOString(),
    user: {
      id: 'user-1',
      email: 'test@example.com',
    },
    session: {
      access_token: 'access',
      refresh_token: 'refresh',
    },
  });

  assert.deepEqual(profile, {
    id: 'user-1',
    email: 'test@example.com',
    fullName: null,
    studentNumber: null,
    role: 'unknown',
  });
});
