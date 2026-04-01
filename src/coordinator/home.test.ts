import test from 'node:test';
import assert from 'node:assert/strict';
import { loadHomeSnapshot } from './home.js';

test('loadHomeSnapshot uses aggregated home endpoint', async () => {
  let receivedForceRefresh = false;
  const api = {
    getHome: async (forceRefresh = false) => {
      receivedForceRefresh = forceRefresh;
      return {
        now: new Date().toISOString(),
        timezone: 'Europe/Istanbul',
        syncedAt: new Date().toISOString(),
        profile: {
          id: 'user-1',
          email: 'test@example.com',
          fullName: 'Test User',
          studentNumber: '123',
          avatarUrl: null,
          role: 'student',
        },
        cards: {
          gundem: { now: '', timezone: '', view: 'gundem', title: 'gundem', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
          bugun: { now: '', timezone: '', view: 'bugun', title: 'bugun', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
          odev: { now: '', timezone: '', view: 'odev', title: 'odev', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
          sinav: { now: '', timezone: '', view: 'sinav', title: 'sinav', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
          duyurular: { now: '', count: 0, cached: true, stale: false, lastScraped: null, items: [] },
          yemekhane: { now: '', timezone: 'Europe/Istanbul', day: 'today' as const, available: false, targetDate: '2026-04-01', menu: null, source: null },
        },
        freshness: {
          hardRefresh: false,
          announcements: { cached: true, stale: false, lastScraped: null },
          cafeteria: { fetchedAt: null, sourceUrl: null },
        },
      };
    },
  };

  const snapshot = await loadHomeSnapshot(api as never, true);

  assert.equal(receivedForceRefresh, true);
  assert.equal(snapshot.profile.fullName, 'Test User');
  assert.ok(snapshot.cards.gundem);
  assert.ok(snapshot.cards.duyurular);
});
