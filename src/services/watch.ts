import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WATCH_INTERVAL_MS } from '../config.js';
import { ApiClient } from '../api/client.js';
import type { HomePayload } from '../types.js';

const execFileAsync = promisify(execFile);

type WatchSnapshot = {
  agendaTopKey: string | null;
  agendaTopLabel: string | null;
  announcementsTopKey: string | null;
  announcementsTopLabel: string | null;
  syncedAt: string | null;
};

export function snapshotKey(home: HomePayload): WatchSnapshot {
  const agendaTop = home.cards.gundem.items[0] || null;
  const announcementTop = home.cards.duyurular.items[0] || null;

  return {
    agendaTopKey: agendaTop ? `${agendaTop.id}|${agendaTop.date}` : null,
    agendaTopLabel: agendaTop ? `${agendaTop.title}|${agendaTop.badge}` : null,
    announcementsTopKey: announcementTop?.id || null,
    announcementsTopLabel: announcementTop?.title || null,
    syncedAt: home.syncedAt || null,
  };
}

async function sendDesktopNotification(title: string, message: string) {
  if (process.platform !== 'darwin') {
    return;
  }

  try {
    await execFileAsync('osascript', [
      '-e',
      `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`,
    ]);
  } catch {
    // Ignore optional notification failures.
  }
}

export async function watchBrief(api: ApiClient, onUpdate: (line: string) => void): Promise<void> {
  let previous: WatchSnapshot | null = null;

  onUpdate(`KAIROS brief başladı. Aralık: ${Math.round(WATCH_INTERVAL_MS / 1000)} sn`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const home = await api.getHome(false);
    const current = snapshotKey(home);

    if (!previous) {
      previous = current;
      onUpdate(
        `Başlangıç - ${current.agendaTopLabel || 'gündem boş'} - ${current.announcementsTopLabel || 'duyuru yok'}`,
      );
    } else {
      if (current.agendaTopKey !== previous.agendaTopKey && current.agendaTopLabel) {
        onUpdate(`Gündem değişti - ${current.agendaTopLabel}`);
        await sendDesktopNotification('Akademik Asistan', `Yeni gündem: ${current.agendaTopLabel}`);
      }
      if (current.announcementsTopKey !== previous.announcementsTopKey && current.announcementsTopLabel) {
        onUpdate(`Yeni duyuru - ${current.announcementsTopLabel}`);
        await sendDesktopNotification('Akademik Asistan', `Yeni duyuru: ${current.announcementsTopLabel}`);
      }
      previous = current;
    }

    await new Promise((resolve) => setTimeout(resolve, WATCH_INTERVAL_MS));
  }
}
