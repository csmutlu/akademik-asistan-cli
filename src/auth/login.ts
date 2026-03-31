import http from 'node:http';
import { randomBytes } from 'node:crypto';
import open from 'open';
import { DEFAULT_WEB_BASE_URL, LOGIN_TIMEOUT_MS } from '../config.js';
import { writeSession } from '../state/storage.js';
import type { CliSession, CliUser, Profile, StoredSession } from '../types.js';
import { ApiClient, ApiError } from '../api/client.js';
import { ui } from '../display.js';
import { appendLoginDebugEvent, getLoginDebugLogPath } from '../logging/login-debug.js';

type LoginCallbackPayload = {
  state?: string;
  session?: CliSession;
  user?: CliUser;
};

type LoopbackCallbackResult = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  payload?: LoginCallbackPayload;
  error?: Error;
};

export type LoginOptions = {
  debug?: boolean;
  noOpen?: boolean;
  print?: (line: string) => void;
};

function buildJsonResponse(statusCode: number, payload: unknown) {
  return JSON.stringify(payload, null, 2);
}

function buildHtmlResponse(title: string, message: string, tone: 'success' | 'error') {
  const accent = tone === 'success' ? '#34d399' : '#fb7185';
  const safeTitle = title.replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const safeMessage = message.replaceAll('<', '&lt;').replaceAll('>', '&gt;');

  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at top, #10203a 0%, #091224 45%, #020617 100%);
        color: #f8fafc;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(92vw, 36rem);
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(2, 6, 23, .82);
        border-radius: 28px;
        padding: 28px;
        box-shadow: 0 24px 80px rgba(0,0,0,.42);
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: .5rem;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(255,255,255,.06);
        padding: .4rem .8rem;
        font-size: .8rem;
        color: #cbd5e1;
      }
      h1 {
        margin: 1rem 0 .75rem;
        font-size: clamp(1.8rem, 4vw, 2.6rem);
        line-height: 1.1;
      }
      p {
        margin: 0;
        color: #cbd5e1;
        line-height: 1.7;
      }
      strong {
        color: ${accent};
      }
    </style>
  </head>
  <body>
    <main>
      <div class="pill">Akademik Asistan CLI</div>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
    </main>
  </body>
