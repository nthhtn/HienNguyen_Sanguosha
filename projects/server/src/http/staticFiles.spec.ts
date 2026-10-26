import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../config';
import { createServer, RunningServer } from '../server';

describe('static files and /healthz', () => {
  let dir: string;
  let server: RunningServer | null = null;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sgs-static-'));
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>app</title>');
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'app.js'), 'console.log(1)');
    writeFileSync(join(dir, 'chunk-B2THbeNN.js'), 'export {}');
  });

  afterEach(async () => {
    await server?.close();
    server = null;
    rmSync(dir, { recursive: true, force: true });
  });

  async function start(staticDir: string | null = dir): Promise<RunningServer> {
    server = await createServer(loadConfig({ STATIC_DIR: staticDir ?? '' }), { logger: false });
    return server;
  }

  it('serves index.html at /', async () => {
    const res = await (await start()).app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.headers['cache-control']).toBe('no-cache');
    expect(res.body).toContain('<title>app</title>');
  });

  it('serves a file under /assets/app.js', async () => {
    const res = await (await start()).app.inject({ method: 'GET', url: '/assets/app.js' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
    expect(res.body).toBe('console.log(1)');
  });

  it('caches a hashed build file for a year', async () => {
    const res = await (await start()).app.inject({ method: 'GET', url: '/chunk-B2THbeNN.js' });
    expect(res.headers['cache-control']).toBe('public, max-age=31536000, immutable');
  });

  it('returns index.html for a deep link', async () => {
    const res = await (await start()).app.inject({ method: 'GET', url: '/rooms/abc' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<title>app</title>');
  });

  it('returns the JSON 404 for an unknown /api path', async () => {
    const res = await (await start()).app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'not_found' });
  });

  it('does not serve a file outside the directory', async () => {
    writeFileSync(join(dir, '..', 'sgs-secret.txt'), 'secret');
    try {
      const res = await (await start()).app.inject({ method: 'GET', url: '/..%2fsgs-secret.txt' });
      expect(res.body).not.toContain('secret');
    } finally {
      rmSync(join(dir, '..', 'sgs-secret.txt'), { force: true });
    }
  });

  it('answers /healthz with 200 for GET and HEAD without a cookie or Origin', async () => {
    const { app } = await start(null);
    const get = await app.inject({ method: 'GET', url: '/healthz' });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toEqual({ status: 'ok' });
    expect((await app.inject({ method: 'HEAD', url: '/healthz' })).statusCode).toBe(200);
  });

  it('refuses to start when STATIC_DIR has no index.html', async () => {
    rmSync(join(dir, 'index.html'));
    await expect(start()).rejects.toThrow(dir);
  });

  it('serves nothing extra when STATIC_DIR is unset', async () => {
    const res = await (await start(null)).app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toMatchObject({ code: 'not_found' });
  });
});
