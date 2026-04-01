import type { HomePayload, Profile } from '../types.js';

export type ActivityEntry = {
  ts: string;
  label: string;
  detail?: string;
};

type BuildActivityRailLinesInput = {
  profile: Profile | null;
  hasStoredSession: boolean;
  home: HomePayload | null;
  error: string | null;
  activityEntries: ActivityEntry[];
};

const DEFAULT_ACTIVITY_LIMIT = 4;
const DISPLAYED_ACTIVITY_LIMIT = 3;
const MAX_ERROR_LENGTH = 72;

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function pushActivityEntry(
  entries: ActivityEntry[],
  label: string,
  detail?: string,
  ts = new Date().toISOString(),
  limit = DEFAULT_ACTIVITY_LIMIT,
): ActivityEntry[] {
  const nextEntry: ActivityEntry = {
    ts,
    label,
    detail: detail?.trim() || undefined,
  };

  const lastEntry = entries.at(-1);
  if (lastEntry && lastEntry.label === nextEntry.label && lastEntry.detail === nextEntry.detail) {
    return [...entries.slice(0, -1), nextEntry];
  }

  return [...entries, nextEntry].slice(-limit);
}

export function buildActivityRailLines({
  profile,
  hasStoredSession,
  home,
  error,
  activityEntries,
}: BuildActivityRailLinesInput): string[] {
  const lines: string[] = [];

  if (profile) {
    lines.push(`Oturum: ${profile.fullName || profile.email || 'bağlı'} (${profile.role})`);
  } else if (hasStoredSession) {
    lines.push('Oturum: kayıt var, dashboard yeniden deneniyor');
  } else {
    lines.push('Oturum: giriş bekleniyor');
  }

  if (home) {
    lines.push(`Dashboard: ${formatDateTime(home.syncedAt)} senkron`);
    lines.push(`Özet: ${home.cards.gundem.items.length} gündem • ${home.cards.bugun.items.length} bugün`);
    lines.push(
      `Duyurular: ${home.cards.duyurular.count} kayıt • cache ${home.freshness.announcements.cached ? 'açık' : 'kapalı'} • stale ${home.freshness.announcements.stale ? 'evet' : 'hayır'}`,
    );
  } else {
    lines.push(`Dashboard: ${hasStoredSession ? 'yükleniyor' : 'henüz bağlı değil'}`);
  }

  lines.push(`Sorun: ${error ? truncate(error, MAX_ERROR_LENGTH) : 'yok'}`);

  if (activityEntries.length === 0) {
    lines.push('Son hareket: bu oturumda henüz önemli olay yok');
    lines.push('Kısayol: b buddy • r yenile • / komut');
    return lines;
  }

  for (const entry of activityEntries.slice(-DISPLAYED_ACTIVITY_LIMIT).reverse()) {
    const detail = entry.detail ? ` • ${truncate(entry.detail, 48)}` : '';
    lines.push(`${formatClock(entry.ts)} • ${entry.label}${detail}`);
  }

  return lines;
}
