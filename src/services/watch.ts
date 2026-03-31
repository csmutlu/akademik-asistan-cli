import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { WATCH_INTERVAL_MS } from '../config.js';
import { ApiClient } from '../api/client.js';
import type { AgendaPayload, AnnouncementsPayload } from '../types.js';

const execFileAsync = promisify(execFile);

type WatchSnapshot = {
  agendaTop: string | null;
  announcementsTop: string | null;
};

function snapshotKey(agenda: AgendaPayload, announcements: AnnouncementsPayload): WatchSnapshot {
  return {
    agendaTop: agenda.items[0] ? `${agenda.items[0].title}|${agenda.items[0].badge}` : null,
    announcementsTop: announcements.items[0]?.title || null,
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
    const [agenda, announcements] = await Promise.all([
      api.getAgenda('gundem'),
      api.getAnnouncements(3),
    ]);

    const current = snapshotKey(agenda, announcements);
    if (!previous) {
      previous = current;
      onUpdate(`Başlangıç • ${current.agendaTop || 'gündem boş'} • ${current.announcementsTop || 'duyuru yok'}`);
    } else {
      if (current.agendaTop !== previous.agendaTop && current.agendaTop) {
        onUpdate(`Gündem değişti • ${current.agendaTop}`);
        await sendDesktopNotification('Akademik Asistan', `Yeni gündem: ${current.agendaTop}`);
      }
      if (current.announcementsTop !== previous.announcementsTop && current.announcementsTop) {
        onUpdate(`Yeni duyuru • ${current.announcementsTop}`);
        await sendDesktopNotification('Akademik Asistan', `Yeni duyuru: ${current.announcementsTop}`);
      }
      previous = current;
    }

    await new Promise((resolve) => setTimeout(resolve, WATCH_INTERVAL_MS));
  }
}
