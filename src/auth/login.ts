import open from 'open';
import React from 'react';
import { render } from 'ink';
import { ApiClient, ApiError } from '../api/client.js';
import { CLI_LOGIN_POLL_INTERVAL_MS, DEFAULT_WEB_BASE_URL, LOGIN_TIMEOUT_MS } from '../config.js';
import { ui } from '../display.js';
import { appendLoginDebugEvent, getLoginDebugLogPath } from '../logging/login-debug.js';
import { writeSession } from '../state/storage.js';
import { LoginScreen, type LoginScreenState } from '../tui/LoginScreen.js';
import type { CliLoginRequest, CliLoginRedeemPayload, Profile, StoredSession } from '../types.js';

export type LoginOptions = {
  debug?: boolean;
  noOpen?: boolean;
  print?: (line: string) => void;
  renderUi?: boolean;
};

type LoginFlowHooks = {
  onStateChange?: (patch: Partial<LoginScreenState>) => void;
  isCancelled?: () => boolean;
};

function printLine(line: string, printer?: (line: string) => void) {
  const output = ui(line);
  if (printer) {
    printer(output);
    return;
  }

  process.stderr.write(`${output}\n`);
}

async function recordLoginEvent(
  type: Parameters<typeof appendLoginDebugEvent>[0]['type'],
  message?: string,
  meta?: Record<string, unknown>,
) {
  await appendLoginDebugEvent({
    ts: new Date().toISOString(),
    type,
    message,
    meta,
  }).catch(() => undefined);
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export function buildCliEntryUrl(baseUrl = DEFAULT_WEB_BASE_URL): string {
  return `${baseUrl.replace(/\/$/, '')}/cli-auth`;
}

export function buildCliPrefilledUrl(userCode: string, baseUrl = DEFAULT_WEB_BASE_URL): string {
  const url = new URL(buildCliEntryUrl(baseUrl));
  url.searchParams.set('code', userCode);
  return url.toString();
}

export function secondsUntil(expiresAt: string | null): number | null {
  if (!expiresAt) {
    return null;
  }
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function buildFallbackProfile(payload: CliLoginRedeemPayload): Profile {
  return {
    id: payload.user?.id || 'unknown',
    email: payload.user?.email || null,
    fullName: null,
    studentNumber: null,
    role: 'unknown',
  };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function openLoginUrl(loginUrl: string, printer?: (line: string) => void, debug?: boolean) {
  try {
    await open(loginUrl);
    if (debug) {
      printLine('[login] Varsayılan tarayıcı açıldı.', printer);
    }
    await recordLoginEvent('browser-open-attempt', 'Tarayıcı açıldı.', {
      loginUrl,
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tarayıcı açılamadı.';
    printLine(`Tarayıcı otomatik açılamadı. Bağlantıyı kopyalayın: ${loginUrl}`, printer);
    await recordLoginEvent('browser-open-attempt', message, {
      loginUrl,
      success: false,
    });
  }
}

async function cancelLoginRequest(api: ApiClient, request: CliLoginRequest | null) {
  if (!request) {
    return;
  }

  await api.cancelCliLoginRequest(request.requestId, request.pollToken).catch(() => undefined);
  await recordLoginEvent('request-cancelled', 'CLI login isteği iptal edildi.', {
    requestId: request.requestId,
    userCode: request.userCode,
  });
}

async function runLoginFlow(
  api: ApiClient,
  options: LoginOptions = {},
  hooks: LoginFlowHooks = {},
): Promise<Profile> {
  const debug = options.debug === true;
  const noOpen = options.noOpen === true;
  const printer = options.print;
  const logPath = getLoginDebugLogPath();

  await recordLoginEvent('login-start', 'CLI login başlatıldı.', {
    debug,
    noOpen,
    webBaseUrl: DEFAULT_WEB_BASE_URL,
  });

  hooks.onStateChange?.({
    stage: 'creating',
    statusMessage: 'Worker isteği hazırlanıyor...',
    logPath,
  });

  const request = await api.createCliLoginRequest();
  const entryUrl = request.entryUrl || buildCliEntryUrl(DEFAULT_WEB_BASE_URL);
  const loginUrl = request.verificationUrl.startsWith('http')
    ? request.verificationUrl
    : buildCliPrefilledUrl(request.userCode, DEFAULT_WEB_BASE_URL);

  await recordLoginEvent('request-created', 'CLI login isteği oluşturuldu.', {
    requestId: request.requestId,
    userCode: request.userCode,
    expiresAt: request.expiresAt,
  });
  await recordLoginEvent('login-url-generated', 'Doğrulama bağlantısı üretildi.', {
    requestId: request.requestId,
    userCode: request.userCode,
    entryUrl,
    loginUrl,
  });

  printLine(`Giriş sayfası: ${entryUrl}`, printer);
  printLine(`Cihaz kodu: ${request.userCode}`, printer);
  printLine(`Hazır bağlantı: ${loginUrl}`, printer);
  printLine(`Süre sonu: ${formatExpiry(request.expiresAt)}`, printer);

  if (debug) {
    printLine(`[login] İstek kimliği: ${request.requestId}`, printer);
    printLine(`[login] Debug günlüğü: ${logPath}`, printer);
  }

  hooks.onStateChange?.({
    stage: noOpen ? 'waiting' : 'opening',
    statusMessage: noOpen ? 'Bağlantı hazır. Tarayıcıdan açılmayı bekliyor.' : 'Tarayıcı açılıyor...',
    loginUrl,
    userCode: request.userCode,
    requestId: request.requestId,
    expiresAt: request.expiresAt,
    remainingSeconds: secondsUntil(request.expiresAt),
    logPath,
    attempts: 0,
  });

  if (!noOpen) {
    await openLoginUrl(loginUrl, printer, debug);
  }

  hooks.onStateChange?.({
    stage: 'waiting',
    statusMessage: 'Web onayı bekleniyor...',
  });

  const intervalMs = Math.max(CLI_LOGIN_POLL_INTERVAL_MS, request.intervalMs || CLI_LOGIN_POLL_INTERVAL_MS);
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  let attempts = 0;

  while (Date.now() < deadline) {
    if (hooks.isCancelled?.()) {
      await cancelLoginRequest(api, request);
      throw new Error('Giriş kullanıcı tarafından iptal edildi.');
    }

    attempts += 1;
    const result = await api.redeemCliLoginRequest(request.requestId, request.pollToken);
    await recordLoginEvent('approval-poll', `CLI login durumu: ${result.status}`, {
      requestId: request.requestId,
      userCode: request.userCode,
      attempt: attempts,
      status: result.status,
    });

    hooks.onStateChange?.({
      stage: result.status === 'approved' ? 'redeeming' : 'waiting',
      statusMessage:
        result.status === 'approved'
          ? 'Onay alındı, oturum kaydediliyor...'
          : result.status === 'pending'
            ? 'Web onayı bekleniyor...'
            : 'İstek durumu güncellendi.',
      attempts,
      remainingSeconds: secondsUntil(result.expiresAt || request.expiresAt),
      approvedAt: result.approvedAt || null,
    });

    if (result.status === 'pending') {
      await sleep(intervalMs);
      continue;
    }

    if (result.status === 'cancelled') {
      throw new Error('CLI giriş isteği web tarafında iptal edildi.');
    }

    if (result.status === 'expired') {
      throw new Error('CLI giriş isteğinin süresi doldu.');
    }

    if (result.status === 'redeemed') {
      throw new Error('Bu CLI giriş isteği daha önce kullanılmış.');
    }

    if (!result.session?.access_token || !result.session.refresh_token || !result.user?.id) {
      throw new Error(result.error || 'Onay alındı ancak session payload eksik.');
    }

    const stored: StoredSession = {
      session: result.session,
      user: result.user,
      updatedAt: new Date().toISOString(),
    };
    await writeSession(stored);
    await recordLoginEvent('session-stored', 'CLI session diske yazıldı.', {
      requestId: request.requestId,
      userId: result.user.id,
    });

    try {
      const profile = await api.getProfile();
      await recordLoginEvent('profile-fetch', 'Profil başarıyla alındı.', {
        requestId: request.requestId,
        userId: profile.id,
      });
      return profile;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Profil alınamadı.';
      await recordLoginEvent('profile-fetch', message, {
        requestId: request.requestId,
        failed: true,
      });
      return buildFallbackProfile(result);
    }
  }

  await cancelLoginRequest(api, request);
  throw new Error('CLI login isteği zaman aşımına uğradı.');
}

async function loginWithInk(api: ApiClient, options: LoginOptions): Promise<Profile> {
  const debug = options.debug === true;

  return new Promise<Profile>((resolve, reject) => {
    let finished = false;
    let cancelled = false;
    let pendingError: Error | null = null;
    let currentState: LoginScreenState = {
      stage: 'creating',
      loginUrl: null,
      userCode: null,
      requestId: null,
      expiresAt: null,
      remainingSeconds: null,
      statusMessage: 'Worker isteği hazırlanıyor...',
      error: null,
      debugEnabled: debug,
      logPath: getLoginDebugLogPath(),
      attempts: 0,
    };

    const buildScreen = (state: LoginScreenState) =>
      React.createElement(LoginScreen, {
        state,
        onOpen: () => {
          if (state.loginUrl) {
            openLoginUrl(state.loginUrl, options.print, debug).catch(() => undefined);
          }
        },
        onCancel: () => {
          cancelled = true;
          if (pendingError) {
            cleanup();
            reject(pendingError);
            return;
          }
          if (finished) {
            cleanup();
            reject(new Error('Giriş kullanıcı tarafından iptal edildi.'));
          }
        },
      });

    const ink = render(buildScreen(currentState));
    const countdown = setInterval(() => {
      if (!currentState.expiresAt) {
        return;
      }
      currentState = {
        ...currentState,
        remainingSeconds: secondsUntil(currentState.expiresAt),
      };
      ink.rerender(buildScreen(currentState));
    }, 1000);

    function cleanup() {
      clearInterval(countdown);
      ink.unmount();
    }

    function updateState(patch: Partial<LoginScreenState>) {
      currentState = {
        ...currentState,
        ...patch,
      };
      ink.rerender(buildScreen(currentState));
    }

    runLoginFlow(api, { ...options, renderUi: false }, {
      onStateChange: updateState,
      isCancelled: () => cancelled,
    })
      .then((profile) => {
        finished = true;
        updateState({
          stage: 'success',
          statusMessage: 'Oturum bağlandı. Ekran kapanıyor...',
        });
        setTimeout(() => {
          cleanup();
          resolve(profile);
        }, 600);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'CLI login tamamlanamadı.';
        pendingError = error instanceof Error ? error : new Error(message);
        finished = true;
        updateState({
          stage: cancelled ? 'cancelled' : 'error',
          statusMessage: cancelled ? 'İstek kapatıldı.' : 'Düzeltmek için bağlantıyı yeniden açabilirsiniz.',
          error: message,
        });

        if (cancelled) {
          setTimeout(() => {
            cleanup();
            reject(pendingError as Error);
          }, 300);
        }
      });
  });
}

export async function loginWithBrowser(api: ApiClient, options: LoginOptions = {}): Promise<Profile> {
  const debug = options.debug === true;

  if (debug && !options.print) {
    printLine(`[login] Debug günlüğü: ${getLoginDebugLogPath()}`, options.print);
  }

  try {
    if ((options.renderUi ?? process.stdout.isTTY) && !options.print) {
      return await loginWithInk(api, options);
    }

    return await runLoginFlow(api, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CLI login tamamlanamadı.';
    await recordLoginEvent('login-error', message, {
      loginUrlBase: DEFAULT_WEB_BASE_URL,
    });
    throw error instanceof Error ? error : new Error(message);
  }
}
