import { DEFAULT_API_BASE_URL, REFRESH_BUFFER_SECONDS } from '../config.js';
import { clearSession, readSession, writeSession } from '../state/storage.js';
import type {
  AgendaPayload,
  AnnouncementsPayload,
  BuddyMessage,
  BuddyReplyPayload,
  CafeteriaPayload,
  CliDeviceSession,
  CliLoginRedeemPayload,
  CliLoginRequest,
  CliSession,
  HomePayload,
  Profile,
  StoredSession,
  TeacherDashboardPayload,
} from '../types.js';

const DEVICE_SESSION_RENEW_WINDOW_MS = 45 * 24 * 60 * 60 * 1000;

export class AuthRequiredError extends Error {}

export class ApiError extends Error {
  constructor(message: string, public readonly status = 500) {
    super(message);
  }
}

type RefreshPayload = {
  session?: CliSession;
  user?: {
    id: string;
    email?: string | null;
  };
  error?: string;
};

type CliDeviceIssuePayload = {
  deviceId?: string;
  deviceToken?: string;
  expiresAt?: string;
  error?: string;
};

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  allowRetry?: boolean;
};

type SessionVerificationPayload = {
  session?: {
    access_token?: string | null;
  } | null;
  user?: {
    id?: string | null;
  } | null;
};

type JsonPayload<T> = T & {
  error?: string;
};

type RequestExecution<T> = {
  response: Response;
  payload: JsonPayload<T>;
};

export function recoverConcurrentSession(
  current: StoredSession,
  candidate: StoredSession | null,
): StoredSession | null {
  if (!candidate) {
    return null;
  }

  const currentUpdatedAt = Date.parse(current.updatedAt || '');
  const candidateUpdatedAt = Date.parse(candidate.updatedAt || '');
  const hasNewerTimestamp =
    Number.isFinite(candidateUpdatedAt) &&
    (!Number.isFinite(currentUpdatedAt) || candidateUpdatedAt > currentUpdatedAt);
  const hasDifferentRefreshToken =
    Boolean(candidate.session.refresh_token) &&
    candidate.session.refresh_token !== current.session.refresh_token;
  const hasDifferentAccessToken =
    Boolean(candidate.session.access_token) &&
    candidate.session.access_token !== current.session.access_token;
  const hasDifferentDeviceToken =
    Boolean(candidate.device?.deviceToken) &&
    candidate.device?.deviceToken !== current.device?.deviceToken;

  if (!hasNewerTimestamp && !hasDifferentRefreshToken && !hasDifferentAccessToken && !hasDifferentDeviceToken) {
    return null;
  }

  return candidate;
}

export class ApiClient {
  readonly baseUrl: string;
  private refreshPromise: Promise<StoredSession> | null = null;
  private deviceSessionPromise: Promise<StoredSession | null> | null = null;

