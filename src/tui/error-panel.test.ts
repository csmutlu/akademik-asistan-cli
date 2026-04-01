import test from 'node:test';
import assert from 'node:assert/strict';
import { getErrorPanelLines, getErrorPanelTitle } from './error-panel.js';

test('home errors with an active session are framed as data problems', () => {
  assert.equal(getErrorPanelTitle('home'), 'Dashboard / Sorun');
  assert.deepEqual(
    getErrorPanelLines('home', true, null, '01/04 20:10'),
    [
      'Oturum duruyor; sorun login değil, dashboard verisi alınamadı.',
      'Son başarılı senkron: 01/04 20:10',
      '`r` ile yeniden dene, `aasistan whoami` ile oturumu doğrula.',
    ],
  );
});

test('non-home errors keep login diagnostics', () => {
  assert.equal(getErrorPanelTitle('auth'), 'Giriş / Sorun');
  assert.deepEqual(
    getErrorPanelLines(
      'auth',
      false,
      {
        logPath: '/tmp/test.jsonl',
        lastTimestamp: '2026-04-01T17:00:00.000Z',
        lastUrl: 'https://example.com/login',
        lastCode: 'ABCD-1234',
        lastRequestId: 'req-1',
        lastError: null,
        lastEventType: 'login-start',
      },
      null,
    ),
    [
      'Son login hatası kaydı yok.',
      'Son bağlantı: https://example.com/login',
      'Son cihaz kodu: ABCD-1234',
    ],
  );
});
