import { BUDDY_HISTORY_LIMIT } from '../config.js';
import { readBuddyHistory, writeBuddyHistory } from '../state/storage.js';
import type { BuddyMessage } from '../types.js';

export function createBuddyMessage(role: BuddyMessage['role'], content: string, timestamp = new Date().toISOString()): BuddyMessage {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content: content.trim(),
    timestamp,
  };
}

export function trimBuddyHistory(history: BuddyMessage[], limit = BUDDY_HISTORY_LIMIT): BuddyMessage[] {
  return history
    .filter((message) => message.content.trim())
    .slice(-limit);
}

export async function loadBuddyHistory(): Promise<BuddyMessage[]> {
  return trimBuddyHistory(await readBuddyHistory());
}

export async function persistBuddyHistory(history: BuddyMessage[]): Promise<void> {
  await writeBuddyHistory(trimBuddyHistory(history));
}

export function getBuddyWelcomeMessage(): BuddyMessage {
  return createBuddyMessage(
    'assistant',
    'Buddy hazir. Geciken verileri yorumlayabilir, bugunu ozetleyebilir ve odak plani onerebilirim.',
  );
}
