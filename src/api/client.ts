import { DEFAULT_API_BASE_URL, REFRESH_BUFFER_SECONDS } from '../config.js';
import { clearSession, readSession, writeSession } from '../state/storage.js';
import type {
  AgendaPayload,
  CafeteriaPayload,
  CliSession,
  Profile,
  StoredSession,
  TeacherDashboardPayload,
  AnnouncementsPayload,
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

export class ApiClient {
  readonly baseUrl: string;

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
      throw new AuthRequiredError('Oturum bulunamadı. `aasistan login` veya `akademik-asistan login` çalıştır.');
    }

    if (!force && !this.isExpiring(stored.session)) {
      return stored;
    }

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
      throw new AuthRequiredError(payload.error || 'Oturum yenilenemedi. Tekrar giriş yap.');
    }

    const next: StoredSession = {
      session: payload.session,
      user: payload.user || stored.user,
      updatedAt: new Date().toISOString(),
    };
    await writeSession(next);
    return next;
  }

  async getProfile(): Promise<Profile> {
    return this.request<Profile>('/cli/profile');
  }

  async getAgenda(view: string): Promise<AgendaPayload> {
    return this.request<AgendaPayload>(`/cli/agenda?view=${encodeURIComponent(view)}`);
  }

  async getAnnouncements(limit = 5): Promise<AnnouncementsPayload> {
    return this.request<AnnouncementsPayload>(`/cli/announcements?limit=${limit}`);
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

  private async request<T>(pathname: string, allowRetry = true): Promise<T> {
    const stored = await this.getValidStoredSession();
    const response = await fetch(`${this.baseUrl}${pathname}`, {
      headers: {
        Authorization: `Bearer ${stored.session.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (response.ok) {
      return payload as T;
    }

    if (response.status === 401 && allowRetry) {
      await this.refreshSession(true);
      return this.request<T>(pathname, false);
    }

    if (response.status === 401) {
      await clearSession();
      throw new AuthRequiredError((payload as { error?: string }).error || 'Oturum süresi dolmuş. Tekrar giriş yap.');
    }

    throw new ApiError((payload as { error?: string }).error || 'İstek başarısız.', response.status);
  }
}