</html>`;
}

function buildLoopbackHeaders(request: http.IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    'Cache-Control': 'no-store',
  };

  if (request.headers['access-control-request-private-network'] === 'true') {
    headers['Access-Control-Allow-Private-Network'] = 'true';
  }

  return headers;
}

function isFormEncodedRequest(request: Pick<http.IncomingMessage, 'headers'>) {
  const contentType = request.headers['content-type'];
  return typeof contentType === 'string' && contentType.toLowerCase().startsWith('application/x-www-form-urlencoded');
}

function shouldRespondWithHtml(request: Pick<http.IncomingMessage, 'headers'>) {
  if (isFormEncodedRequest(request)) {
    return true;
  }

  const accept = request.headers.accept;
  return typeof accept === 'string' && accept.toLowerCase().includes('text/html');
}

function parseCallbackPayload(
  request: Pick<http.IncomingMessage, 'headers'>,
  rawBody: string,
): LoginCallbackPayload {
  if (isFormEncodedRequest(request)) {
    const params = new URLSearchParams(rawBody);
    const payload = params.get('payload');
    if (!payload) {
      throw new Error('Eksik form payload');
    }
    return JSON.parse(payload) as LoginCallbackPayload;
  }

  return JSON.parse(rawBody) as LoginCallbackPayload;
}

export function buildLoopbackCallbackResult(
  request: Pick<http.IncomingMessage, 'method' | 'url' | 'headers'>,
  state: string,
  rawBody = '',
): LoopbackCallbackResult {
  const headers = buildLoopbackHeaders(request as http.IncomingMessage);
  const wantsHtml = shouldRespondWithHtml(request);

  const respondError = (statusCode: number, message: string) => {
    if (wantsHtml) {
      return {
        statusCode,
        headers: {
          ...headers,
          'Content-Type': 'text/html; charset=utf-8',
        },
        body: buildHtmlResponse('CLI bağlantısı kurulamadı', message, 'error'),
      };
    }

    return {
      statusCode,
      headers,
      body: buildJsonResponse(statusCode, { error: message }),
    };
  };

  if (!request.url) {
    return respondError(400, 'İstek URL bilgisi eksik.');
  }

  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname !== '/callback') {
    return respondError(404, 'İstenen yol bulunamadı.');
  }

  if (request.method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  if (request.method !== 'POST') {
    return respondError(405, 'Yönteme izin verilmiyor.');
  }

  try {
    const parsed = parseCallbackPayload(request, rawBody);
    if (parsed.state !== state) {
      return respondError(400, 'State doğrulaması başarısız.');
    }

    if (!parsed.session?.access_token || !parsed.session?.refresh_token || !parsed.user?.id) {
      return respondError(400, 'Eksik session payload');
    }

    const successHeaders = wantsHtml
      ? {
          ...headers,
          'Content-Type': 'text/html; charset=utf-8',
        }
      : headers;

    return {
      statusCode: 200,
      headers: successHeaders,
      body: wantsHtml
        ? buildHtmlResponse(
            'CLI oturumu bağlandı',
            'Terminale dönebilirsiniz. Şimdi <strong>aasistan whoami</strong> veya <strong>aasistan gundem</strong> çalıştırın.',
            'success',
          )
        : buildJsonResponse(200, { ok: true }),
      payload: parsed,
    };
  } catch (error) {
    return {
      ...respondError(400, 'JSON payload çözümlenemedi.'),
      error: error instanceof Error ? error : new Error('JSON payload çözümlenemedi.'),
    };
  }
}

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

export async function loginWithBrowser(api: ApiClient, options: LoginOptions = {}): Promise<Profile> {
  const state = randomBytes(24).toString('hex');
  const debug = options.debug === true;
  const noOpen = options.noOpen === true;
  const printer = options.print;

  const payload = await new Promise<LoginCallbackPayload>((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const handleRequest = async () => {
        if (request.method === 'OPTIONS') {
          const result = buildLoopbackCallbackResult(request, state);
          const address = server.address();
          await recordLoginEvent(
            'loopback-preflight',
            'Loopback preflight isteği alındı.',
            {
              port: address && typeof address !== 'string' ? address.port : null,
              allowPrivateNetwork: result.headers['Access-Control-Allow-Private-Network'] === 'true',
            },
          );
          response.writeHead(result.statusCode, result.headers);
          response.end(result.body);
          return;
        }

        const chunks: Buffer[] = [];
        request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        request.on('end', async () => {
          const address = server.address();
          const port = address && typeof address !== 'string' ? address.port : null;
          const result = buildLoopbackCallbackResult(request, state, Buffer.concat(chunks).toString('utf8'));
          await recordLoginEvent(
            'loopback-callback',
            result.payload ? 'Loopback callback alındı.' : result.error?.message || 'Loopback callback reddedildi.',
            {
              port,
              method: request.method,
              statusCode: result.statusCode,
              hasPayload: Boolean(result.payload),
              userId: result.payload?.user?.id || null,
            },
          );
          response.writeHead(result.statusCode, result.headers);
          response.end(result.body);

          if (result.payload) {
            resolve(result.payload);
            server.close();
            return;
          }

          if (result.error) {
            await recordLoginEvent('login-error', result.error.message, {
              port,
              phase: 'loopback-callback',
            });
            reject(result.error);
            server.close();
          }
        });
      };

      void handleRequest().catch(async (error) => {
        const message = error instanceof Error ? error.message : 'Loopback isteği işlenemedi.';
        await recordLoginEvent('login-error', message, {
          phase: 'loopback-request',
        });
        response.writeHead(500, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        response.end(buildJsonResponse(500, { error: message }));
        reject(error);
        server.close();
      });
    });

    const timeout = setTimeout(async () => {
      const message = 'Tarayıcı callback zaman aşımına uğradı.';
      await recordLoginEvent('login-error', message, {
        phase: 'timeout',
        timeoutMs: LOGIN_TIMEOUT_MS,
      });
      reject(new Error(message));
      server.close();
    }, LOGIN_TIMEOUT_MS);

    server.listen(0, '127.0.0.1', async () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        clearTimeout(timeout);
        const message = 'Loopback sunucusu başlatılamadı.';
        await recordLoginEvent('login-error', message, {
          phase: 'listen',
        });
        reject(new Error(message));
        server.close();
        return;
      }

      const loginUrl = new URL(`${DEFAULT_WEB_BASE_URL.replace(/\/$/, '')}/cli-auth`);
      loginUrl.searchParams.set('port', String(address.port));
      loginUrl.searchParams.set('state', state);
      if (debug) {
        loginUrl.searchParams.set('debug', '1');
      }

      await recordLoginEvent('login-start', 'CLI giriş akışı başlatıldı.', {
        port: address.port,
        debug,
        noOpen,
        logPath: getLoginDebugLogPath(),
      });
      await recordLoginEvent('login-url-generated', 'Giriş bağlantısı üretildi.', {
        port: address.port,
        loginUrl: loginUrl.toString(),
        debug,
      });

      printLine(`Giriş bağlantısı: ${loginUrl.toString()}`, printer);
      if (debug) {
        printLine(`[login] Loopback portu hazır: ${address.port}`, printer);
        printLine(`[login] Debug günlüğü: ${getLoginDebugLogPath()}`, printer);
      }

      if (noOpen) {
        await recordLoginEvent('browser-open-attempt', 'Tarayıcı otomatik açma atlandı.', {
          port: address.port,
          skipped: true,
          loginUrl: loginUrl.toString(),
        });
        if (debug) {
          printLine('[login] Tarayıcı otomatik açma atlandı (--no-open).', printer);
        }
        return;
      }

      try {
        await recordLoginEvent('browser-open-attempt', 'Tarayıcı açma denemesi gönderildi.', {
          port: address.port,
          loginUrl: loginUrl.toString(),
          skipped: false,
        });
        await open(loginUrl.toString());
        if (debug) {
          printLine('[login] Varsayılan tarayıcı açıldı.', printer);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Tarayıcı açılamadı.';
        await recordLoginEvent('browser-open-attempt', message, {
          port: address.port,
          loginUrl: loginUrl.toString(),
          skipped: false,
          ok: false,
        });
        printLine('Tarayıcı otomatik açılamadı. Yukarıdaki bağlantıyı elle açabilirsin.', printer);
      }
    });

    server.on('close', () => clearTimeout(timeout));
    server.on('error', async (error) => {
      clearTimeout(timeout);
      await recordLoginEvent('login-error', error.message, {
        phase: 'server-error',
      });
      reject(error);
    });
  });

  const stored: StoredSession = {
    session: payload.session as CliSession,
    user: payload.user as CliUser,
    updatedAt: new Date().toISOString(),
  };
  await writeSession(stored);
  await recordLoginEvent('session-stored', 'CLI oturumu yerel diske kaydedildi.', {
    userId: stored.user.id,
    email: stored.user.email || null,
  });

  try {
    const profile = await api.getProfile();
    await recordLoginEvent('profile-fetch', 'Profil doğrulandı.', {
      ok: true,
      role: profile.role,
      email: profile.email,
    });
    return profile;
  } catch (error) {
    await recordLoginEvent('profile-fetch', 'Profil doğrulama fallback ile tamamlandı.', {
      ok: false,
      fallback: true,
      error: error instanceof Error ? error.message : 'Profil alınamadı.',
    });
    if (error instanceof ApiError || error instanceof Error) {
      return {
        id: payload.user?.id || 'unknown',
        email: payload.user?.email || null,
        fullName: null,
        studentNumber: null,
        role: 'student',
      };
    }
    throw error;
  }
}
