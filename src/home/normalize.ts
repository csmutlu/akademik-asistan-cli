import type { AgendaPayload, HomePayload } from '../types.js';

const TURKISH_UI_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bAra Sinav\b/g, 'Ara Sınav'],
  [/\bSinav Donemi\b/g, 'Sınav Dönemi'],
  [/\bSinav donemi\b/g, 'Sınav dönemi'],
  [/\bSinav donemleri\b/g, 'Sınav dönemleri'],
  [/\bSinavlar\b/g, 'Sınavlar'],
  [/\bSinav\b/g, 'Sınav'],
  [/\bGundem\b/g, 'Gündem'],
  [/\bBugun\b/g, 'Bugün'],
  [/\bYarin\b/g, 'Yarın'],
  [/\bOdevler\b/g, 'Ödevler'],
  [/\bOdev\b/g, 'Ödev'],
  [/\bDonem\b/g, 'Dönem'],
  [/\bSimdi\b/g, 'Şimdi'],
  [/Su anda/g, 'Şu anda'],
  [/\bYaklasan\b/g, 'Yaklaşan'],
  [/\bOnumuzdeki\b/g, 'Önümüzdeki'],
  [/\bSupheli\b/g, 'Şüpheli'],
  [/\bGuvenlik\b/g, 'Güvenlik'],
  [/\bKullanici\b/g, 'Kullanıcı'],
  [/\bBaslangic\b/g, 'Başlangıç'],
  [/\bButunleme\b/g, 'Bütünleme'],
  [/\bGuz\b/g, 'Güz'],
  [/\bKayit\b/g, 'Kayıt'],
  [/\bkayit\b/g, 'kayıt'],
  [/\bodev\b/g, 'ödev'],
  [/\bsinavlar\b/g, 'sınavlar'],
  [/\bsinav\b/g, 'sınav'],
  [/\bdonemleri\b/g, 'dönemleri'],
  [/\bdonemi\b/g, 'dönemi'],
  [/\bdonem\b/g, 'dönem'],
  [/\bbugun\b/g, 'bugün'],
  [/\byarin\b/g, 'yarın'],
  [/\byaklasan\b/g, 'yaklaşan'],
  [/\bGorunmuyor\b/g, 'Görünmüyor'],
  [/\bgorunmuyor\b/g, 'görünmüyor'],
  [/\bIcin\b/g, 'İçin'],
  [/\bicin\b/g, 'için'],
  [/\bGun\b/g, 'Gün'],
  [/\bgun\b/g, 'gün'],
  [/\bkaldi\b/g, 'kaldı'],
  [/\bBaska\b/g, 'Başka'],
  [/\bbaska\b/g, 'başka'],
  [/\btamamlanmamis\b/g, 'tamamlanmamış'],
  [/\bplanlanmis\b/g, 'planlanmış'],
];

export function normalizeTurkishUiText(text: string): string {
  return TURKISH_UI_REPLACEMENTS.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text,
  );
}

function normalizeAgendaPayload(payload: AgendaPayload): AgendaPayload {
  return {
    ...payload,
    title: normalizeTurkishUiText(payload.title),
    summary: {
      ...payload.summary,
      label: normalizeTurkishUiText(payload.summary.label),
    },
    sections: payload.sections.map((section) => ({
      ...section,
      title: normalizeTurkishUiText(section.title),
      emptyText: normalizeTurkishUiText(section.emptyText),
      items: section.items.map((item) => ({
        ...item,
        emoji: normalizeTurkishUiText(item.emoji),
        title: normalizeTurkishUiText(item.title),
        detail: normalizeTurkishUiText(item.detail),
        badge: normalizeTurkishUiText(item.badge),
      })),
    })),
    items: payload.items.map((item) => ({
      ...item,
      emoji: normalizeTurkishUiText(item.emoji),
      title: normalizeTurkishUiText(item.title),
      detail: normalizeTurkishUiText(item.detail),
      badge: normalizeTurkishUiText(item.badge),
    })),
  };
}

export function normalizeHomePayload(payload: HomePayload): HomePayload {
  return {
    ...payload,
    cards: {
      ...payload.cards,
      gundem: normalizeAgendaPayload(payload.cards.gundem),
      bugun: normalizeAgendaPayload(payload.cards.bugun),
      odev: normalizeAgendaPayload(payload.cards.odev),
      sinav: normalizeAgendaPayload(payload.cards.sinav),
    },
  };
}
