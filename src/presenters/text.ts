import { getCommandDefinitions } from '../commands/registry.js';
import type {
  AgendaPayload,
  AgendaSection,
  AnnouncementsPayload,
  CafeteriaPayload,
  CommandId,
  CommandResult,
  Profile,
  TeacherDashboardPayload,
} from '../types.js';

function divider(title?: string): string {
  if (!title) return '------------------------------------------------------------';
  return `${title}\n${'-'.repeat(Math.max(24, title.length))}`;
}

function renderSection(section: AgendaSection): string {
  if (section.items.length === 0) {
    return `${section.title}\n${section.emptyText}`;
  }

  return [
    section.title,
    ...section.items.map((item) =>
      [
        `- ${item.title}`,
        `  ${item.detail}`,
        `  ${item.badge}`,
      ].join('\n'),
    ),
  ].join('\n');
}

export function renderHelpText(): string {
  const definitions = getCommandDefinitions()
    .filter((definition) => definition.id !== 'help')
    .map((definition) => {
      const command = definition.path.join(' ');
      return `- ${command}\n  ${definition.description}${definition.example ? `\n  ${definition.example}` : ''}`;
    });

  return [
    'Akademik Asistan CLI',
    '',
    'Kurulum sonrasi iki kullanim bicimi var:',
    '- Dogrudan komutlar: aasistan gundem, aasistan bugun, aasistan duyurular',
    '- Hybrid TUI: aasistan',
    '- Uzun komut: akademik-asistan',
    '',
    'Baslangic:',
    '- akademik-asistan login',
    '- akademik-asistan whoami',
    '- akademik-asistan gundem',
    '- akademik-asistan watch',
    '- aasistan gundem',
    '',
    'Komutlar',
    ...definitions,
    '',
    'TUI kisayollari',
    '- j/k veya ok tuslari: kart degistir',
    '- Tab: kartlar arasinda gez',
    '- Enter: secili gorunumu ac',
    '- /: komut palette',
    '- ?: yardim',
    '- r: yenile',
    '- otomatik arka plan yenileme: 60 sn',
    '- h veya sol ok: ana ekrana don',
    '- q: cikis',
    '',
    'JSON cikti icin: akademik-asistan --json gundem',
    'Kisa komut icin: aasistan',
    'Yerel hafiza: ~/.config/akademik-asistan/MEMORY.md',
  ].join('\n');
}

export function renderOnboardingText(): string {
  return [
    'Akademik Asistan CLI',
    '',
    'Bu surum read-only calisir ve tum kisiler ayni paketle login olabilir.',
    '',
    '1. akademik-asistan login',
    '2. akademik-asistan whoami',
    '3. akademik-asistan gundem',
    '4. akademik-asistan watch',
    '',
    'Interaktif mod: aasistan',
    'Uzun komut: akademik-asistan',
    'Slash komutlari: /gundem, /bugun, /duyurular, /yemekhane, /teacher dashboard',
    'Konsolide hafiza: ~/.config/akademik-asistan/MEMORY.md',
  ].join('\n');
}

export function renderProfile(profile: Profile, title = 'Aktif oturum'): string {
  return [
    divider(title),
    `Ad       : ${profile.fullName || '-'}`,
    `E-posta  : ${profile.email || '-'}`,
    `Rol      : ${profile.role || '-'}`,
    `Numara   : ${profile.studentNumber || '-'}`,
  ].join('\n');
}

export function renderAgenda(payload: AgendaPayload): string {
  return [
    divider(`${payload.title} • ${payload.summary.label}`),
    `${payload.now} (${payload.timezone})`,
    '',
    ...payload.sections.map(renderSection),
  ].join('\n\n');
}

export function renderAnnouncements(payload: AnnouncementsPayload): string {
  const body = payload.items.length > 0
    ? payload.items.map((item) => `- ${item.title}\n  ${item.date}\n  ${item.url}`).join('\n\n')
    : 'Gosterilecek duyuru yok.';

  return [
    divider(`Duyurular • ${payload.count}`),
    payload.lastScraped ? `Son scrape: ${payload.lastScraped}` : 'Son scrape bilgisi yok',
    '',
    body,
  ].join('\n');
}

export function renderCafeteria(payload: CafeteriaPayload): string {
  return [
    divider(`Yemekhane • ${payload.day === 'tomorrow' ? 'yarin' : 'bugun'}`),
    `Tarih: ${payload.targetDate}`,
    payload.source?.fetchedAt ? `Guncelleme: ${payload.source.fetchedAt}` : 'Guncelleme bilgisi yok',
    '',
    payload.menu
      ? payload.menu.items.map((item) => `- ${item}`).join('\n')
      : 'Secilen gun icin menu bulunamadi.',
  ].join('\n');
}

export function renderTeacherDashboard(payload: TeacherDashboardPayload): string {
  const sections = payload.sections.map((section) => {
    if (section.items.length === 0) {
      return `${section.title}\n${section.emptyText}`;
    }
    return [
      section.title,
      ...section.items.map((item) => `- ${item.title}\n  ${item.detail}\n  ${item.badge}`),
    ].join('\n');
  }).join('\n\n');

  return [
    divider(payload.title),
    `Supheli yoklama: ${payload.counts.suspiciousRecords}`,
    `Guvenlik logu  : ${payload.counts.securityLogs}`,
    '',
    sections,
  ].join('\n');
}

export function renderCommandResult(commandId: CommandId, result: CommandResult): string {
  if (commandId === 'help') {
    return renderHelpText();
  }

  switch (result.kind) {
    case 'profile':
      return renderProfile(result.data, commandId === 'login' ? 'Baglandi' : 'Aktif oturum');
    case 'agenda':
      return renderAgenda(result.data);
    case 'announcements':
      return renderAnnouncements(result.data);
    case 'cafeteria':
      return renderCafeteria(result.data);
    case 'teacher-dashboard':
      return renderTeacherDashboard(result.data);
    case 'watch':
      return result.data;
    case 'json':
      return JSON.stringify(result.data, null, 2);
    case 'text':
    default:
      return result.data;
  }
}
