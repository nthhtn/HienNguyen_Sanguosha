import { ErrorCode, normalizeDisplayName, PASSWORD_MIN } from 'protocol';
import { Mailer } from '../mail/mailer';
import { SessionRecord, UserRecord } from '../persistence/records';
import { EmailTakenError, Repositories } from '../persistence/repositories';
import { hashPassword, verifyPassword } from './password';
import { hashToken, newToken } from './tokens';

const DAY_MS = 24 * 60 * 60_000;
// Sliding: each authenticated request pushes expiry this far out again.
export const SESSION_DAYS = { registered: 30, guest: 7 } as const;
export const RESET_TOKEN_MS = 60 * 60_000;
export const GUEST_IDLE_DAYS = 7;
// Expired or revoked sessions, and expired reset tokens, are kept this long
// before housekeeping deletes them.
export const PURGE_AFTER_DAYS = 30;

export type AuthErrorCode = Extract<ErrorCode, 'email_taken' | 'invalid_credentials' | 'invalid_reset_token' | 'invalid_name' | 'weak_password'>;

export class AuthError extends Error {
  constructor(readonly code: AuthErrorCode) {
    super(code);
    this.name = 'AuthError';
  }
}

// A new session: the caller sets `token` as the cookie; only its hash is stored.
export interface SignedIn {
  user: UserRecord;
  token: string;
  expiresAt: Date;
}

export interface Authenticated {
  user: UserRecord;
  session: SessionRecord;
}

export interface AccountServiceDeps {
  repos: Repositories;
  mailer: Mailer;
  publicOrigin: string;
  now?: () => Date;
}

// Hashed once, then compared against when the email is unknown, so a failed
// sign-in takes as long whether or not the account exists.
let dummyHash: Promise<string> | undefined;
const dummy = () => (dummyHash ??= hashPassword('no-such-account-password'));

export class AccountService {
  private readonly repos: Repositories;
  private readonly mailer: Mailer;
  private readonly publicOrigin: string;
  private readonly now: () => Date;

  constructor(deps: AccountServiceDeps) {
    this.repos = deps.repos;
    this.mailer = deps.mailer;
    this.publicOrigin = deps.publicOrigin;
    this.now = deps.now ?? (() => new Date());
  }

  async signUp(input: { email: string; password: string; displayName: string }): Promise<SignedIn> {
    const displayName = requireName(input.displayName);
    requirePassword(input.password);
    const passwordHash = await hashPassword(input.password);
    const now = this.now();
    try {
      const user = await this.repos.users.createRegistered({ email: input.email.trim(), passwordHash, displayName, now });
      return await this.startSession(user, now);
    } catch (err) {
      if (err instanceof EmailTakenError) throw new AuthError('email_taken');
      throw err;
    }
  }

  async signIn(input: { email: string; password: string }): Promise<SignedIn> {
    const user = await this.repos.users.findByEmail(input.email.trim());
    const matches = await verifyPassword(input.password, user?.passwordHash ?? (await dummy()));
    if (!user || user.kind !== 'registered' || !matches) throw new AuthError('invalid_credentials');
    return this.startSession(user, this.now());
  }

  async createGuest(input: { displayName: string }): Promise<SignedIn> {
    const displayName = requireName(input.displayName);
    const now = this.now();
    const user = await this.repos.users.createGuest({ displayName, now });
    return this.startSession(user, now);
  }

  // The user behind a session cookie, sliding the session; null when the token
  // is unknown, revoked or expired.
  async authenticate(token: string): Promise<Authenticated | null> {
    const now = this.now();
    const session = await this.repos.sessions.findActiveByTokenHash(hashToken(token), now);
    if (!session) return null;
    const user = await this.repos.users.findById(session.userId);
    if (!user) return null;
    const expiresAt = sessionExpiry(user, now);
    await this.repos.sessions.slide(session.id, now, expiresAt);
    await this.repos.users.touch(user.id, now);
    return { user: { ...user, lastSeenAt: now }, session: { ...session, lastSeenAt: now, expiresAt } };
  }

  async signOut(token: string): Promise<void> {
    const now = this.now();
    const session = await this.repos.sessions.findActiveByTokenHash(hashToken(token), now);
    if (session) await this.repos.sessions.revoke(session.id, now);
  }

  // Emails a reset link to a registered user. Silent otherwise: the caller
  // always answers the same way, so this never reveals whether an email exists.
  async forgotPassword(email: string): Promise<void> {
    const user = await this.repos.users.findByEmail(email.trim());
    if (!user || user.kind !== 'registered' || !user.email) return;
    const now = this.now();
    const token = newToken();
    await this.repos.resetTokens.create({ userId: user.id, tokenHash: hashToken(token), now, expiresAt: new Date(now.getTime() + RESET_TOKEN_MS) });
    await this.mailer.sendPasswordReset({
      to: user.email,
      displayName: user.displayName,
      link: `${this.publicOrigin}/reset-password?token=${encodeURIComponent(token)}`,
    });
  }

  async resetPassword(input: { token: string; password: string }): Promise<SignedIn> {
    // Checked before the token is consumed, so a weak password doesn't burn the link.
    requirePassword(input.password);
    // Hashed outside the transaction: it's slow, and would hold it open.
    const passwordHash = await hashPassword(input.password);
    const now = this.now();
    // All or nothing: if any write fails, the link still works and the old
    // password and sessions (possibly an attacker's) are untouched for a retry.
    return this.repos.transaction(async (repos) => {
      const record = await repos.resetTokens.consume(hashToken(input.token), now);
      if (!record) throw new AuthError('invalid_reset_token');
      const user = await repos.users.findById(record.userId);
      if (!user) throw new AuthError('invalid_reset_token');
      await repos.users.setPasswordHash(user.id, passwordHash, now);
      await repos.sessions.revokeAllForUser(user.id, now);
      await repos.resetTokens.invalidateAllForUser(user.id, now);
      return startSession(repos, { ...user, passwordHash, updatedAt: now }, now);
    });
  }

  purgeIdleGuests(): Promise<number> {
    return this.repos.users.deleteIdleGuests(new Date(this.now().getTime() - GUEST_IDLE_DAYS * DAY_MS));
  }

  async purgeExpired(): Promise<void> {
    const cutoff = new Date(this.now().getTime() - PURGE_AFTER_DAYS * DAY_MS);
    await this.repos.sessions.deleteExpired(cutoff);
    await this.repos.resetTokens.deleteExpired(cutoff);
  }

  private startSession(user: UserRecord, now: Date): Promise<SignedIn> {
    return startSession(this.repos, user, now);
  }
}

async function startSession(repos: Repositories, user: UserRecord, now: Date): Promise<SignedIn> {
  const token = newToken();
  const expiresAt = sessionExpiry(user, now);
  await repos.sessions.create({ userId: user.id, tokenHash: hashToken(token), now, expiresAt });
  return { user, token, expiresAt };
}

function sessionExpiry(user: UserRecord, now: Date): Date {
  return new Date(now.getTime() + SESSION_DAYS[user.kind] * DAY_MS);
}

function requireName(raw: string): string {
  const name = normalizeDisplayName(raw);
  if (name === null) throw new AuthError('invalid_name');
  return name;
}

function requirePassword(password: string): void {
  if (password.length < PASSWORD_MIN) throw new AuthError('weak_password');
}
