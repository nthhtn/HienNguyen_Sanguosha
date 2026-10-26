import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { FastifyReply, FastifyRequest } from 'fastify';

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

// Angular names build files like `chunk-B2THbeNN.js`: the hash changes with the content.
const HASHED_BUILD_FILE = /-[A-Za-z0-9_]{8}\.(js|css)$/;

export type StaticHandler = (request: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply>;

// Serves the built Angular app from `staticDir`. A path that is not a file there
// (a deep link such as /rooms/abc, or one that steps outside the directory) gets
// index.html, so the Angular router can take over. Throws when index.html is missing.
export async function createStaticHandler(staticDir: string): Promise<StaticHandler> {
  const root = resolve(staticDir);
  const indexPath = join(root, 'index.html');
  if (!(await isFile(indexPath))) throw new Error(`STATIC_DIR ${root} has no index.html`);

  return async (request, reply) => {
    const file = await resolveFile(root, request.url);
    const path = file ?? indexPath;
    const cacheControl = path !== indexPath && HASHED_BUILD_FILE.test(path) ? 'public, max-age=31536000, immutable' : path === indexPath ? 'no-cache' : 'public, max-age=3600';
    return reply
      .header('cache-control', cacheControl)
      .type(CONTENT_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream')
      .send(createReadStream(path));
  };
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
