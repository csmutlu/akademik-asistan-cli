import { ApiClient } from '../api/client.js';
import type { HomePayload } from '../types.js';

export async function loadHomeSnapshot(api: ApiClient, forceRefresh = false): Promise<HomePayload> {
  return api.getHome(forceRefresh);
}
