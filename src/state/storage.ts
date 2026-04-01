import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { BUDDY_HISTORY_FILE, CONFIG_DIR, HOME_SNAPSHOT_FILE, LOGS_DIR, MEMORY_STATE_FILE, PREFERENCES_FILE, SESSION_FILE } from '../config.js';
import type { BuddyMessage, HomePayload, MemoryState, StoredPreferences, StoredSession } from '../types.js';

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
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try {
    await chmod(tempPath, 0o600);
  } catch {
    // Ignore on platforms that do not support chmod semantics.
  }
  await rename(tempPath, filePath);
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

export async function readBuddyHistory(): Promise<BuddyMessage[]> {
  const stored = await readJsonFile<BuddyMessage[]>(BUDDY_HISTORY_FILE);
  return Array.isArray(stored) ? stored : [];
}

export async function writeBuddyHistory(history: BuddyMessage[]): Promise<void> {
  await writeSecureJson(BUDDY_HISTORY_FILE, history);
}

export async function readHomeSnapshot(): Promise<HomePayload | null> {
  return readJsonFile<HomePayload>(HOME_SNAPSHOT_FILE);
}

export async function writeHomeSnapshot(snapshot: HomePayload): Promise<void> {
  await writeSecureJson(HOME_SNAPSHOT_FILE, snapshot);
}

export async function clearHomeSnapshot(): Promise<void> {
  await rm(HOME_SNAPSHOT_FILE, { force: true });
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
