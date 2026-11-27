import { hashPassword, verifyPassword } from '../auth/password';
import { AuthError } from '../auth/accounts';
import { hashToken } from '../auth/tokens';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { UserRecord } from '../persistence/records';
import { ProfileService } from './profileService';

const NOW = new Date('2026-11-27T12:00:00.000Z');

async function setup() {
  const repos = createMemoryRepositories();
  const profile = new ProfileService({ repos, now: () => NOW });
  const user: UserRecord = await repos.users.createRegistered({ email: 'ann@example.com', passwordHash: await hashPassword('old-password'), displayName: 'Ann', now: new Date(NOW.getTime() - 60_000) });
  const session = (name: string) => repos.sessions.create({ userId: user.id, tokenHash: hashToken(name), now: NOW, expiresAt: new Date(NOW.getTime() + 60_000) });
  const active = async (name: string) => (await repos.sessions.findActiveByTokenHash(hashToken(name), NOW)) !== null;
  return { repos, profile, user, session, active };
}

describe('ProfileService', () => {
  it('answers with the stats of the user, filtered by mode', async () => {
    const { profile, user } = await setup();
    const stats = await profile.stats(user, 'solo');
    expect(stats).toMatchObject({ displayName: 'Ann', memberSince: user.createdAt.getTime(), mode: 'solo', totals: { games: 0, winRate: null } });
  });

  describe('rename', () => {
    it('stores the normalized name and returns the updated user', async () => {
      const { repos, profile, user } = await setup();
      const updated = await profile.rename(user, '  Ann Two  ');
      expect(updated).toMatchObject({ id: user.id, displayName: 'Ann Two', updatedAt: NOW });
      expect((await repos.users.findById(user.id))?.displayName).toBe('Ann Two');
    });

    it('refuses a blank name and a [Bot] name, and leaves the name as it was', async () => {
      const { repos, profile, user } = await setup();
      await expect(profile.rename(user, '   ')).rejects.toEqual(expect.any(AuthError));
      await expect(profile.rename(user, '[Bot] Ann')).rejects.toMatchObject({ code: 'invalid_name' });
      expect((await repos.users.findById(user.id))?.displayName).toBe('Ann');
    });
  });

  describe('setting a first password (a Google account has none)', () => {
    const googleUser = async () => {
      const { repos, profile, active } = await setup();
      const user = await repos.users.createFromGoogle({ email: 'gail@example.com', displayName: 'Gail', now: NOW });
      const mine = await repos.sessions.create({ userId: user.id, tokenHash: hashToken('mine'), now: NOW, expiresAt: new Date(NOW.getTime() + 60_000) });
      await repos.sessions.create({ userId: user.id, tokenHash: hashToken('other'), now: NOW, expiresAt: new Date(NOW.getTime() + 60_000) });
      return { repos, profile, user, mine, active };
    };

    it('stores the password without a current one, keeps this session and revokes the others', async () => {
      const { repos, profile, user, mine, active } = await googleUser();
      await profile.changePassword(user, mine.id, { newPassword: 'brand-new-pass' });
      expect(await verifyPassword('brand-new-pass', (await repos.users.findById(user.id))!.passwordHash!)).toBe(true);
      expect(await active('mine')).toBe(true);
      expect(await active('other')).toBe(false);
    });

    it('refuses a weak password, and stores nothing', async () => {
      const { repos, profile, user, mine } = await googleUser();
      await expect(profile.changePassword(user, mine.id, { newPassword: 'short' })).rejects.toMatchObject({ code: 'weak_password' });
      expect((await repos.users.findById(user.id))!.passwordHash).toBeNull();
    });

    it('still needs the right current password once the account has one, and a missing one is refused', async () => {
      const { repos, profile, user, mine } = await googleUser();
      await profile.changePassword(user, mine.id, { newPassword: 'first-password' });
      const withPassword = (await repos.users.findById(user.id))!;
      await expect(profile.changePassword(withPassword, mine.id, { newPassword: 'second-password' })).rejects.toMatchObject({ code: 'invalid_credentials' });
      await expect(profile.changePassword(withPassword, mine.id, { currentPassword: 'wrong-pass', newPassword: 'second-password' })).rejects.toMatchObject({ code: 'invalid_credentials' });
      await profile.changePassword(withPassword, mine.id, { currentPassword: 'first-password', newPassword: 'second-password' });
    });
  });

  describe('changePassword', () => {
    it('refuses a wrong current password and revokes nothing', async () => {
      const { repos, profile, user, session, active } = await setup();
      const current = await session('current');
      await session('other');
      await expect(profile.changePassword(user, current.id, { currentPassword: 'nope-nope', newPassword: 'brand-new-pass' })).rejects.toMatchObject({ code: 'invalid_credentials' });
      expect(await active('other')).toBe(true);
      expect(await verifyPassword('old-password', (await repos.users.findById(user.id))!.passwordHash!)).toBe(true);
    });

    it('refuses a weak new password and revokes nothing', async () => {
      const { profile, user, session, active } = await setup();
      const current = await session('current');
      await session('other');
      await expect(profile.changePassword(user, current.id, { currentPassword: 'old-password', newPassword: 'short' })).rejects.toMatchObject({ code: 'weak_password' });
      expect(await active('other')).toBe(true);
    });

    it('stores the new hash, keeps the current session, revokes the others and voids reset links', async () => {
      const { repos, profile, user, session, active } = await setup();
      const current = await session('current');
      await session('other');
      await repos.resetTokens.create({ userId: user.id, tokenHash: 'reset-hash', now: NOW, expiresAt: new Date(NOW.getTime() + 60_000) });
      await profile.changePassword(user, current.id, { currentPassword: 'old-password', newPassword: 'brand-new-pass' });
      expect(await verifyPassword('brand-new-pass', (await repos.users.findById(user.id))!.passwordHash!)).toBe(true);
      expect(await active('current')).toBe(true);
      expect(await active('other')).toBe(false);
      expect(await repos.resetTokens.consume('reset-hash', NOW)).toBeNull();
    });
  });
});
