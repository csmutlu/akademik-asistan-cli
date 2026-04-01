import os from 'node:os';
import path from 'node:path';

export const DEFAULT_API_BASE_URL =
  process.env.AKADEMIK_ASISTAN_API_URL?.trim() ||
  'https://akademik-assistant-api.csmutlu10.workers.dev/api';

export const DEFAULT_WEB_BASE_URL =
  process.env.AKADEMIK_ASISTAN_WEB_URL?.trim() ||
  'https://akademikasistan.com';

export const CONFIG_DIR = path.join(os.homedir(), '.config', 'akademik-asistan');
export const SESSION_FILE = path.join(CONFIG_DIR, 'session.json');
export const PREFERENCES_FILE = path.join(CONFIG_DIR, 'preferences.json');
export const MEMORY_STATE_FILE = path.join(CONFIG_DIR, 'memory-state.json');
export const MEMORY_FILE = path.join(CONFIG_DIR, 'MEMORY.md');
export const BUDDY_HISTORY_FILE = path.join(CONFIG_DIR, 'buddy-history.json');
export const DREAM_LOCK_FILE = path.join(CONFIG_DIR, '.dream.lock');
export const LOGS_DIR = path.join(CONFIG_DIR, 'logs');
export const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
export const CLI_LOGIN_POLL_INTERVAL_MS = 3_000;
export const REFRESH_BUFFER_SECONDS = 60;
export const API_REQUEST_TIMEOUT_MS = Number.parseInt(process.env.AA_API_REQUEST_TIMEOUT_MS || '20000', 10);
export const API_TRANSIENT_RETRY_LIMIT = Number.parseInt(process.env.AA_API_TRANSIENT_RETRY_LIMIT || '2', 10);
export const HOME_REFRESH_INTERVAL_MS = Number.parseInt(process.env.AA_HOME_REFRESH_INTERVAL_MS || '15000', 10);
export const WATCH_INTERVAL_MS = Number.parseInt(process.env.AA_WATCH_INTERVAL_MS || '15000', 10);
export const BUDDY_HISTORY_LIMIT = 50;
