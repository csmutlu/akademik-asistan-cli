import { appendFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { LOGS_DIR } from '../config.js';
import { ensureLogsDir } from '../state/storage.js';

export type MemoryEvent = {
  ts: string;
  type: 'session-start' | 'command';
  command?: string;
  ok?: boolean;
  meta?: Record<string, unknown>;
};

function dayStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function logPathFor(date = new Date()): string {
  return path.join(LOGS_DIR, `${dayStamp(date)}.jsonl`);
}

export async function appendMemoryEvent(event: MemoryEvent): Promise<void> {
  await ensureLogsDir();
  await appendFile(logPathFor(), `${JSON.stringify(event)}\n`, 'utf8');
}

export async function readRecentMemoryEvents(limitDays = 7): Promise<MemoryEvent[]> {
  await ensureLogsDir();
  const files = await readdir(LOGS_DIR).catch(() => []);
  const candidates = files
    .filter((file) => file.endsWith('.jsonl'))
    .sort()
    .slice(-limitDays);

  const events: MemoryEvent[] = [];
  for (const file of candidates) {
    const raw = await readFile(path.join(LOGS_DIR, file), 'utf8').catch(() => '');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed) as MemoryEvent);
      } catch {
        // Ignore malformed lines.
      }
    }
  }

  return events;
}
