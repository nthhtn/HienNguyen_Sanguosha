import { ConfigError, loadConfig } from './config';

describe('loadConfig', () => {
  it('has dev defaults', () => {
    expect(loadConfig({})).toEqual({
      port: 3000,
      host: '127.0.0.1',
      databaseUrl: null,
      publicOrigin: 'http://localhost:4200',
      buildId: 'dev',
      trustProxy: false,
      cookieSecure: false,
      production: false,
    });
  });

  it('reads every variable', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      PORT: '8080',
      HOST: '0.0.0.0',
      DATABASE_URL: 'postgres://u:p@db/x',
      PUBLIC_ORIGIN: 'https://sgs.example/',
      BUILD_ID: 'abc123',
      TRUST_PROXY: 'true',
    });
    expect(config).toEqual({
      port: 8080,
      host: '0.0.0.0',
      databaseUrl: 'postgres://u:p@db/x',
      publicOrigin: 'https://sgs.example',
      buildId: 'abc123',
      trustProxy: true,
      cookieSecure: true,
      production: true,
    });
  });

  it('binds to every interface by default in production', () => {
    expect(loadConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://x', PUBLIC_ORIGIN: 'https://a.example' }).host).toBe('0.0.0.0');
  });

  it('refuses to start in production without a database or public origin, naming both', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(ConfigError);
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/DATABASE_URL.*PUBLIC_ORIGIN/);
  });

  it('rejects a port that is not a number', () => {
    expect(() => loadConfig({ PORT: 'abc' })).toThrow(ConfigError);
  });

  it('rejects a PUBLIC_ORIGIN with a path', () => {
    expect(() => loadConfig({ PUBLIC_ORIGIN: 'https://a.example/app' })).toThrow(ConfigError);
  });
});
