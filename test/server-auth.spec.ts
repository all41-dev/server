import { expect } from 'chai';
import crypto from 'crypto';
import { AddressInfo } from 'net';
import { Router } from 'express';
import { Server } from '../src/server';
import 'mocha';

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

const LISTED = 'http://localhost:3000';

describe('Server auth and CORS wiring', () => {
  let server: Server;
  let base: string;
  let refreshCalls: number;

  before(async () => {
    server = new Server({
      mute: true,
      httpPort: 0,
      skipJobScheduleAtStartup: true,
      loggerOptions: { silent: true },
      cors: { origins: [LISTED] },
      auth: { publicKey, privateKey, strategies: {} },
    });
    const router = Router();
    router.get('/x', (req, res) => { res.json({ user: (req as any).user ?? null }); });
    (server as any)._routes.push({ path: '/api', requireAuth: true, router });

    const auth = (server as any)._auth;
    refreshCalls = 0;
    auth.refreshToken = async () => {
      refreshCalls++;
      return undefined;
    };

    await server.start();
    base = `http://127.0.0.1:${(server.http.address() as AddressInfo).port}`;
  });

  after(async () => {
    await server.stop(false);
  });

  beforeEach(() => {
    refreshCalls = 0;
  });

  it('answers an /auth preflight from the allow-list, before the auth router', async () => {
    const res = await fetch(`${base}/auth/profile`, {
      method: 'OPTIONS',
      headers: { Origin: LISTED, 'Access-Control-Request-Method': 'GET' },
    });
    expect(res.status).to.equal(204);
    expect(res.headers.get('access-control-allow-origin')).to.equal(LISTED);
  });

  it('applies the allow-list to the API routes', async () => {
    const listed = await fetch(`${base}/api/x`, { headers: { Origin: LISTED } });
    expect(listed.headers.get('access-control-allow-origin')).to.equal(LISTED);
    const other = await fetch(`${base}/api/x`, { headers: { Origin: 'https://other.example.com' } });
    expect(other.headers.get('access-control-allow-origin')).to.be.null;
  });

  it('refuses a protected route without cookies with NO_SESSION', async () => {
    const res = await fetch(`${base}/api/x`);
    expect(res.status).to.equal(401);
    expect(await res.json()).to.deep.equal({ code: 'NO_SESSION' });
    expect(refreshCalls).to.equal(0);
  });

  it('refreshes once per request when only the refresh cookie is sent', async () => {
    const res = await fetch(`${base}/api/x`, { headers: { Cookie: 'refresh=some-refresh-token' } });
    expect(res.status).to.equal(401);
    expect(await res.json()).to.deep.equal({ code: 'TOKEN_EXPIRED' });
    expect(refreshCalls).to.equal(1);
  });

  it('serves /auth/profile through iam, refusing without a session', async () => {
    const res = await fetch(`${base}/auth/profile`);
    expect(res.status).to.equal(401);
    expect(await res.json()).to.deep.equal({ code: 'NO_SESSION' });
  });
});
