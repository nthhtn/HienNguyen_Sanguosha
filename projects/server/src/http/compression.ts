import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { brotliCompress, constants, gzip } from 'node:zlib';

export type Encoding = 'br' | 'gzip';

// Text compresses well; images, audio and fonts are already compressed.
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt']);

// Below this a compressed body saves too little to be worth the CPU.
export const MIN_COMPRESS_BYTES = 1024;

export function isCompressible(ext: string): boolean {
  return COMPRESSIBLE.has(ext.toLowerCase());
}

// Brotli when the client accepts it, else gzip; null for neither (or when q=0 refuses both).
export function chooseEncoding(acceptEncoding: string | undefined): Encoding | null {
  if (!acceptEncoding) return null;
  const weights = new Map<string, number>();
  for (const part of acceptEncoding.split(',')) {
    const [name, ...params] = part.trim().toLowerCase().split(';');
    const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
    weights.set(name.trim(), q === undefined ? 1 : Number(q.slice(2)));
  }
  const weight = (encoding: string): number => weights.get(encoding) ?? weights.get('*') ?? 0;
  if (weight('br') > 0) return 'br';
  if (weight('gzip') > 0) return 'gzip';
  return null;
}

const brotli = promisify(brotliCompress);
const gzipAsync = promisify(gzip);

// Compressed bodies by file, encoding, size and modification time, so each file is compressed once per process
// (the build's files are a finite set; about 0.5 MB for the JS). A promise is stored so simultaneous requests share one run.
const cache = new Map<string, Promise<Buffer>>();
const latestKey = new Map<string, string>();

export function compressedBody(path: string, file: { size: number; mtimeMs: number }, encoding: Encoding): Promise<Buffer> {
  const slot = `${path}|${encoding}`;
  const key = `${slot}|${file.size}|${file.mtimeMs}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const stale = latestKey.get(slot);
  if (stale !== undefined) cache.delete(stale);
  latestKey.set(slot, key);
  const body = readFile(path).then((data) => (encoding === 'br' ? brotli(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }) : gzipAsync(data, { level: 6 })));
  cache.set(key, body);
  body.catch(() => {
    cache.delete(key);
    if (latestKey.get(slot) === key) latestKey.delete(slot);
  });
  return body;
}
