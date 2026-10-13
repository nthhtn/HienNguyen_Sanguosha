import { Value } from '@sinclair/typebox/value';
import { GuestBodySchema, MeSchema, ResetPasswordBodySchema, SignInBodySchema, SignUpBodySchema } from './index';

describe('auth schemas', () => {
  it('accepts a sign-up body, including an email with surrounding spaces', () => {
    expect(Value.Check(SignUpBodySchema, { email: ' Ann@Example.com ', password: 'secret-pass', displayName: 'Ann' })).toBe(true);
  });

  it('rejects a sign-up body with a missing field', () => {
    expect(Value.Check(SignUpBodySchema, { email: 'ann@example.com', password: 'secret-pass' })).toBe(false);
  });

  it('rejects an email without an @', () => {
    expect(Value.Check(SignInBodySchema, { email: 'ann.example.com', password: 'x' })).toBe(false);
  });

  it('rejects a password over 200 characters', () => {
    expect(Value.Check(SignInBodySchema, { email: 'a@b.c', password: 'x'.repeat(201) })).toBe(false);
    expect(Value.Check(ResetPasswordBodySchema, { token: 't', password: 'x'.repeat(201) })).toBe(false);
  });

  it('leaves the semantic checks (short password, blank name) to the server', () => {
    expect(Value.Check(SignUpBodySchema, { email: 'a@b.c', password: 'short', displayName: ' ' })).toBe(true);
  });

  it('requires a display name for a guest', () => {
    expect(Value.Check(GuestBodySchema, {})).toBe(false);
    expect(Value.Check(GuestBodySchema, { displayName: 'Guest' })).toBe(true);
  });

  it('describes a guest Me without an email and a registered one with it', () => {
    expect(Value.Check(MeSchema, { id: 'u1', kind: 'guest', displayName: 'Guest' })).toBe(true);
    expect(Value.Check(MeSchema, { id: 'u2', kind: 'registered', displayName: 'Ann', email: 'ann@example.com' })).toBe(true);
    expect(Value.Check(MeSchema, { id: 'u3', kind: 'admin', displayName: 'X' })).toBe(false);
  });
});
