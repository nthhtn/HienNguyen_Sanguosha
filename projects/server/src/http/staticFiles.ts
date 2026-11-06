import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { FastifyReply, FastifyRequest } from 'fastify';
import { chooseEncoding, compressedBody, isCompressible, MIN_COMPRESS_BYTES } from './compression';
import { ifRangeMatches, isNotModified, parseRange, weakEtag } from './conditional';
import { errorBody } from './errors';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
};

// Angular names build files like `chunk-B2THbeNN.js` or `media/roboto-latin-300-normal-ZNJYGCVX.woff2`: the hash
// (8 characters, 9 when two chunks collide, and it may contain `-`) changes with the content.
const HASHED_BUILD_FILE = /-[A-Za-z0-9_-]{8,9}\.(js|css|woff2?)$/;

const IMMUTABLE = 'public, max-age=31536000, immutable';
// Images and audio keep their names, so they are revalidated (a cheap 304) after a day.
const ASSET_CACHE = 'public, max-age=86400';

export type StaticHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;

function pathnameOf(url: string): string {
  return new URL(url, 'http://localhost').pathname;
}

// Serves the built Angular app from `staticDir`. A path that is not a file there
// (a deep link such as /rooms/abc, or one that steps outside the directory) gets
// index.html, so the Angular router can take over. Throws when index.html is missing.
export async function createStaticHandler(staticDir: string): Promise<StaticHandler> {
  const root = resolve(staticDir);
  const indexPath = join(root, 'index.html');
  if (!(await isFile(indexPath))) throw new Error(`STATIC_DIR ${root} has no index.html`);

  return async (request, reply) => {
    const file = await resolveFile(root, request.url);
    // A path that names a file but is not there (a build file from before a deploy) is a 404, not the app.
    if (!file && extname(pathnameOf(request.url)) !== '') return reply.code(404).send(errorBody('not_found'));
    const path = file ?? indexPath;
    const info = await stat(path);
    const etag = weakEtag(info.size, info.mtimeMs);
    const lastModified = new Date(info.mtimeMs).toUTCString();
    const ext = extname(path).toLowerCase();
    const compressible = isCompressible(ext) && info.size >= MIN_COMPRESS_BYTES;

    reply
      .header('cache-control', path === indexPath ? 'no-cache' : HASHED_BUILD_FILE.test(path) ? IMMUTABLE : ASSET_CACHE)
      .header('etag', etag)
      .header('last-modified', lastModified)
      .header('accept-ranges', 'bytes')
      .type(CONTENT_TYPES[ext] ?? 'application/octet-stream');
    if (compressible) reply.header('vary', 'Accept-Encoding');

    if (isNotModified({ ifNoneMatch: headerOf(request, 'if-none-match'), ifModifiedSince: headerOf(request, 'if-modified-since') }, etag, info.mtimeMs)) {
      return reply.code(304).send();
    }

    const head = request.method === 'HEAD';
    const range = ifRangeMatches(headerOf(request, 'if-range'), lastModified) ? parseRange(headerOf(request, 'range'), info.size) : { kind: 'none' as const };
    if (range.kind === 'unsatisfiable') return reply.code(416).header('content-range', `bytes */${info.size}`).send();
    if (range.kind === 'range') {
      reply.code(206).header('content-range', `bytes ${range.start}-${range.end}/${info.size}`).header('content-length', range.end - range.start + 1);
      return head ? reply.send() : reply.send(createReadStream(path, { start: range.start, end: range.end }));
    }

    const encoding = compressible ? chooseEncoding(headerOf(request, 'accept-encoding')) : null;
    if (encoding) {
      const body = await compressedBody(path, info, encoding);
      reply.header('content-encoding', encoding).header('content-length', body.length);
      return head ? reply.send() : reply.send(body);
    }
    reply.header('content-length', info.size);
    return head ? reply.send() : reply.send(createReadStream(path));
  };
}

function headerOf(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

async function resolveFile(root: string, url: string): Promise<string | null> {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(url, 'http://localhost').pathname);
  } catch {
    return null;
  }
  const path = resolve(root, `.${pathname}`);
  if (!path.startsWith(root + sep)) return null;
  return (await isFile(path)) ? path : null;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}
