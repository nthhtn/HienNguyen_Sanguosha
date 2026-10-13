export interface ServerConfig {
  port: number;
  host: string;
  // Null: the in-memory store, for local runs without Docker. Never in production.
  databaseUrl: string | null;
  // The site's origin. Requests must come from it, and emailed links point to it.
  publicOrigin: string;
  // The engine + content build; stored on each game in Stage 4.
  buildId: string;
  // Behind a reverse proxy: take the client IP from X-Forwarded-For.
  trustProxy: boolean;
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
  return {
    port,
    host: env['HOST'] ?? (production ? '0.0.0.0' : '127.0.0.1'),
    databaseUrl: env['DATABASE_URL'] || null,
    publicOrigin,
    buildId: env['BUILD_ID'] || 'dev',
    trustProxy: env['TRUST_PROXY'] === 'true',
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
