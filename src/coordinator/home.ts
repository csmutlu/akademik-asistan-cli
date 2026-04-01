import { ApiClient } from '../api/client.js';
import type { AgendaPayload, AnnouncementsPayload, CafeteriaPayload } from '../types.js';

export type HomeSnapshot = {
  gundem: AgendaPayload;
  bugun: AgendaPayload;
  odev: AgendaPayload;
  sinav: AgendaPayload;
  duyurular: AnnouncementsPayload;
  yemekhane: CafeteriaPayload;
};

export type HomeSnapshotLoad = {
  data: Partial<HomeSnapshot>;
  errors: string[];
};

type SnapshotEntry<T> = {
  key: keyof HomeSnapshot;
  label: string;
  loader: () => Promise<T>;
};

function formatSnapshotError(label: string, error: unknown): string {
  const message = error instanceof Error ? error.message : 'İstek başarısız.';
  return `${label}: ${message}`;
}

export async function loadHomeSnapshot(api: ApiClient): Promise<HomeSnapshotLoad> {
  const entries: SnapshotEntry<HomeSnapshot[keyof HomeSnapshot]>[] = [
    { key: 'gundem', label: 'Gündem', loader: () => api.getAgenda('gundem') },
    { key: 'bugun', label: 'Bugün', loader: () => api.getAgenda('bugun') },
    { key: 'odev', label: 'Ödevler', loader: () => api.getAgenda('odev') },
    { key: 'sinav', label: 'Sınavlar', loader: () => api.getAgenda('sinav') },
    { key: 'duyurular', label: 'Duyurular', loader: () => api.getAnnouncements(5) },
    { key: 'yemekhane', label: 'Yemekhane', loader: () => api.getCafeteria('today') },
  ];

  const settled = await Promise.allSettled(entries.map((entry) => entry.loader()));
  const data: Partial<HomeSnapshot> = {};
  const errors: string[] = [];

  settled.forEach((result, index) => {
    const entry = entries[index];
    if (result.status === 'fulfilled') {
      data[entry.key] = result.value as never;
      return;
    }

    errors.push(formatSnapshotError(entry.label, result.reason));
  });

  return { data, errors };
}
