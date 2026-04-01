import { DEFAULT_API_BASE_URL, REFRESH_BUFFER_SECONDS } from '../config.js';
import { clearSession, readSession, writeSession } from '../state/storage.js';
import type {
  AgendaPayload,
  AnnouncementsPayload,
  BuddyMessage,
  BuddyReplyPayload,
  CafeteriaPayload,
  CliLoginRedeemPayload,
  CliLoginRequest,
  CliSession,
  HomePayload,
  Profile,
  StoredSession,
  TeacherDashboardPayload,
} from '../types.js';

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

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: unknown;
  allowRetry?: boolean;
};

export class ApiClient {
  readonly baseUrl: string;
  private refreshPromise: Promise<StoredSession> | null = null;

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

  async logout(): Promise<void> {
    const stored = await readSession();
    try {
      if (stored?.session.access_token) {
        await fetch(`${this.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${stored.session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } finally {
      await clearSession();
    }
  }

  async refreshSession(force = false): Promise<StoredSession> {
    const stored = await readSession();
    if (!stored) {
      throw new AuthRequiredError('Oturum bulunamadi. `aasistan login` veya `akademik-asistan login` calistir.');
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
    if (!session.expires_at) return false;
    return session.expires_at <= Math.floor(Date.now() / 1000) + REFRESH_BUFFER_SECONDS;
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
      await clearSession();
      throw new AuthRequiredError(payload.error || 'Oturum yenilenemedi. Tekrar giris yap.');
    }

    const next: StoredSession = {
      session: payload.session,
      user: payload.user || stored.user,
      updatedAt: new Date().toISOString(),
    };
    await writeSession(next);
    return next;
  }

  private async getValidStoredSession(): Promise<StoredSession> {
    const stored = await readSession();
    if (!stored) {
      throw new AuthRequiredError('Oturum bulunamadi. `aasistan login` veya `akademik-asistan login` calistir.');
    }

    if (this.isExpiring(stored.session)) {
      return this.refreshSession(true);
    }

    return stored;
  }

  private async request<T>(pathname: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, allowRetry = true } = options;
    const stored = await this.getValidStoredSession();
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${stored.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (response.ok) {
      return payload as T;
    }

    if (response.status === 401 && allowRetry) {
      await this.refreshSession(true);
      return this.request<T>(pathname, {
        method,
        body,
        allowRetry: false,
      });
    }

    if (response.status === 401) {
      await clearSession();
      throw new AuthRequiredError((payload as { error?: string }).error || 'Oturum suresi dolmus. Tekrar giris yap.');
    }

    throw new ApiError((payload as { error?: string }).error || 'Istek basarisiz.', response.status);
  }
}
