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
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: Record<string, string | undefined>): ServerConfig {
  const production = env['NODE_ENV'] === 'production';
  const missing = ['DATABASE_URL', 'PUBLIC_ORIGIN'].filter((name) => production && !env[name]);
  if (missing.length > 0) throw new ConfigError(`Missing required environment variables: ${missing.join(', ')}`);

  const port = Number(env['PORT'] ?? '3000');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new ConfigError(`PORT must be a port number, got "${env['PORT']}"`);

  const publicOrigin = parseOrigin(env['PUBLIC_ORIGIN'] ?? 'http://localhost:4200');
  if (production && !isSecureOrLocal(publicOrigin)) throw new ConfigError('PUBLIC_ORIGIN must be https in production, so the session cookie is Secure');
  return {
    port,
    host: env['HOST'] ?? (production ? '0.0.0.0' : '127.0.0.1'),
    databaseUrl: env['DATABASE_URL'] || null,
    publicOrigin,
    buildId: env['BUILD_ID'] || 'dev',
    trustProxy: parseTrustProxy(env['TRUST_PROXY']),
    cookieSecure: publicOrigin.startsWith('https:'),
    production,
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
