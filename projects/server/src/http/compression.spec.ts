import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { chooseEncoding, compressedBody, isCompressible } from './compression';

describe('chooseEncoding', () => {
  it.each([
    ['br, gzip', 'br'],
    ['gzip, deflate, br', 'br'],
    ['gzip', 'gzip'],
    ['GZIP', 'gzip'],
    ['gzip;q=0, br', 'br'],
    ['br;q=0, gzip', 'gzip'],
    ['*', 'br'],
    ['identity', null],
    ['deflate', null],
    ['gzip;q=0, br;q=0', null],
    ['', null],
    [undefined, null],
  ])('%p gives %p', (header, expected) => {
    expect(chooseEncoding(header)).toBe(expected);
  });
});

describe('isCompressible', () => {
  it.each(['.html', '.js', '.css', '.json', '.svg', '.txt', '.JS'])('compresses %s', (ext) => {
    expect(isCompressible(ext)).toBe(true);
  });

  it.each(['.png', '.jpg', '.webp', '.ogg', '.mp3', '.woff', '.woff2', '.ico', '.mp4', '', '.bin'])('leaves %p alone', (ext) => {
    expect(isCompressible(ext)).toBe(false);
  });
});

describe('compressedBody', () => {
  let dir: string;
  const text = 'export const answer = 42;\n'.repeat(400);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sgs-compress-'));
    writeFileSync(join(dir, 'a.js'), text);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const stat = (mtimeMs: number) => ({ size: Buffer.byteLength(text), mtimeMs });

  it('compresses with Brotli and with gzip, smaller than the original and lossless', async () => {
    const br = await compressedBody(join(dir, 'a.js'), stat(1000), 'br');
    const gz = await compressedBody(join(dir, 'a.js'), stat(1000), 'gzip');
    expect(br.length).toBeLessThan(text.length / 4);
    expect(gz.length).toBeLessThan(text.length / 4);
    expect(brotliDecompressSync(br).toString()).toBe(text);
    expect(gunzipSync(gz).toString()).toBe(text);
  });

  it('compresses a file once: the second call returns the same buffer', async () => {
    const first = await compressedBody(join(dir, 'a.js'), stat(1000), 'br');
    expect(await compressedBody(join(dir, 'a.js'), stat(1000), 'br')).toBe(first);
  });

  it('compresses again when the file changed (another time or size)', async () => {
    const first = await compressedBody(join(dir, 'a.js'), stat(1000), 'br');
    expect(await compressedBody(join(dir, 'a.js'), stat(2000), 'br')).not.toBe(first);
  });

  it('keeps Brotli and gzip results apart', async () => {
    const br = await compressedBody(join(dir, 'a.js'), stat(1000), 'br');
    const gz = await compressedBody(join(dir, 'a.js'), stat(1000), 'gzip');
    expect(br).not.toBe(gz);
  });

  it('shares one compression between simultaneous requests for the same file', async () => {
    const [a, b] = await Promise.all([compressedBody(join(dir, 'a.js'), stat(1000), 'br'), compressedBody(join(dir, 'a.js'), stat(1000), 'br')]);
    expect(a).toBe(b);
    utimesSync(join(dir, 'a.js'), 1, 1);
  });
});
