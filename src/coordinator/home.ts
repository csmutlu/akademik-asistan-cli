import { ApiClient } from '../api/client.js';
import { normalizeHomePayload } from '../home/normalize.js';
import { readHomeSnapshot, writeHomeSnapshot } from '../state/storage.js';
import type { HomePayload } from '../types.js';

export type HomeSnapshotCache = {
  read: () => Promise<HomePayload | null>;
  write: (snapshot: HomePayload) => Promise<void>;
};

const defaultCache: HomeSnapshotCache = {
  read: readHomeSnapshot,
  write: writeHomeSnapshot,
};

export async function readCachedHomeSnapshot(cache: HomeSnapshotCache = defaultCache): Promise<HomePayload | null> {
  const snapshot = await cache.read();
  return snapshot ? normalizeHomePayload(snapshot) : null;
}

export async function loadHomeSnapshot(
  api: ApiClient,
  forceRefresh = false,
  cache: HomeSnapshotCache = defaultCache,
): Promise<HomePayload> {
  const snapshot = await api.getHome(forceRefresh);
  await cache.write(snapshot).catch(() => undefined);
  return normalizeHomePayload(snapshot);
}