  constructor(baseUrl = DEFAULT_API_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async hasSession(): Promise<boolean> {
    return Boolean(await readSession());
  }

  async getStoredSession(): Promise<StoredSession | null> {
    return readSession();
  }

  async clearStoredSession(): Promise<void> {
    await clearSession();
  }

  async createCliLoginRequest(): Promise<CliLoginRequest> {
    const response = await fetch(`${this.baseUrl}/auth/cli/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    const payload = (await response.json().catch(() => ({}))) as CliLoginRequest & { error?: string };
    if (!response.ok) {
      throw new ApiError(payload.error || 'CLI login istegi olusturulamadi.', response.status);
    }

    return payload;
  }

  async redeemCliLoginRequest(requestId: string, pollToken: string): Promise<CliLoginRedeemPayload> {
    const response = await fetch(`${this.baseUrl}/auth/cli/request/${encodeURIComponent(requestId)}/redeem`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pollToken }),
    });

    const payload = (await response.json().catch(() => ({}))) as CliLoginRedeemPayload;
    if (!response.ok) {
      throw new ApiError(payload.error || 'CLI login istegi sorgulanamadi.', response.status);
    }

    return payload;
  }

  async cancelCliLoginRequest(requestId: string, pollToken: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/cli/request/${encodeURIComponent(requestId)}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pollToken }),
    });

    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
      throw new ApiError(payload.error || 'CLI login istegi iptal edilemedi.', response.status);
    }
  }

  async createCliDeviceSession(): Promise<CliDeviceSession> {
    const stored = await this.getValidStoredSession();
    let response = await fetch(`${this.baseUrl}/auth/cli/device`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stored.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (response.status === 401) {
      const refreshed = await this.refreshSession(true);
      response = await fetch(`${this.baseUrl}/auth/cli/device`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${refreshed.session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
    }

    const payload = (await response.json().catch(() => ({}))) as CliDeviceIssuePayload;
    if (!response.ok || !payload.deviceToken || !payload.expiresAt) {
      throw new ApiError(payload.error || 'CLI cihaz oturumu üretilemedi.', response.status);
    }

    return {
      deviceId: payload.deviceId || '',
      deviceToken: payload.deviceToken,
      expiresAt: payload.expiresAt,
      issuedAt: new Date().toISOString(),
    };
  }

  async ensureDeviceSession(force = false): Promise<StoredSession | null> {
    const stored = await readSession();
    if (!stored) {
      return null;
    }

    if (!force && !this.shouldProvisionDeviceSession(stored.device || null)) {
      return stored;
    }

    if (this.deviceSessionPromise) {
      return this.deviceSessionPromise;
    }

    this.deviceSessionPromise = this.provisionDeviceSession(stored);
    try {
      return await this.deviceSessionPromise;
    } finally {
      this.deviceSessionPromise = null;
    }
  }

  async logout(): Promise<void> {
    const stored = await readSession();

    try {
      if (stored?.device?.deviceToken) {
        await this.revokeCliDeviceSession(stored.device.deviceToken).catch(() => undefined);
      }

      if (stored?.session.access_token) {
        await fetch(`${this.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stored.session.access_token}`,
            'Content-Type': 'application/json',
          },
        }).catch(() => undefined);
      }
    } finally {
      await clearSession();
    }
  }

  async refreshSession(force = false): Promise<StoredSession> {
    const stored = await readSession();
    if (!stored) {
      throw new AuthRequiredError('Oturum bulunamadı. `aasistan login` veya `akademik-asistan login` çalıştır.');
    }

    if (!force && !this.isExpiring(stored.session)) {
      return stored;
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.performRefresh(stored);
    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  async getProfile(): Promise<Profile> {
    return this.request<Profile>('/cli/profile');
  }

  async getHome(forceRefresh = false): Promise<HomePayload> {
    const search = forceRefresh ? '?refresh=true' : '';
    return this.request<HomePayload>(`/cli/home${search}`);
  }

  async sendBuddyMessage(message: string, history: BuddyMessage[]): Promise<BuddyReplyPayload> {
    return this.request<BuddyReplyPayload>('/cli/buddy/chat', {
      method: 'POST',
      body: {
        message,
        history: history.map(({ role, content, timestamp }) => ({
          role,
          content,
          timestamp,
        })),
      },
    });
  }

  async getAgenda(view: string): Promise<AgendaPayload> {
    return this.request<AgendaPayload>(`/cli/agenda?view=${encodeURIComponent(view)}`);
  }

  async getAnnouncements(limit = 5, forceRefresh = false): Promise<AnnouncementsPayload> {
    const refresh = forceRefresh ? '&refresh=true' : '';
    return this.request<AnnouncementsPayload>(`/cli/announcements?limit=${limit}${refresh}`);
  }

  async getCafeteria(day: 'today' | 'tomorrow' = 'today'): Promise<CafeteriaPayload> {
    return this.request<CafeteriaPayload>(`/cli/cafeteria?day=${day}`);
  }

  async getTeacherDashboard(): Promise<TeacherDashboardPayload> {
    return this.request<TeacherDashboardPayload>('/cli/teacher/dashboard?mode=summary');
  }

  private isExpiring(session: CliSession): boolean {
    if (!session.expires_at) {
      return false;
    }
    return session.expires_at <= Math.floor(Date.now() / 1000) + REFRESH_BUFFER_SECONDS;
  }

  private shouldProvisionDeviceSession(device: CliDeviceSession | null): boolean {
    if (!device?.deviceToken) {
      return true;
    }

    const expiresAt = Date.parse(device.expiresAt || '');
    if (!Number.isFinite(expiresAt)) {
      return true;
    }

    return expiresAt <= Date.now() + DEVICE_SESSION_RENEW_WINDOW_MS;
  }

  private hasDeviceSession(stored: StoredSession | null): boolean {
    return Boolean(stored?.device?.deviceToken);
  }

  private getDeviceToken(stored: StoredSession | null): string | null {
    const token = stored?.device?.deviceToken;
    return token ? token.trim() : null;
  }

  private async provisionDeviceSession(stored: StoredSession): Promise<StoredSession | null> {
    const device = await this.createCliDeviceSession();
    const latest = await readSession();

    if (!latest || latest.user.id !== stored.user.id) {
      return latest;
    }

    const next: StoredSession = {
      ...latest,
      device,
      updatedAt: new Date().toISOString(),
    };
    await writeSession(next);
    return next;
  }

  private scheduleDeviceSessionProvision(stored: StoredSession): void {
    if (!this.shouldProvisionDeviceSession(stored.device || null)) {
      return;
    }

    void this.ensureDeviceSession(false).catch(() => undefined);
  }

  private async revokeCliDeviceSession(deviceToken: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/auth/cli/device/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cli-device-token': deviceToken,
      },
      body: '{}',
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      throw new ApiError(payload.error || 'CLI cihaz oturumu silinemedi.', response.status);
    }
  }

  private async performRefresh(stored: StoredSession): Promise<StoredSession> {
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token: stored.session.refresh_token,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as RefreshPayload;
    if (!response.ok || !payload.session?.access_token || !payload.session?.refresh_token) {
      const recovered = await this.recoverSessionFromDisk(stored);
      if (recovered) {
        return recovered;
      }

      const currentTokenStillWorks = await this.isAccessTokenStillValid(stored.session.access_token);
      if (currentTokenStillWorks) {
        return stored;
      }

      if (this.hasDeviceSession(stored)) {
        throw new AuthRequiredError(payload.error || 'Oturum yenilenemedi, cihaz oturumu kullanılacak.');
      }

      await clearSession();
      throw new AuthRequiredError(payload.error || 'Oturum yenilenemedi. Tekrar giriş yap.');
    }

    const next: StoredSession = {
      session: payload.session,
      user: payload.user || stored.user,
      device: stored.device || null,
      updatedAt: new Date().toISOString(),
    };
    await writeSession(next);
    return next;
  }

  private async getValidStoredSession(): Promise<StoredSession> {
    const stored = await readSession();
    if (!stored) {
      throw new AuthRequiredError('Oturum bulunamadı. `aasistan login` veya `akademik-asistan login` çalıştır.');
    }

    if (this.isExpiring(stored.session)) {
      return this.refreshSession(true);
    }

    return stored;
  }

  private async recoverSessionFromDisk(stored: StoredSession): Promise<StoredSession | null> {
    return recoverConcurrentSession(stored, await readSession());
  }

  private async isAccessTokenStillValid(accessToken: string | undefined): Promise<boolean> {
    if (!accessToken) {
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/auth/session`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return false;
      }

      const payload = (await response.json().catch(() => ({}))) as SessionVerificationPayload;
      return Boolean(payload.user?.id && payload.session?.access_token);
    } catch {
      return false;
    }
  }

