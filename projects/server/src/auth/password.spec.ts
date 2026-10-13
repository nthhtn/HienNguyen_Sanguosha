import { hashPassword, verifyPassword } from './password';

describe('password hashing', () => {
  it('stores scrypt parameters, salt and key in the hash string', async () => {
    expect(await hashPassword('secret-pass')).toMatch(/^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/);
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const stored = await hashPassword('secret-pass');
    expect(await verifyPassword('secret-pass', stored)).toBe(true);
    expect(await verifyPassword('secret-pasS', stored)).toBe(false);
  });

  it('salts every hash', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects a malformed stored hash instead of throwing', async () => {
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$1$2$3$4$5')).toBe(false);
  });

  it('treats composed and decomposed Unicode as the same password', async () => {
    const stored = await hashPassword('caf\u00e9-secret');
    expect(await verifyPassword('cafe\u0301-secret', stored)).toBe(true);
  });
});
