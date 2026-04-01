import test from 'node:test';
import assert from 'node:assert/strict';
import { loadHomeSnapshot } from './home.js';

test('loadHomeSnapshot keeps partial data when one panel fails', async () => {
  const api = {
    getAgenda: async (view: string) => {
      if (view === 'odev') {
        throw new Error('İstek başarısız.');
      }

      return {
        now: new Date().toISOString(),
        timezone: 'Europe/Istanbul',
        view,
        title: view,
        summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'boş' },
        sections: [],
        items: [],
      };
    },
    getAnnouncements: async () => ({
      now: new Date().toISOString(),
      count: 0,
      cached: true,
      stale: false,
      lastScraped: null,
      items: [],
    }),
    getCafeteria: async () => ({
      now: new Date().toISOString(),
      timezone: 'Europe/Istanbul',
      day: 'today' as const,
      available: false,
      targetDate: '2026-04-01',
      menu: null,
      source: null,
    }),
  };

  const snapshot = await loadHomeSnapshot(api as never);
  assert.equal(snapshot.errors.length, 1);
  assert.match(snapshot.errors[0] || '', /Ödevler/);
  assert.ok(snapshot.data.gundem);
  assert.ok(snapshot.data.bugun);
  assert.ok(snapshot.data.sinav);
  assert.ok(snapshot.data.duyurular);
  assert.ok(snapshot.data.yemekhane);
  assert.equal(snapshot.data.odev, undefined);
});

