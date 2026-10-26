export interface ServerConfig {
  port: number;
  host: string;
  // Null: the in-memory store, for local runs without Docker. Never in production.
  databaseUrl: string | null;
  // The site's origin. Requests must come from it, and emailed links point to it.
  publicOrigin: string;
  // The engine + content build; stored on each game in Stage 4.
  buildId: string;
  // Behind a reverse proxy: which X-Forwarded-For hops to trust for the client
  // IP. A hop count, or the proxies' addresses/CIDRs; false trusts none. Never
  // every hop: the left-most entry is the client's own claim.
  trustProxy: false | number | string[];
  cookieSecure: boolean;
  production: boolean;
  // The built Angular app, served by the server when set (the Docker image sets it).
  staticDir: string | null;
  // Encrypt the Postgres connection (Supabase requires it). The certificate chain is not verified.
  databaseSsl: boolean;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: Record<string, string | undefined>): ServerConfig {
  const production = env['NODE_ENV'] === 'production';
  const missing = ['DATABASE_URL', 'PUBLIC_ORIGIN', 'DATABASE_SSL'].filter((name) => production && !env[name]);
  if (missing.length > 0) throw new ConfigError(`Missing required environment variables: ${missing.join(', ')}`);

  const port = Number(env['PORT'] ?? '4201');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new ConfigError(`PORT must be a port number, got "${env['PORT']}"`);

  const databaseSsl = parseDatabaseSsl(env['DATABASE_SSL']);
  if (databaseSsl && env['DATABASE_URL']) rejectSslParameters(env['DATABASE_URL']);

  const publicOrigin = parseOrigin(env['PUBLIC_ORIGIN'] ?? 'http://localhost:4200');
  if (production && !isSecureOrLocal(publicOrigin)) throw new ConfigError('PUBLIC_ORIGIN must be https in production, so the session cookie is Secure');
  return {
    port,
    host: env['HOST'] ?? (production ? '0.0.0.0' : '127.0.0.1'),
    databaseUrl: env['DATABASE_URL'] || null,
    publicOrigin,
    // RENDER_GIT_COMMIT: Render sets it on every deploy, and cannot copy it into BUILD_ID.
    buildId: env['BUILD_ID'] || env['RENDER_GIT_COMMIT'] || 'dev',
    trustProxy: parseTrustProxy(env['TRUST_PROXY']),
    cookieSecure: publicOrigin.startsWith('https:'),
    production,
    staticDir: env['STATIC_DIR'] || null,
    databaseSsl,
  };
}

function parseOrigin(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`PUBLIC_ORIGIN must be a URL, got "${raw}"`);
  }
  if (url.pathname !== '/' || url.search || url.hash) throw new ConfigError(`PUBLIC_ORIGIN must be an origin with no path, got "${raw}"`);
  return url.origin;
}

function isSecureOrLocal(origin: string): boolean {
  const url = new URL(origin);
  return url.protocol === 'https:' || url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

function parseDatabaseSsl(raw: string | undefined): boolean {
  const value = raw?.trim() ?? '';
  if (value === '' || value === 'off') return false;
  if (value === 'require') return true;
  throw new ConfigError(`DATABASE_SSL must be "require" or "off", got "${raw}"`);
}

// `pg` lets the URL override the ssl option, so `?sslmode=disable` would silently turn TLS off.
function rejectSslParameters(databaseUrl: string): void {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return; // the connection fails later with pg's own message; never echo the URL
  }
  const names = [...url.searchParams.keys()].filter((name) => /^ssl|^uselibpqcompat$/i.test(name));
  if (names.length > 0) throw new ConfigError(`DATABASE_URL must not carry ${names.join(', ')} when DATABASE_SSL=require; the server sets TLS itself`);
}

function parseTrustProxy(raw: string | undefined): false | number | string[] {
  const value = raw?.trim() ?? '';
  if (value === '' || value === 'false') return false;
  // Trusting every hop makes the client IP the left-most X-Forwarded-For entry,
  // which the client writes itself, so per-IP rate limits could be dodged.
  if (value === 'true') throw new ConfigError('TRUST_PROXY=true would trust every hop and let clients spoof their IP; use a hop count (e.g. 1) or the proxy addresses');
  if (/^\d+$/.test(value)) return Number(value);
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}
