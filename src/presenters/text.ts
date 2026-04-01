import { getCommandDefinitions } from '../commands/registry.js';
import { ui } from '../display.js';
import { getCliVersion } from '../version.js';
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
  const version = getCliVersion();
  const definitions = getCommandDefinitions()
    .filter((definition) => definition.id !== 'help')
    .map((definition) => {
      const command = definition.path.join(' ');
      return `- ${command}\n  ${definition.description}${definition.example ? `\n  ${definition.example}` : ''}`;
    });

  return ui([
    `Akademik Asistan CLI v${version}`,
    '',
    'Kurulum sonrası iki kullanım biçimi var:',
    '- Doğrudan komutlar: aasistan gundem, aasistan bugun, aasistan duyurular',
    '- Hybrid TUI: aasistan',
    '- Uzun komut: akademik-asistan',
    '',
    'Başlangıç:',
    '- akademik-asistan login',
    '- akademik-asistan update',
    '- akademik-asistan login --debug',
    '- akademik-asistan login --no-open',
    '- Terminal cihaz kodu verir, web sayfası akademikasistan.com/cli-auth üstünde bu kodu kabul eder',
    '- Webde zaten giriş açıksa Ayarlar > Terminal / CLI alanına aynı kodu yapıştırıp terminali bağlayabilirsiniz',
    '- akademik-asistan whoami',
    '- akademik-asistan gundem',
    '- akademik-asistan watch',
    '- aasistan gundem',
    '',
    'Komutlar',
    ...definitions,
    '',
    'TUI kısayolları',
    '- j/k veya ok tuşları: panel değiştir',
    '- Tab: paneller arasında gez',
    '- Enter: seçili görünümü aç',
    '- /: komut paleti',
    '- ?: yardım',
    '- r: yenile',
    '- otomatik arka plan yenileme: 60 sn',
    '- h veya sol ok: ana ekrana dön',
    '- q: çıkış',
    '',
    'JSON çıktı için: akademik-asistan --json gundem',
    'Kısa komut için: aasistan',
    'ASCII fallback: AA_ASCII=1 aasistan help',
    'Yerel hafıza: ~/.config/akademik-asistan/MEMORY.md',
    'Login debug günlüğü: ~/.config/akademik-asistan/logs/cli-debug-YYYY-MM-DD.jsonl',
  ].join('\n'));
}

export function renderOnboardingText(): string {
  const version = getCliVersion();
  return ui([
    `Akademik Asistan CLI v${version}`,
    '',
    'Bu sürüm read-only çalışır ve tüm kişiler aynı paketle login olabilir.',
    'CLI login artık cihaz kodu ile çalışan web onay sayfasını kullanır.',
    'Web oturumunuz zaten açıksa Ayarlar > Terminal / CLI alanı kodu tek adımda bağlar.',
    '',
    '1. akademik-asistan login',
    '2. akademik-asistan update',
    '3. akademik-asistan login --no-open',
    '4. akademik-asistan login --debug',
    '5. akademik-asistan whoami',
    '6. akademik-asistan gundem',
    '7. akademik-asistan watch',
    '',
    'İnteraktif mod: aasistan',
    'Uzun komut: akademik-asistan',
    'Slash komutları: /gundem, /bugun, /duyurular, /yemekhane, /teacher dashboard',
    'Konsolide hafıza: ~/.config/akademik-asistan/MEMORY.md',
  ].join('\n'));
}

export function renderProfile(profile: Profile, title = 'Aktif oturum'): string {
  return ui([
    divider(title),
    `Ad       : ${profile.fullName || '-'}`,
    `E-posta  : ${profile.email || '-'}`,
    `Rol      : ${profile.role || '-'}`,
    `Numara   : ${profile.studentNumber || '-'}`,
  ].join('\n'));
}

export function renderAgenda(payload: AgendaPayload): string {
  return ui([
    divider(`${payload.title} • ${payload.summary.label}`),
    `${payload.now} (${payload.timezone})`,
    '',
    ...payload.sections.map(renderSection),
  ].join('\n\n'));
}

export function renderAnnouncements(payload: AnnouncementsPayload): string {
  const body = payload.items.length > 0
    ? payload.items.map((item) => `- ${item.title}\n  ${item.date}\n  ${item.url}`).join('\n\n')
    : 'Gösterilecek duyuru yok.';

  return ui([
    divider(`Duyurular • ${payload.count}`),
    payload.lastScraped ? `Son scrape: ${payload.lastScraped}` : 'Son scrape bilgisi yok',
    '',
    body,
  ].join('\n'));
}

export function renderCafeteria(payload: CafeteriaPayload): string {
  return ui([
    divider(`Yemekhane • ${payload.day === 'tomorrow' ? 'yarın' : 'bugün'}`),
    `Tarih: ${payload.targetDate}`,
    payload.source?.fetchedAt ? `Güncelleme: ${payload.source.fetchedAt}` : 'Güncelleme bilgisi yok',
    '',
    payload.menu
      ? payload.menu.items.map((item) => `- ${item}`).join('\n')
      : 'Seçilen gün için menü bulunamadı.',
  ].join('\n'));
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

  return ui([
    divider(payload.title),
    `Şüpheli yoklama: ${payload.counts.suspiciousRecords}`,
    `Güvenlik logu  : ${payload.counts.securityLogs}`,
    '',
    sections,
  ].join('\n'));
}

export function renderCommandResult(commandId: CommandId, result: CommandResult): string {
  if (commandId === 'help') {
    return renderHelpText();
  }

  switch (result.kind) {
    case 'profile':
      return renderProfile(result.data, commandId === 'login' ? 'Bağlandı' : 'Aktif oturum');
    case 'agenda':
      return renderAgenda(result.data);
    case 'announcements':
      return renderAnnouncements(result.data);
    case 'cafeteria':
      return renderCafeteria(result.data);
    case 'teacher-dashboard':
      return renderTeacherDashboard(result.data);
    case 'watch':
      return ui(result.data);
    case 'json':
      return JSON.stringify(result.data, null, 2);
    case 'text':
    default:
      return ui(result.data);
  }
}
