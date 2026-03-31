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

export async function loadHomeSnapshot(api: ApiClient): Promise<HomeSnapshot> {
  const [gundem, bugun, odev, sinav, duyurular, yemekhane] = await Promise.all([
    api.getAgenda('gundem'),
    api.getAgenda('bugun'),
    api.getAgenda('odev'),
    api.getAgenda('sinav'),
    api.getAnnouncements(5),
    api.getCafeteria('today'),
  ]);

  return {
    gundem,
    bugun,
    odev,
    sinav,
    duyurular,
    yemekhane,
  };
}
