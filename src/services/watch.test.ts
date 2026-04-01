import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotKey } from './watch.js';

test('snapshotKey tracks aggregated home changes', () => {
  const snapshot = snapshotKey({
    now: '2026-04-01T09:00:00.000Z',
    timezone: 'Europe/Istanbul',
    syncedAt: '2026-04-01T09:00:00.000Z',
    profile: {
      id: 'user-1',
      email: 'test@example.com',
      fullName: 'Test User',
      studentNumber: '123',
      avatarUrl: null,
      role: 'student',
    },
    cards: {
      gundem: {
        now: '',
        timezone: '',
        view: 'gundem',
        title: 'Gundem',
        summary: { total: 1, classes: 1, assignments: 0, exams: 0, periods: 0, label: '1 ders' },
        sections: [],
        items: [{ id: '1', type: 'class', emoji: 'Ders', title: 'Algoritmalar', detail: 'Bugun', badge: '30 dk', date: '', dayKey: '2026-04-01' }],
      },
      bugun: { now: '', timezone: '', view: 'bugun', title: 'Bugun', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
      odev: { now: '', timezone: '', view: 'odev', title: 'Odev', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
      sinav: { now: '', timezone: '', view: 'sinav', title: 'Sinav', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
      duyurular: { now: '', count: 1, cached: true, stale: false, lastScraped: null, items: [{ id: 'a1', title: 'Yeni duyuru', url: 'https://example.com', date: '2026-04-01' }] },
      yemekhane: { now: '', timezone: 'Europe/Istanbul', day: 'today', available: false, targetDate: '2026-04-01', menu: null, source: null },
    },
    freshness: {
      hardRefresh: false,
      announcements: { cached: true, stale: false, lastScraped: null },
      cafeteria: { fetchedAt: null, sourceUrl: null },
    },
  });

  assert.equal(snapshot.agendaTopKey, '1|');
  assert.equal(snapshot.agendaTopLabel, 'Algoritmalar|30 dk');
  assert.equal(snapshot.announcementsTopKey, 'a1');
  assert.equal(snapshot.announcementsTopLabel, 'Yeni duyuru');
  assert.equal(snapshot.syncedAt, '2026-04-01T09:00:00.000Z');
});

test('snapshotKey ignores countdown-only badge changes for the same agenda item', () => {
  const early = snapshotKey({
    now: '2026-04-01T09:00:00.000Z',
    timezone: 'Europe/Istanbul',
    syncedAt: '2026-04-01T09:00:00.000Z',
    profile: {
      id: 'user-1',
      email: 'test@example.com',
      fullName: 'Test User',
      studentNumber: '123',
      avatarUrl: null,
      role: 'student',
    },
    cards: {
      gundem: {
        now: '',
        timezone: '',
        view: 'gundem',
        title: 'Gundem',
        summary: { total: 1, classes: 1, assignments: 0, exams: 0, periods: 0, label: '1 ders' },
        sections: [],
        items: [{ id: 'class-1', type: 'class', emoji: 'Ders', title: 'Algoritmalar', detail: 'Bugun', badge: '30 dk', date: '2026-04-01T10:00:00.000Z', dayKey: '2026-04-01' }],
      },
      bugun: { now: '', timezone: '', view: 'bugun', title: 'Bugun', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
      odev: { now: '', timezone: '', view: 'odev', title: 'Odev', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
      sinav: { now: '', timezone: '', view: 'sinav', title: 'Sinav', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
      duyurular: { now: '', count: 1, cached: true, stale: false, lastScraped: null, items: [{ id: 'a1', title: 'Yeni duyuru', url: 'https://example.com', date: '2026-04-01' }] },
      yemekhane: { now: '', timezone: 'Europe/Istanbul', day: 'today', available: false, targetDate: '2026-04-01', menu: null, source: null },
    },
    freshness: {
      hardRefresh: false,
      announcements: { cached: true, stale: false, lastScraped: null },
      cafeteria: { fetchedAt: null, sourceUrl: null },
    },
  });
  const late = snapshotKey({
    now: '2026-04-01T09:01:00.000Z',
    timezone: 'Europe/Istanbul',
    syncedAt: '2026-04-01T09:01:00.000Z',
    profile: {
      id: 'user-1',
      email: 'test@example.com',
      fullName: 'Test User',
      studentNumber: '123',
      avatarUrl: null,
      role: 'student',
    },
    cards: {
      gundem: {
        now: '',
        timezone: '',
        view: 'gundem',
        title: 'Gundem',
        summary: { total: 1, classes: 1, assignments: 0, exams: 0, periods: 0, label: '1 ders' },
        sections: [],
        items: [{ id: 'class-1', type: 'class', emoji: 'Ders', title: 'Algoritmalar', detail: 'Bugun', badge: '29 dk', date: '2026-04-01T10:00:00.000Z', dayKey: '2026-04-01' }],
      },
      bugun: { now: '', timezone: '', view: 'bugun', title: 'Bugun', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
      odev: { now: '', timezone: '', view: 'odev', title: 'Odev', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
      sinav: { now: '', timezone: '', view: 'sinav', title: 'Sinav', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
      duyurular: { now: '', count: 1, cached: true, stale: false, lastScraped: null, items: [{ id: 'a1', title: 'Yeni duyuru', url: 'https://example.com', date: '2026-04-01' }] },
      yemekhane: { now: '', timezone: 'Europe/Istanbul', day: 'today', available: false, targetDate: '2026-04-01', menu: null, source: null },
    },
    freshness: {
      hardRefresh: false,
      announcements: { cached: true, stale: false, lastScraped: null },
      cafeteria: { fetchedAt: null, sourceUrl: null },
    },
  });

  assert.equal(early.agendaTopKey, late.agendaTopKey);
  assert.notEqual(early.agendaTopLabel, late.agendaTopLabel);
});
