import { CONNECT_TIMEOUT_MS, poolConfig } from './db';

describe('poolConfig', () => {
  it('has no ssl option by default', () => {
    expect(poolConfig('postgres://x', false)).toEqual({ connectionString: 'postgres://x', connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
  });

  it('encrypts without verifying the certificate chain when ssl is on', () => {
    expect(poolConfig('postgres://x', true)).toEqual({ connectionString: 'postgres://x', connectionTimeoutMillis: CONNECT_TIMEOUT_MS, ssl: { rejectUnauthorized: false } });
  });

  it('gives up connecting instead of waiting forever', () => {
    expect(CONNECT_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
