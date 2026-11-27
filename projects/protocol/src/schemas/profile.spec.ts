import { Value } from '@sinclair/typebox/value';
import { ChangePasswordBodySchema, ProfileQuerySchema, UpdateProfileBodySchema } from './index';

describe('profile schemas', () => {
  it('accepts no mode and a known mode, and rejects an unknown one', () => {
    expect(Value.Check(ProfileQuerySchema, {})).toBe(true);
    expect(Value.Check(ProfileQuerySchema, { mode: 'solo' })).toBe(true);
    expect(Value.Check(ProfileQuerySchema, { mode: 'x' })).toBe(false);
  });

  it('requires a display name that is not absurdly long', () => {
    expect(Value.Check(UpdateProfileBodySchema, {})).toBe(false);
    expect(Value.Check(UpdateProfileBodySchema, { displayName: 'Ann' })).toBe(true);
    expect(Value.Check(UpdateProfileBodySchema, { displayName: 'x'.repeat(500) })).toBe(false);
  });

  it('allows no current password (a Google-only account sets its first), but always requires the new one', () => {
    expect(Value.Check(ChangePasswordBodySchema, { newPassword: 'secret-pass' })).toBe(true);
    expect(Value.Check(ChangePasswordBodySchema, { currentPassword: 'a' })).toBe(false);
  });

  it('caps password lengths, and leaves the length rule to the server', () => {
    expect(Value.Check(ChangePasswordBodySchema, { currentPassword: 'a', newPassword: 'x'.repeat(201) })).toBe(false);
    expect(Value.Check(ChangePasswordBodySchema, { currentPassword: 'a', newPassword: 'short' })).toBe(true);
  });
});
