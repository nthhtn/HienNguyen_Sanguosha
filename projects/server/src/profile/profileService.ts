import type { ProfileMode, ProfileStats } from 'protocol';
import { AuthError, requireName, requirePassword } from '../auth/accounts';
import { hashPassword, verifyPassword } from '../auth/password';
import { UserRecord } from '../persistence/records';
import { Repositories } from '../persistence/repositories';
import { computeProfile } from './stats';

export interface ProfileServiceDeps {
  repos: Repositories;
  now?: () => Date;
}

// What a registered user sees and changes about themselves: their stats, their
// name and their password.
export class ProfileService {
  private readonly repos: Repositories;
  private readonly now: () => Date;

  constructor(deps: ProfileServiceDeps) {
    this.repos = deps.repos;
    this.now = deps.now ?? (() => new Date());
  }

  async stats(user: UserRecord, mode: ProfileMode): Promise<ProfileStats> {
    const rows = await this.repos.games.listSeatResultsForUser(user.id);
    return computeProfile({ displayName: user.displayName, memberSince: user.createdAt, rows, mode });
  }

  // Applies to rooms joined from now on; games already played keep their names.
  async rename(user: UserRecord, displayName: string): Promise<UserRecord> {
    const name = requireName(displayName);
    const now = this.now();
    await this.repos.users.setDisplayName(user.id, name, now);
    return { ...user, displayName: name, updatedAt: now };
  }

  // The session `sessionId` stays signed in; every other one of the user is
  // revoked, and any reset link still out is voided. An account with no password
  // yet (it signed in with Google) sets its first without a current one.
  async changePassword(user: UserRecord, sessionId: string, input: { currentPassword?: string; newPassword: string }): Promise<void> {
    if (user.passwordHash && (!input.currentPassword || !(await verifyPassword(input.currentPassword, user.passwordHash)))) throw new AuthError('invalid_credentials');
    requirePassword(input.newPassword);
    const passwordHash = await hashPassword(input.newPassword);
    const now = this.now();
    await this.repos.transaction(async (repos) => {
      await repos.users.setPasswordHash(user.id, passwordHash, now);
      await repos.sessions.revokeOthersForUser(user.id, sessionId, now);
      await repos.resetTokens.invalidateAllForUser(user.id, now);
    });
  }
}
