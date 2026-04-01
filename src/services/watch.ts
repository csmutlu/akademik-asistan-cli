import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WATCH_INTERVAL_MS } from '../config.js';
import { ApiClient } from '../api/client.js';
import type { HomePayload } from '../types.js';

const execFileAsync = promisify(execFile);

type WatchSnapshot = {
  agendaTop: string | null;
  announcementsTop: string | null;
  syncedAt: string | null;
};

export function snapshotKey(home: HomePayload): WatchSnapshot {
  return {
    agendaTop: home.cards.gundem.items[0] ? `${home.cards.gundem.items[0].title}|${home.cards.gundem.items[0].badge}` : null,
    announcementsTop: home.cards.duyurular.items[0]?.title || null,
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

  onUpdate(`KAIROS brief basladi. Aralik: ${Math.round(WATCH_INTERVAL_MS / 1000)} sn`);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const home = await api.getHome(false);
    const current = snapshotKey(home);

    if (!previous) {
      previous = current;
      onUpdate(
        `Baslangic - ${current.agendaTop || 'gundem bos'} - ${current.announcementsTop || 'duyuru yok'}`,
      );
    } else {
      if (current.agendaTop !== previous.agendaTop && current.agendaTop) {
        onUpdate(`Gundem degisti - ${current.agendaTop}`);
        await sendDesktopNotification('Akademik Asistan', `Yeni gundem: ${current.agendaTop}`);
      }
      if (current.announcementsTop !== previous.announcementsTop && current.announcementsTop) {
        onUpdate(`Yeni duyuru - ${current.announcementsTop}`);
        await sendDesktopNotification('Akademik Asistan', `Yeni duyuru: ${current.announcementsTop}`);
      }
      previous = current;
    }

    await new Promise((resolve) => setTimeout(resolve, WATCH_INTERVAL_MS));
  }
}
