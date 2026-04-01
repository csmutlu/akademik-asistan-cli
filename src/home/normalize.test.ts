import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHomePayload, normalizeTurkishUiText } from './normalize.js';

test('normalizeTurkishUiText restores common CLI UI labels', () => {
  assert.equal(
    normalizeTurkishUiText('Gundem • Yaklasan sinavlar • Bugun icin kayit gorunmuyor.'),
    'Gündem • Yaklaşan sınavlar • Bugün için kayıt görünmüyor.',
  );
});

test('normalizeHomePayload upgrades cached ASCII agenda strings', () => {
  const payload = normalizeHomePayload({
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
        summary: { total: 1, classes: 1, assignments: 0, exams: 0, periods: 0, label: '1 sinav • 1 donem' },
        sections: [
          {
            id: 'upcoming',
            title: 'Yaklasan',
            emptyText: 'Yaklasan kayit gorunmuyor.',
            items: [
              {
                id: 'exam-1',
                type: 'exam',
                emoji: 'Sinav',
                title: 'Sinav: Veri Yapilari',
                detail: 'Yarin 10:00 • Baslangic: 2 gun',
                badge: '2 gun',
                date: '2026-04-02T10:00:00.000Z',
                dayKey: '2026-04-02',
              },
            ],
          },
        ],
        items: [
          {
            id: 'exam-1',
            type: 'exam',
            emoji: 'Sinav',
            title: 'Sinav: Veri Yapilari',
            detail: 'Yarin 10:00 • Baslangic: 2 gun',
            badge: '2 gun',
            date: '2026-04-02T10:00:00.000Z',
            dayKey: '2026-04-02',
          },
        ],
      },
      bugun: { now: '', timezone: '', view: 'bugun', title: 'Bugun', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'bos' }, sections: [], items: [] },
      odev: { now: '', timezone: '', view: 'odev', title: 'Odevler', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'Yaklasan odev yok' }, sections: [], items: [] },
      sinav: { now: '', timezone: '', view: 'sinav', title: 'Sinavlar', summary: { total: 0, classes: 0, assignments: 0, exams: 0, periods: 0, label: 'Yaklasan sinav yok' }, sections: [], items: [] },
      duyurular: { now: '', count: 0, cached: true, stale: false, lastScraped: null, items: [] },
      yemekhane: { now: '', timezone: 'Europe/Istanbul', day: 'today', available: false, targetDate: '2026-04-01', menu: null, source: null },
    },
    freshness: {
      hardRefresh: false,
      announcements: { cached: true, stale: false, lastScraped: null },
      cafeteria: { fetchedAt: null, sourceUrl: null },
    },
  });

  assert.equal(payload.cards.gundem.title, 'Gündem');
  assert.equal(payload.cards.gundem.summary.label, '1 sınav • 1 dönem');
  assert.equal(payload.cards.gundem.sections[0]?.title, 'Yaklaşan');
  assert.equal(payload.cards.gundem.sections[0]?.emptyText, 'Yaklaşan kayıt görünmüyor.');
  assert.equal(payload.cards.gundem.items[0]?.emoji, 'Sınav');
  assert.equal(payload.cards.gundem.items[0]?.title, 'Sınav: Veri Yapilari');
  assert.equal(payload.cards.gundem.items[0]?.detail, 'Yarın 10:00 • Başlangıç: 2 gün');
  assert.equal(payload.cards.gundem.items[0]?.badge, '2 gün');
  assert.equal(payload.cards.bugun.title, 'Bugün');
  assert.equal(payload.cards.odev.title, 'Ödevler');
  assert.equal(payload.cards.sinav.title, 'Sınavlar');
});
