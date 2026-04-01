import test from 'node:test';
import assert from 'node:assert/strict';
import { getIdentityLabel, getTransientFailureText } from './connection.js';

test('getIdentityLabel keeps disconnected state only when no session exists', () => {
  assert.equal(getIdentityLabel(null, false), 'Bağlanmamış oturum');
  assert.equal(getIdentityLabel(null, true), 'Oturum açık • profil bekleniyor');
});

test('getIdentityLabel prefers profile metadata when available', () => {
  assert.equal(
    getIdentityLabel(
      {
        id: 'user-1',
        email: 'test@example.com',
        fullName: 'Test User',
        studentNumber: null,
        avatarUrl: null,
        role: 'student',
      },
      true,
    ),
    'Test User • student',
  );
});

test('getTransientFailureText only shows retry guidance for active sessions', () => {
  assert.equal(getTransientFailureText(false), '');
  assert.match(getTransientFailureText(true), /dashboard verisi geçici olarak alınamadı/u);
});
