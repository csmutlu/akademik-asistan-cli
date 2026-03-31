import http from 'node:http';
import { randomBytes } from 'node:crypto';
import open from 'open';
import { DEFAULT_WEB_BASE_URL, LOGIN_TIMEOUT_MS } from '../config.js';
import { writeSession } from '../state/storage.js';
import type { CliSession, CliUser, Profile, StoredSession } from '../types.js';
import { ApiClient, ApiError } from '../api/client.js';

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

function buildJsonResponse(statusCode: number, payload: unknown) {
  return JSON.stringify(payload, null, 2);
}

function buildLoopbackHeaders(request: http.IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
  };

  if (request.headers['access-control-request-private-network'] === 'true') {
    headers['Access-Control-Allow-Private-Network'] = 'true';
  }

  return headers;
}

export function buildLoopbackCallbackResult(
  request: Pick<http.IncomingMessage, 'method' | 'url' | 'headers'>,
  state: string,
  rawBody = '',
): LoopbackCallbackResult {
  const headers = buildLoopbackHeaders(request as http.IncomingMessage);

  if (!request.url) {
    return {
      statusCode: 400,
      headers,
      body: buildJsonResponse(400, { error: 'Missing request URL' }),
    };
  }

  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname !== '/callback') {
    return {
      statusCode: 404,
      headers,
      body: buildJsonResponse(404, { error: 'Not found' }),
    };
  }

  if (request.method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  if (request.method !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: buildJsonResponse(405, { error: 'Method not allowed' }),
    };
  }

  try {
    const parsed = JSON.parse(rawBody) as LoginCallbackPayload;
    if (parsed.state !== state) {
      return {
        statusCode: 400,
        headers,
        body: buildJsonResponse(400, { error: 'State mismatch' }),
      };
    }

    if (!parsed.session?.access_token || !parsed.session?.refresh_token || !parsed.user?.id) {
      return {
        statusCode: 400,
        headers,
        body: buildJsonResponse(400, { error: 'Eksik session payload' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: buildJsonResponse(200, { ok: true }),
      payload: parsed,
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers,
      body: buildJsonResponse(400, { error: 'Invalid JSON payload' }),
      error: error instanceof Error ? error : new Error('Invalid JSON payload'),
    };
  }
}

export async function loginWithBrowser(api: ApiClient): Promise<Profile> {
  const state = randomBytes(24).toString('hex');

  const payload = await new Promise<LoginCallbackPayload>((resolve, reject) => {
    const server = http.createServer((request, response) => {
      if (request.method === 'OPTIONS') {
        const result = buildLoopbackCallbackResult(request, state);
        response.writeHead(result.statusCode, result.headers);
        response.end(result.body);
        return;
      }

      const chunks: Buffer[] = [];
      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      request.on('end', () => {
        const result = buildLoopbackCallbackResult(request, state, Buffer.concat(chunks).toString('utf8'));
        response.writeHead(result.statusCode, result.headers);
        response.end(result.body);

        if (result.payload) {
          resolve(result.payload);
          server.close();
          return;
        }

        if (result.error) {
          reject(result.error);
          server.close();
        }
      });
    });

    const timeout = setTimeout(() => {
      reject(new Error('Tarayici callback zamani asimina ugradi.'));
      server.close();
    }, LOGIN_TIMEOUT_MS);

    server.listen(0, '127.0.0.1', async () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        clearTimeout(timeout);
        reject(new Error('Loopback server baslatilamadi.'));
        server.close();
        return;
      }

      const loginUrl = `${DEFAULT_WEB_BASE_URL.replace(/\/$/, '')}/cli-auth?port=${address.port}&state=${state}`;
      try {
        await open(loginUrl);
      } catch {
        process.stdout.write(`Tarayicida ac: ${loginUrl}\n`);
      }
    });

    server.on('close', () => clearTimeout(timeout));
    server.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });

  const stored: StoredSession = {
    session: payload.session as CliSession,
    user: payload.user as CliUser,
    updatedAt: new Date().toISOString(),
  };
  await writeSession(stored);

  try {
    return await api.getProfile();
  } catch (error) {
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
