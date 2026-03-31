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

function buildJsonResponse(statusCode: number, payload: unknown) {
  return JSON.stringify(payload, null, 2);
}

export async function loginWithBrowser(api: ApiClient): Promise<Profile> {
  const state = randomBytes(24).toString('hex');

  const payload = await new Promise<LoginCallbackPayload>((resolve, reject) => {
    const server = http.createServer((request, response) => {
      if (!request.url) {
        response.statusCode = 400;
        response.end(buildJsonResponse(400, { error: 'Missing request URL' }));
        return;
      }

      const url = new URL(request.url, 'http://127.0.0.1');
      if (request.method !== 'POST' || url.pathname !== '/callback') {
        response.statusCode = 404;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(buildJsonResponse(404, { error: 'Not found' }));
        return;
      }

      const chunks: Buffer[] = [];
      request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      request.on('end', () => {
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as LoginCallbackPayload;
          if (parsed.state !== state) {
            response.statusCode = 400;
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(buildJsonResponse(400, { error: 'State mismatch' }));
            return;
          }
          if (!parsed.session?.access_token || !parsed.session?.refresh_token || !parsed.user?.id) {
            response.statusCode = 400;
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(buildJsonResponse(400, { error: 'Eksik session payload' }));
            return;
          }

          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(buildJsonResponse(200, { ok: true }));
          resolve(parsed);
          server.close();
        } catch (error) {
          response.statusCode = 400;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.end(buildJsonResponse(400, { error: 'Invalid JSON payload' }));
          reject(error);
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
