import test from 'node:test';
import assert from 'node:assert/strict';
import { buildActivityRailLines, pushActivityEntry } from './activity.js';
import type { HomePayload, Profile } from '../types.js';

function createProfile(): Profile {
  return {
    id: 'user-1',
    email: 'test@example.com',
    fullName: 'Süleyman Mutlu',
    studentNumber: '231220092',
    avatarUrl: null,
    role: 'admin',
  };
}

function createHomePayload(): HomePayload {
  return {
    now: '2026-04-01T20:00:00.000Z',
    timezone: 'Europe/Istanbul',
    syncedAt: '2026-04-01T20:05:00.000Z',
    profile: createProfile(),
    cards: {
      gundem: {
        now: '2026-04-01T20:00:00.000Z',
        timezone: 'Europe/Istanbul',
        view: 'gundem',
        title: 'Gündem',
        summary: { total: 2, classes: 1, assignments: 1, exams: 0, periods: 0, label: '2 kayıt' },
        sections: [],
        items: [
          {
            id: 'agenda-1',
            type: 'assignment',
            emoji: '!',
            title: 'Yazılım Proje',
            detail: 'Teslim',
            badge: 'yarın',
            date: '2026-04-02',
            dayKey: '2026-04-02',
          },
          {
            id: 'agenda-2',
            type: 'class',
            emoji: '*',
            title: 'Veri Yapıları',
            detail: '08:30',
            badge: 'bugün',
            date: '2026-04-01',
            dayKey: '2026-04-01',
          },
        ],
      },
      bugun: {
        now: '2026-04-01T20:00:00.000Z',
        timezone: 'Europe/Istanbul',
        view: 'bugun',
        title: 'Bugün',
        summary: { total: 1, classes: 1, assignments: 0, exams: 0, periods: 0, label: '1 kayıt' },
        sections: [],
        items: [
          {
            id: 'today-1',
            type: 'class',
            emoji: '*',
            title: 'Veri Yapıları',
            detail: '08:30',
            badge: 'bugün',
            date: '2026-04-01',
            dayKey: '2026-04-01',
          },
        ],
      },
      odev: {
        now: '2026-04-01T20:00:00.000Z',
        timezone: 'Europe/Istanbul',
        view: 'odev',
        title: 'Ödev',
        summary: { total: 1, classes: 0, assignments: 1, exams: 0, periods: 0, label: '1 ödev' },
        sections: [],
        items: [
          {
            id: 'assignment-1',
            type: 'assignment',
            emoji: '!',
            title: 'Yazılım Proje',
            detail: 'Teslim',
            badge: 'yarın',
            date: '2026-04-02',
            dayKey: '2026-04-02',
          },
        ],
      },
      sinav: {
        now: '2026-04-01T20:00:00.000Z',
        timezone: 'Europe/Istanbul',
        view: 'sinav',
        title: 'Sınav',
        summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'sakin' },
        sections: [],
        items: [],
      },
      duyurular: {
        now: '2026-04-01T20:00:00.000Z',
        count: 3,
        cached: true,
        stale: false,
        lastScraped: '2026-04-01T19:55:00.000Z',
        items: [],
      },
      yemekhane: {
        now: '2026-04-01T20:00:00.000Z',
        timezone: 'Europe/Istanbul',
        day: 'today',
        available: true,
        targetDate: '2026-04-01',
        menu: { date: '2026-04-01', items: ['Mercimek', 'Pilav'] },
        source: {
          id: 'cafeteria-1',
          title: 'Yemekhane',
          fetchedAt: '2026-04-01T19:58:00.000Z',
          sourceUrl: 'https://example.com/menu',
        },
      },
    },
    freshness: {
      hardRefresh: false,
      announcements: {
        cached: true,
        stale: false,
        lastScraped: '2026-04-01T19:55:00.000Z',
      },
      cafeteria: {
        fetchedAt: '2026-04-01T19:58:00.000Z',
        sourceUrl: 'https://example.com/menu',
      },
    },
  };
}

test('pushActivityEntry deduplicates repeated consecutive events and keeps the latest timestamp', () => {
  const first = pushActivityEntry([], 'Dashboard hazır', 'İlk yükleme', '2026-04-01T20:00:00.000Z');
  const second = pushActivityEntry(first, 'Dashboard hazır', 'İlk yükleme', '2026-04-01T20:05:00.000Z');

  assert.equal(second.length, 1);
  assert.equal(second[0]?.ts, '2026-04-01T20:05:00.000Z');
});

test('buildActivityRailLines shows live status instead of raw command spam', () => {
  const activityEntries = pushActivityEntry(
    pushActivityEntry([], 'Buddy yanıtladı', 'Bugün ödeve odaklan'),
    'Sert yenileme tamamlandı',
    undefined,
    '2026-04-01T20:06:00.000Z',
  );

  const lines = buildActivityRailLines({
    profile: createProfile(),
    hasStoredSession: true,
    home: createHomePayload(),
    error: null,
    activityEntries,
  });

  assert.equal(lines[0], 'Oturum: Süleyman Mutlu (admin)');
  assert.match(lines.join('\n'), /Dashboard:/u);
  assert.match(lines.join('\n'), /Özet: 2 gündem • 1 bugün/u);
  assert.match(lines.join('\n'), /Duyurular: 3 kayıt • cache açık • stale hayır/u);
  assert.match(lines.join('\n'), /Sorun: yok/u);
  assert.match(lines.join('\n'), /Sert yenileme tamamlandı/u);
  assert.doesNotMatch(lines.join('\n'), /komut/u);
});
