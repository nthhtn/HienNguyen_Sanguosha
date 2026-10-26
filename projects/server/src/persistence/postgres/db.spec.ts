import { poolConfig } from './db';

describe('poolConfig', () => {
  it('has no ssl option by default', () => {
    expect(poolConfig('postgres://x', false)).toEqual({ connectionString: 'postgres://x' });
  });

  it('encrypts without verifying the certificate chain when ssl is on', () => {
    expect(poolConfig('postgres://x', true)).toEqual({ connectionString: 'postgres://x', ssl: { rejectUnauthorized: false } });
  });
});