  private async executeRequest<T>(
    pathname: string,
    options: {
      method: 'GET' | 'POST';
      body?: unknown;
      headers: Record<string, string>;
    },
  ): Promise<RequestExecution<T>> {
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      method: options.method,
      headers: options.headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const payload = (await response.json().catch(() => ({}))) as JsonPayload<T>;
    return {
      response,
      payload,
    };
  }

  private async request<T>(pathname: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, allowRetry = true } = options;
    const initialStored = await readSession();

    if (!initialStored) {
      throw new AuthRequiredError('Oturum bulunamadı. `aasistan login` veya `akademik-asistan login` çalıştır.');
    }

    let lastUnauthorizedMessage = 'İstek yetkisiz.';

    const attemptAccess = async (stored: StoredSession): Promise<T | null> => {
      const { response, payload } = await this.executeRequest<T>(pathname, {
        method,
        body,
        headers: {
          Authorization: `Bearer ${stored.session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        this.scheduleDeviceSessionProvision(stored);
        return payload as T;
      }

      if (response.status !== 401) {
        throw new ApiError(payload.error || 'İstek başarısız.', response.status);
      }

      lastUnauthorizedMessage = payload.error || lastUnauthorizedMessage;
      return null;
    };

    if (!this.isExpiring(initialStored.session)) {
      const currentResult = await attemptAccess(initialStored);
      if (currentResult) {
        return currentResult;
      }
    }

    try {
      const refreshed = await this.refreshSession(true);
      const refreshedResult = await attemptAccess(refreshed);
      if (refreshedResult) {
        return refreshedResult;
      }
    } catch (error) {
      if (!(error instanceof AuthRequiredError)) {
        throw error;
      }
    }

    const latestStored = (await readSession()) || initialStored;
    const deviceToken = this.getDeviceToken(latestStored);

    if (deviceToken) {
      const { response, payload } = await this.executeRequest<T>(pathname, {
        method,
        body,
        headers: {
          'Content-Type': 'application/json',
          'X-CLI-Device-Token': deviceToken,
        },
      });

      if (response.ok) {
        return payload as T;
      }

      if (response.status !== 401) {
        throw new ApiError(payload.error || 'İstek başarısız.', response.status);
      }

      lastUnauthorizedMessage = payload.error || 'Cihaz oturumu artık geçerli değil.';
    }

    if (allowRetry) {
      const recovered = await this.recoverSessionFromDisk(initialStored);
      if (recovered) {
        return this.request<T>(pathname, {
          method,
          body,
          allowRetry: false,
        });
      }
    }

    const currentTokenStillWorks = await this.isAccessTokenStillValid(initialStored.session.access_token);
    if (currentTokenStillWorks) {
      throw new ApiError(lastUnauthorizedMessage, 401);
    }

    await clearSession();
    throw new AuthRequiredError(lastUnauthorizedMessage || 'Oturum süresi dolmuş. Tekrar giriş yap.');
  }
}
