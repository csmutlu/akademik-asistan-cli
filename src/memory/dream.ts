import { readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { DREAM_LOCK_FILE, MEMORY_FILE } from '../config.js';
import { appendMemoryEvent, readRecentMemoryEvents } from './log.js';
import { readMemoryState, writeMemoryState } from '../state/storage.js';
import type { CommandId, Profile } from '../types.js';

const DREAM_SESSION_THRESHOLD = 5;
const DREAM_INTERVAL_MS = 24 * 60 * 60 * 1000;
const STALE_LOCK_MS = 10 * 60 * 1000;

function renderCommandSummary(events: Awaited<ReturnType<typeof readRecentMemoryEvents>>): string[] {
  const commandCounts = new Map<string, number>();
  const failures: string[] = [];

  for (const event of events) {
    if (event.type !== 'command' || !event.command) continue;
    commandCounts.set(event.command, (commandCounts.get(event.command) || 0) + 1);
    if (event.ok === false) {
      failures.push(event.command);
    }
  }

  const topCommands = Array.from(commandCounts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([command, count]) => `- ${command}: ${count}`);

  return [
    '## Patternler',
    ...(topCommands.length > 0 ? topCommands : ['- Yeterli komut verisi yok']),
    '',
    '## Riskler',
    ...(failures.length > 0 ? Array.from(new Set(failures)).slice(0, 5).map((command) => `- Son hatalı komut: ${command}`) : ['- Son dönemde belirgin hata yok']),
  ];
}

function renderProfileSummary(profile: Profile | null): string[] {
  return [
    '## Son kullanıcı',
    `- Ad: ${profile?.fullName || '-'}`,
    `- E-posta: ${profile?.email || '-'}`,
    `- Rol: ${profile?.role || '-'}`,
    `- Numara: ${profile?.studentNumber || '-'}`,
  ];
}

async function acquireDreamLock(): Promise<boolean> {
  try {
    const existing = await stat(DREAM_LOCK_FILE).catch(() => null);
    if (existing) {
      const age = Date.now() - existing.mtimeMs;
      if (age < STALE_LOCK_MS) {
        return false;
      }
      await unlink(DREAM_LOCK_FILE).catch(() => undefined);
    }
    await writeFile(DREAM_LOCK_FILE, `${Date.now()}\n`, 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function releaseDreamLock(): Promise<void> {
  await unlink(DREAM_LOCK_FILE).catch(() => undefined);
}

export async function registerSessionStart(profile: Profile | null): Promise<void> {
  const state = await readMemoryState();
  await appendMemoryEvent({
    ts: new Date().toISOString(),
    type: 'session-start',
    meta: profile
      ? {
          role: profile.role,
          email: profile.email,
        }
      : undefined,
  });

  await writeMemoryState({
    ...state,
    sessionsSinceDream: state.sessionsSinceDream + 1,
  });
}

export async function registerCommandExecution(command: CommandId, ok: boolean, meta?: Record<string, unknown>): Promise<void> {
  await appendMemoryEvent({
    ts: new Date().toISOString(),
    type: 'command',
    command,
    ok,
    meta,
  });
}

export async function maybeRunDream(profile: Profile | null): Promise<boolean> {
  const state = await readMemoryState();
  const lastDreamAt = state.lastDreamAt ? new Date(state.lastDreamAt).getTime() : 0;
  const enoughSessions = state.sessionsSinceDream >= DREAM_SESSION_THRESHOLD;
  const enoughTime = Date.now() - lastDreamAt >= DREAM_INTERVAL_MS;

  if (!enoughSessions && !enoughTime) {
    return false;
  }

  const locked = await acquireDreamLock();
  if (!locked) {
    return false;
  }

  try {
    const events = await readRecentMemoryEvents(7);
    const previousMemory = await readFile(MEMORY_FILE, 'utf8').catch(() => '');
    const nextMemory = [
      '# Akademik Asistan CLI Memory',
      '',
      `Güncellendi: ${new Date().toISOString()}`,
      '',
      ...renderProfileSummary(profile),
      '',
      ...renderCommandSummary(events),
      '',
      '## Son not',
      previousMemory.trim() ? '- Önceki konsolidasyon üstüne yazıldı.' : '- İlk konsolidasyon oluştu.',
      '',
    ].join('\n');

    await writeFile(MEMORY_FILE, `${nextMemory}\n`, 'utf8');
    await writeMemoryState({
      lastDreamAt: new Date().toISOString(),
      sessionsSinceDream: 0,
    });
    return true;
  } finally {
    await releaseDreamLock();
  }
}
