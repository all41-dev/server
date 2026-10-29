import { expect } from 'chai';
import express from 'express';
import { AddressInfo } from 'net';
import { Server as HttpServer } from 'http';
import { corsMiddleware, corsOptions, validateCorsOrigins, ICorsOptions } from '../src/cors';
import 'mocha';

const LISTED = 'http://localhost:3000';

describe('CORS allow-list', () => {
  let http: HttpServer;
  let base: string;

  const serve = (options?: ICorsOptions) => {
    const app = express();
    app.use(corsMiddleware(options));
    app.get('/x', (req, res) => { res.json({ ok: true }); });
    http = app.listen(0);
    base = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  };

  const preflight = (origin: string, headers = 'content-type') => fetch(`${base}/x`, {
    method: 'OPTIONS',
    headers: { Origin: origin, 'Access-Control-Request-Method': 'PATCH', 'Access-Control-Request-Headers': headers },
  });

  afterEach((done) => { http.close(() => done()); });

  it('echoes a listed origin with credentials and Vary: Origin', async () => {
    serve({ origins: [LISTED] });
    const res = await fetch(`${base}/x`, { headers: { Origin: LISTED } });
    expect(res.headers.get('access-control-allow-origin')).to.equal(LISTED);
    expect(res.headers.get('access-control-allow-credentials')).to.equal('true');
    expect(res.headers.get('vary')).to.include('Origin');
  });

  it('gives an unlisted origin no CORS header, and still answers', async () => {
    serve({ origins: [LISTED] });
    const res = await fetch(`${base}/x`, { headers: { Origin: 'https://other.example.com' } });
    expect(res.status).to.equal(200);
    expect(res.headers.get('access-control-allow-origin')).to.be.null;
  });

  it('gives no CORS header to anyone by default', async () => {
    serve();
    const res = await fetch(`${base}/x`, { headers: { Origin: LISTED } });
    expect(res.headers.get('access-control-allow-origin')).to.be.null;
  });

  it('answers a request without Origin', async () => {
    serve({ origins: [LISTED] });
    const res = await fetch(`${base}/x`);
    expect(res.status).to.equal(200);
    expect(res.headers.get('access-control-allow-origin')).to.be.null;
  });

  it('answers a preflight with 204 and a ten-minute Max-Age', async () => {
    serve({ origins: [LISTED] });
    const res = await preflight(LISTED);
    expect(res.status).to.equal(204);
    expect(res.headers.get('access-control-max-age')).to.equal('600');
    expect(res.headers.get('access-control-allow-methods')).to.equal('GET,POST,PUT,PATCH,DELETE');
  });

  it('allows only Content-Type and Authorization without allowedHeaders', async () => {
    serve({ origins: [LISTED] });
    const res = await preflight(LISTED);
    expect(res.headers.get('access-control-allow-headers')).to.equal('Content-Type,Authorization');
  });

  it('adds the app headers given in allowedHeaders', async () => {
    serve({ origins: [LISTED], allowedHeaders: ['x-request-id'] });
    const res = await preflight(LISTED, 'content-type,x-request-id');
    expect(res.headers.get('access-control-allow-headers')).to.equal('Content-Type,Authorization,x-request-id');
  });

  it('refuses an entry that is not a bare origin', () => {
    for (const bad of ['http://app.example.com/', 'app.example.com', 'http://app.example.com/app', '*', 'ftp://app.example.com']) {
      expect(() => validateCorsOrigins([bad]), bad).to.throw('Invalid CORS origin');
    }
    expect(() => corsOptions({ origins: ['http://app.example.com/'] })).to.throw('Invalid CORS origin');
  });

  it('accepts origins with and without a port', () => {
    expect(validateCorsOrigins(['https://app.example.com', LISTED])).to.deep.equal(['https://app.example.com', LISTED]);
  });
});
