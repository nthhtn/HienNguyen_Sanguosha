import { hashToken, newToken } from './tokens';

describe('tokens', () => {
  it('makes 32 random bytes as base64url', () => {
    const token = newToken();
    expect(token).toMatch(/^[\w-]{43}$/);
    expect(newToken()).not.toBe(token);
  });

  it('hashes with sha256 to hex, deterministically', () => {
    const token = newToken();
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toBe(hashToken(newToken()));
  });
});
