import { ApiError } from '../api/client.js';

export type HomeRefreshReason = 'initial' | 'auto' | 'manual' | 'login';

export function isBackgroundRefresh(reason: HomeRefreshReason, hasHome: boolean): boolean {
  return reason === 'auto' && hasHome;
}

export function isTransientHomeError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 0 || error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /zaman aşımına uğradı|geçici|Ağ isteği tamamlanamadı|fetch failed/ui.test(error.message);
}

export function shouldKeepLastSnapshotOnError(
  hasHome: boolean,
  hasStoredSession: boolean,
  error: unknown,
): boolean {
  return hasHome && hasStoredSession && isTransientHomeError(error);
}
