import { appendFile, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { LOGS_DIR } from '../config.js';
import { ensureLogsDir } from '../state/storage.js';

export type LoginDebugEventType =
  | 'login-start'
  | 'login-url-generated'
  | 'browser-open-attempt'
  | 'loopback-preflight'
  | 'loopback-callback'
  | 'session-stored'
  | 'profile-fetch'
  | 'login-error';

export type LoginDebugEvent = {
  ts: string;
  type: LoginDebugEventType;
  message?: string;
  meta?: Record<string, unknown>;
};

export type LoginDebugSummary = {
  logPath: string;
  lastTimestamp: string | null;
  lastUrl: string | null;
  lastPort: string | null;
  lastError: string | null;
  lastEventType: LoginDebugEventType | null;
};

function dayStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function getLoginDebugLogPath(date = new Date()): string {
  return path.join(LOGS_DIR, `cli-debug-${dayStamp(date)}.jsonl`);
}

export async function appendLoginDebugEvent(event: LoginDebugEvent): Promise<void> {
  await ensureLogsDir();
  await appendFile(getLoginDebugLogPath(), `${JSON.stringify(event)}\n`, 'utf8');
}

export async function readLatestLoginDebugSummary(limitDays = 7): Promise<LoginDebugSummary | null> {
  await ensureLogsDir();
  const files = (await readdir(LOGS_DIR).catch(() => []))
    .filter((file) => file.startsWith('cli-debug-') && file.endsWith('.jsonl'))
    .sort()
    .slice(-limitDays);

  let summary: LoginDebugSummary | null = null;

  for (const file of files) {
    const absolutePath = path.join(LOGS_DIR, file);
    const raw = await readFile(absolutePath, 'utf8').catch(() => '');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      let event: LoginDebugEvent;
      try {
        event = JSON.parse(trimmed) as LoginDebugEvent;
      } catch {
        continue;
      }

      if (!summary) {
        summary = {
          logPath: absolutePath,
          lastTimestamp: null,
          lastUrl: null,
          lastPort: null,
          lastError: null,
          lastEventType: null,
        };
      }

      summary.logPath = absolutePath;
      summary.lastTimestamp = event.ts;
      summary.lastEventType = event.type;

      const url = typeof event.meta?.loginUrl === 'string' ? event.meta.loginUrl : null;
      const port = event.meta?.port;
      if (url) {
        summary.lastUrl = url;
      }
      if (typeof port === 'string' || typeof port === 'number') {
        summary.lastPort = String(port);
      }
      if (event.type === 'login-error' && event.message) {
        summary.lastError = event.message;
      }
    }
  }

  return summary;
}
