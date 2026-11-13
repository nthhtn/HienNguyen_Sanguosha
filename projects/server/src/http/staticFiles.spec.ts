import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { loadConfig } from '../config';
import { createServer, RunningServer } from '../server';

describe('static files and /health', () => {
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

  it('returns 404 for a missing file, so a stale build file is not answered with HTML', async () => {
    const res = await (await start()).app.inject({ method: 'GET', url: '/chunk-OLDOLD01.js' });
    expect(res.statusCode).toBe(404);
  });

  it('serves the web app manifest with its own content type', async () => {
    writeFileSync(join(dir, 'manifest.webmanifest'), '{"name":"app"}');
    const res = await (await start()).app.inject({ method: 'GET', url: '/manifest.webmanifest' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('application/manifest+json');
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
  });

  it('returns 404 for a missing manifest, not the app', async () => {
    const res = await (await start()).app.inject({ method: 'GET', url: '/manifest.webmanifest' });
    expect(res.statusCode).toBe(404);
  });

  it('does not touch the session for a static file: no Set-Cookie on a public response', async () => {
    const { app } = await start();
    const guest = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: { displayName: 'G' }, headers: { origin: 'http://localhost:4200' } });
    const session = guest.cookies.find((c) => c.name === 'sgs_session')!.value;
    const res = await app.inject({ method: 'GET', url: '/chunk-B2THbeNN.js', cookies: { sgs_session: session } });
    expect(res.headers['cache-control']).toContain('public');
    expect(res.headers['set-cookie']).toBeUndefined();
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

  it('answers /health with 200 for GET and HEAD without a cookie or Origin', async () => {
    const { app } = await start(null);
    const get = await app.inject({ method: 'GET', url: '/health' });
    expect(get.statusCode).toBe(200);
    expect(get.json()).toEqual({ status: 'ok' });
    expect((await app.inject({ method: 'HEAD', url: '/health' })).statusCode).toBe(200);
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

describe('static delivery: compression, validators, ranges and caching', () => {
  let dir: string;
  let server: RunningServer | null = null;
  const MTIME = new Date('2026-11-05T10:00:00Z');
  const BIG_JS = 'export const answer = 42;\n'.repeat(400);
  const OGG = Buffer.from(Array.from({ length: 100 }, (_, i) => i));

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sgs-delivery-'));
    const files: Record<string, string | Buffer> = {
      'index.html': '<!doctype html><title>app</title>',
      'big.js': BIG_JS,
      'small.js': 'export {}',
      'logo.png': Buffer.alloc(5000, 7),
      'music.ogg': OGG,
      'favicon.ico': Buffer.alloc(2000, 1),
      'chunk-9dJ_PnX72.js': 'export const nine = 9;',
      'chunk--dOLav73.js': 'export const dash = 1;',
      'chunk-B2THbeNN.js': 'export {}',
      'roboto-latin-300-normal-ZNJYGCVX.woff2': Buffer.alloc(3000, 2),
    };
    for (const [name, data] of Object.entries(files)) {
      writeFileSync(join(dir, name), data);
      utimesSync(join(dir, name), MTIME, MTIME);
    }
  });

  afterEach(async () => {
    await server?.close();
    server = null;
    rmSync(dir, { recursive: true, force: true });
  });

  async function get(url: string, headers: Record<string, string> = {}, method: 'GET' | 'HEAD' = 'GET') {
    server ??= await createServer(loadConfig({ STATIC_DIR: dir }), { logger: false });
    return server.app.inject({ method, url, headers });
  }

  describe('compression', () => {
    it('sends a large text file as Brotli when the client accepts it, smaller and intact', async () => {
      const res = await get('/big.js', { 'accept-encoding': 'gzip, br' });
      expect(res.headers['content-encoding']).toBe('br');
      expect(res.headers['vary']).toContain('Accept-Encoding');
      expect(res.headers['content-type']).toContain('javascript');
      expect(res.rawPayload.length).toBeLessThan(BIG_JS.length / 4);
      expect(res.headers['content-length']).toBe(String(res.rawPayload.length));
      expect(brotliDecompressSync(res.rawPayload).toString()).toBe(BIG_JS);
    });

    it('compresses a large web app manifest', async () => {
      writeFileSync(join(dir, 'manifest.webmanifest'), JSON.stringify({ name: 'x'.repeat(2000) }));
      const res = await get('/manifest.webmanifest', { 'accept-encoding': 'br' });
      expect(res.headers['content-encoding']).toBe('br');
    });

    it('falls back to gzip', async () => {
      const res = await get('/big.js', { 'accept-encoding': 'gzip' });
      expect(res.headers['content-encoding']).toBe('gzip');
      expect(gunzipSync(res.rawPayload).toString()).toBe(BIG_JS);
    });

    it('sends the file as it is when the client asks for no compression, but still says the answer varies', async () => {
      const res = await get('/big.js');
      expect(res.headers['content-encoding']).toBeUndefined();
      expect(res.headers['vary']).toContain('Accept-Encoding');
      expect(res.body).toBe(BIG_JS);
      expect(res.headers['content-length']).toBe(String(BIG_JS.length));
    });

    it('never compresses images, audio, fonts or the icon, and not a file under 1 KiB', async () => {
      for (const url of ['/logo.png', '/music.ogg', '/favicon.ico', '/roboto-latin-300-normal-ZNJYGCVX.woff2', '/small.js']) {
        const res = await get(url, { 'accept-encoding': 'br, gzip' });
        expect(res.headers['content-encoding']).toBeUndefined();
        expect(res.headers['vary']).toBeUndefined();
      }
    });
  });

  describe('validators', () => {
    it('gives every file an ETag and a Last-Modified', async () => {
      const res = await get('/logo.png');
      expect(res.headers['etag']).toMatch(/^W\/"[0-9a-f]+-[0-9a-f]+"$/);
      expect(res.headers['last-modified']).toBe(MTIME.toUTCString());
    });

    it('answers 304 with no body to a matching If-None-Match, and keeps the cache headers', async () => {
      const first = await get('/logo.png');
      const res = await get('/logo.png', { 'if-none-match': first.headers['etag'] as string });
      expect(res.statusCode).toBe(304);
      expect(res.rawPayload.length).toBe(0);
      expect(res.headers['etag']).toBe(first.headers['etag']);
      expect(res.headers['cache-control']).toBe('public, max-age=86400');
    });

    it('answers 304 to an If-Modified-Since at or after the file time, and 200 to an earlier one', async () => {
      expect((await get('/logo.png', { 'if-modified-since': MTIME.toUTCString() })).statusCode).toBe(304);
      expect((await get('/logo.png', { 'if-modified-since': new Date(MTIME.getTime() - 60000).toUTCString() })).statusCode).toBe(200);
    });

    it('answers 200 again once the file changed', async () => {
      const first = await get('/logo.png');
      writeFileSync(join(dir, 'logo.png'), Buffer.alloc(5001, 7));
      const res = await get('/logo.png', { 'if-none-match': first.headers['etag'] as string });
      expect(res.statusCode).toBe(200);
      expect(res.headers['etag']).not.toBe(first.headers['etag']);
    });

    it('revalidates a compressed file with the same ETag, so a 304 works for any coding', async () => {
      const plain = await get('/big.js');
      const res = await get('/big.js', { 'accept-encoding': 'br', 'if-none-match': plain.headers['etag'] as string });
      expect(res.statusCode).toBe(304);
    });

    it('gives index.html a validator too, so its no-cache revalidation is a 304', async () => {
      const first = await get('/');
      expect(first.headers['cache-control']).toBe('no-cache');
      expect((await get('/', { 'if-none-match': first.headers['etag'] as string })).statusCode).toBe(304);
    });
  });

  describe('content types', () => {
    it.each([
      ['preview.mp4', 'video/mp4'],
      ['music.ogg', 'audio/ogg'],
      ['skin.webp', 'image/webp'],
      ['font.woff2', 'font/woff2'],
      ['font.woff', 'font/woff'],
    ])('sends %s as %s', async (name, type) => {
      writeFileSync(join(dir, name), Buffer.alloc(64, 3));
      expect((await get(`/${name}`)).headers['content-type']).toBe(type);
    });

    it('sends a video that can be seeked: a range of an mp4 is a 206 with the video type', async () => {
      writeFileSync(join(dir, 'preview.mp4'), Buffer.alloc(1000, 5));
      const res = await get('/preview.mp4', { range: 'bytes=0-99' });
      expect(res.statusCode).toBe(206);
      expect(res.headers['content-type']).toBe('video/mp4');
      expect(res.headers['content-range']).toBe('bytes 0-99/1000');
    });
  });

  describe('Content-Length and HEAD', () => {
    it('sends the length of the file', async () => {
      expect((await get('/music.ogg')).headers['content-length']).toBe('100');
    });

    it('answers HEAD with the same headers and no body', async () => {
      const get_ = await get('/music.ogg');
      const head = await get('/music.ogg', {}, 'HEAD');
      expect(head.statusCode).toBe(200);
      expect(head.rawPayload.length).toBe(0);
      expect(head.headers['content-length']).toBe('100');
      expect(head.headers['etag']).toBe(get_.headers['etag']);
      expect(head.headers['accept-ranges']).toBe('bytes');
    });

    it('gives HEAD of a compressed file the compressed length', async () => {
      const full = await get('/big.js', { 'accept-encoding': 'br' });
      const head = await get('/big.js', { 'accept-encoding': 'br' }, 'HEAD');
      expect(head.headers['content-length']).toBe(String(full.rawPayload.length));
      expect(head.headers['content-encoding']).toBe('br');
    });
  });

  describe('ranges', () => {
    it('offers ranges on every file', async () => {
      expect((await get('/music.ogg')).headers['accept-ranges']).toBe('bytes');
      expect((await get('/big.js')).headers['accept-ranges']).toBe('bytes');
    });

    it('answers a byte range with 206, the part, and Content-Range', async () => {
      const res = await get('/music.ogg', { range: 'bytes=0-3' });
      expect(res.statusCode).toBe(206);
      expect(res.headers['content-range']).toBe('bytes 0-3/100');
      expect(res.headers['content-length']).toBe('4');
      expect(res.rawPayload.equals(OGG.subarray(0, 4))).toBe(true);
    });

    it('answers an open-ended and a suffix range', async () => {
      const open = await get('/music.ogg', { range: 'bytes=90-' });
      expect(open.headers['content-range']).toBe('bytes 90-99/100');
      expect(open.rawPayload.equals(OGG.subarray(90))).toBe(true);
      const suffix = await get('/music.ogg', { range: 'bytes=-10' });
      expect(suffix.headers['content-range']).toBe('bytes 90-99/100');
    });

    it('answers a range it cannot satisfy with 416 and the size', async () => {
      const res = await get('/music.ogg', { range: 'bytes=200-' });
      expect(res.statusCode).toBe(416);
      expect(res.headers['content-range']).toBe('bytes */100');
    });

    it('sends the whole file for several ranges or a range it cannot read', async () => {
      for (const range of ['bytes=0-1,5-6', 'items=0-3', 'bytes=9-5']) {
        const res = await get('/music.ogg', { range });
        expect(res.statusCode).toBe(200);
        expect(res.rawPayload.equals(OGG)).toBe(true);
      }
    });

    it('does not compress a range response', async () => {
      const res = await get('/big.js', { range: 'bytes=0-9', 'accept-encoding': 'br' });
      expect(res.statusCode).toBe(206);
      expect(res.headers['content-encoding']).toBeUndefined();
      expect(res.body).toBe(BIG_JS.slice(0, 10));
    });

    it('honours If-Range with the file date, and sends everything when it does not match', async () => {
      const matching = await get('/music.ogg', { range: 'bytes=0-3', 'if-range': MTIME.toUTCString() });
      expect(matching.statusCode).toBe(206);
      const other = await get('/music.ogg', { range: 'bytes=0-3', 'if-range': new Date(MTIME.getTime() + 5000).toUTCString() });
      expect(other.statusCode).toBe(200);
      expect(other.rawPayload.equals(OGG)).toBe(true);
    });

    it('answers HEAD for a range without a body', async () => {
      const head = await get('/music.ogg', { range: 'bytes=0-3' }, 'HEAD');
      expect(head.statusCode).toBe(206);
      expect(head.rawPayload.length).toBe(0);
      expect(head.headers['content-length']).toBe('4');
    });
  });

  describe('cache policy', () => {
    it('does not cache index.html, and a deep link answered with it', async () => {
      expect((await get('/')).headers['cache-control']).toBe('no-cache');
      expect((await get('/rooms/abc')).headers['cache-control']).toBe('no-cache');
    });

    it.each(['/chunk-B2THbeNN.js', '/chunk-9dJ_PnX72.js', '/chunk--dOLav73.js', '/roboto-latin-300-normal-ZNJYGCVX.woff2'])(
      'caches the hashed build file %s for a year',
      async (url) => {
        expect((await get(url)).headers['cache-control']).toBe('public, max-age=31536000, immutable');
      },
    );

    it('caches images, audio, the icon and other files for a day', async () => {
      for (const url of ['/logo.png', '/music.ogg', '/favicon.ico', '/big.js', '/small.js']) {
        expect((await get(url)).headers['cache-control']).toBe('public, max-age=86400');
      }
    });
  });
});
