export type HomeRefreshReason = 'initial' | 'auto' | 'manual' | 'login';

export function isBackgroundRefresh(reason: HomeRefreshReason, hasHome: boolean): boolean {
  return reason === 'auto' && hasHome;
}

export function shouldKeepLastSnapshotOnError(
  reason: HomeRefreshReason,
  hasHome: boolean,
  hasStoredSession: boolean,
): boolean {
  return reason === 'auto' && hasHome && hasStoredSession;
}
