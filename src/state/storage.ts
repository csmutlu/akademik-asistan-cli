import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { CONFIG_DIR, LOGS_DIR, MEMORY_STATE_FILE, PREFERENCES_FILE, SESSION_FILE } from '../config.js';
import type { MemoryState, StoredPreferences, StoredSession } from '../types.js';

const DEFAULT_PREFERENCES: StoredPreferences = {
  onboardingSeen: false,
  lastView: null,
};

const DEFAULT_MEMORY_STATE: MemoryState = {
  lastDreamAt: null,
  sessionsSinceDream: 0,
};

async function ensureConfigDir() {
  await mkdir(CONFIG_DIR, { recursive: true });
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeSecureJson(filePath: string, value: unknown) {
  await ensureConfigDir();
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try {
    await chmod(filePath, 0o600);
  } catch {
    // Ignore on platforms that do not support chmod semantics.
  }
}

export async function readSession(): Promise<StoredSession | null> {
  return readJsonFile<StoredSession>(SESSION_FILE);
}

export async function writeSession(session: StoredSession): Promise<void> {
  await writeSecureJson(SESSION_FILE, session);
}

export async function clearSession(): Promise<void> {
  await rm(SESSION_FILE, { force: true });
}

export async function readPreferences(): Promise<StoredPreferences> {
  const stored = await readJsonFile<StoredPreferences>(PREFERENCES_FILE);
  if (!stored) {
    return { ...DEFAULT_PREFERENCES };
  }

  return {
    ...DEFAULT_PREFERENCES,
    ...stored,
  };
}

export async function writePreferences(preferences: StoredPreferences): Promise<void> {
  await writeSecureJson(PREFERENCES_FILE, preferences);
}

export async function readMemoryState(): Promise<MemoryState> {
  const stored = await readJsonFile<MemoryState>(MEMORY_STATE_FILE);
  if (!stored) {
    return { ...DEFAULT_MEMORY_STATE };
  }

  return {
    ...DEFAULT_MEMORY_STATE,
    ...stored,
  };
}

export async function writeMemoryState(state: MemoryState): Promise<void> {
  await writeSecureJson(MEMORY_STATE_FILE, state);
}

export async function ensureLogsDir(): Promise<void> {
  await mkdir(LOGS_DIR, { recursive: true });
}
