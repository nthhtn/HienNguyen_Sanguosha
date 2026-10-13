import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { AccountService, AuthError } from './accounts';

const ORIGIN = 'http://localhost:4200';
const DAY = 24 * 60 * 60_000;

function setup() {
  let now = new Date('2026-10-13T12:00:00.000Z');
  const repos = createMemoryRepositories();
  const mailer = new RecordingMailer();
  const accounts = new AccountService({ repos, mailer, publicOrigin: ORIGIN, now: () => now });
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };
  return { accounts, mailer, repos, advance };
}

const authCode = (promise: Promise<unknown>) =>
  promise.then(
    () => 'resolved',
    (err: unknown) => (err instanceof AuthError ? err.code : String(err))
  );

const resetTokenFrom = (link: string) => new URL(link).searchParams.get('token')!;

describe('AccountService', () => {
  describe('sign up and sign in', () => {
    it('signs up a registered user with a trimmed email and normalized name, and signs them in', async () => {
      const { accounts } = setup();
      const result = await accounts.signUp({ email: '  Ann@Example.com ', password: 'secret-pass', displayName: '  Ann   Lee ' });
      expect(result.user).toMatchObject({ kind: 'registered', email: 'Ann@Example.com', displayName: 'Ann Lee' });
      expect(result.user.passwordHash).toMatch(/^scrypt\$/);
      expect((await accounts.authenticate(result.token))?.user.id).toBe(result.user.id);
    });

    it('refuses a second account for the same email in another case', async () => {
      const { accounts } = setup();
      await accounts.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
      expect(await authCode(accounts.signUp({ email: 'ANN@example.com', password: 'secret-pass', displayName: 'Ann' }))).toBe('email_taken');
    });

    it('refuses a blank name and a short password', async () => {
      const { accounts } = setup();
      expect(await authCode(accounts.signUp({ email: 'a@example.com', password: 'secret-pass', displayName: '   ' }))).toBe('invalid_name');
      expect(await authCode(accounts.signUp({ email: 'a@example.com', password: 'short', displayName: 'Ann' }))).toBe('weak_password');
    });

    it('signs in with any casing and surrounding spaces in the email', async () => {
      const { accounts } = setup();
      const { user } = await accounts.signUp({ email: 'Ann@Example.com', password: 'secret-pass', displayName: 'Ann' });
      const result = await accounts.signIn({ email: ' ann@example.COM ', password: 'secret-pass' });
      expect(result.user.id).toBe(user.id);
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const { accounts } = setup();
      await accounts.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
      expect(await authCode(accounts.signIn({ email: 'ann@example.com', password: 'wrong-pass' }))).toBe('invalid_credentials');
      expect(await authCode(accounts.signIn({ email: 'nobody@example.com', password: 'secret-pass' }))).toBe('invalid_credentials');
    });
  });

  describe('guests', () => {
    it('creates a guest with a session', async () => {
      const { accounts } = setup();
      const result = await accounts.createGuest({ displayName: ' Zhou  Yu ' });
      expect(result.user).toMatchObject({ kind: 'guest', email: null, displayName: 'Zhou Yu' });
      expect(await accounts.authenticate(result.token)).not.toBeNull();
    });

    it('refuses a blank guest name', async () => {
      const { accounts } = setup();
      expect(await authCode(accounts.createGuest({ displayName: '' }))).toBe('invalid_name');
    });

    it('purges guests idle for more than 7 days, and keeps registered users', async () => {
      const { accounts, repos, advance } = setup();
      const guest = await accounts.createGuest({ displayName: 'Guest' });
      const ann = await accounts.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
      advance(8 * DAY);
      expect(await accounts.purgeIdleGuests()).toBe(1);
      expect(await repos.users.findById(guest.user.id)).toBeNull();
      expect(await repos.users.findById(ann.user.id)).not.toBeNull();
    });
  });

  describe('sessions', () => {
    it('slides a registered session: active use keeps it alive past 30 days', async () => {
      const { accounts, advance } = setup();
      const { token } = await accounts.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
      advance(29 * DAY);
      expect(await accounts.authenticate(token)).not.toBeNull();
      advance(29 * DAY);
      const auth = await accounts.authenticate(token);
      expect(auth?.session.expiresAt.getTime()).toBe(Date.parse('2026-10-13T12:00:00.000Z') + 88 * DAY);
    });

    it('expires a registered session after 30 idle days', async () => {
      const { accounts, advance } = setup();
      const { token } = await accounts.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
      advance(30 * DAY);
      expect(await accounts.authenticate(token)).toBeNull();
    });

    it('expires a guest session after 7 idle days', async () => {
      const { accounts, advance } = setup();
      const { token, expiresAt } = await accounts.createGuest({ displayName: 'Guest' });
      expect(expiresAt.getTime()).toBe(Date.parse('2026-10-13T12:00:00.000Z') + 7 * DAY);
      advance(7 * DAY);
      expect(await accounts.authenticate(token)).toBeNull();
    });

    it("authenticate moves the user's last_seen_at", async () => {
      const { accounts, repos, advance } = setup();
      const { token, user } = await accounts.createGuest({ displayName: 'Guest' });
      advance(DAY);
      await accounts.authenticate(token);
      expect((await repos.users.findById(user.id))?.lastSeenAt.getTime()).toBe(Date.parse('2026-10-13T12:00:00.000Z') + DAY);
    });

    it('signs out', async () => {
      const { accounts } = setup();
      const { token } = await accounts.createGuest({ displayName: 'Guest' });
      await accounts.signOut(token);
      expect(await accounts.authenticate(token)).toBeNull();
    });

    it('treats an unknown token as signed out', async () => {
      const { accounts } = setup();
      expect(await accounts.authenticate('not-a-token')).toBeNull();
      await expect(accounts.signOut('not-a-token')).resolves.toBeUndefined();
    });
  });

  describe('password reset', () => {
    async function signedUp() {
      const ctx = setup();
      const ann = await ctx.accounts.signUp({ email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' });
      return { ...ctx, ann };
    }

    it('emails a single reset link to a registered user', async () => {
      const { accounts, mailer } = await signedUp();
      await accounts.forgotPassword(' ANN@example.com ');
      expect(mailer.sent).toHaveLength(1);
      expect(mailer.sent[0]).toMatchObject({ to: 'ann@example.com', displayName: 'Ann' });
      expect(mailer.sent[0].link).toMatch(new RegExp(`^${ORIGIN}/reset-password\\?token=[\\w-]{43}$`));
    });

    it('sends nothing for an unknown email', async () => {
      const { accounts, mailer } = await signedUp();
      await accounts.forgotPassword('nobody@example.com');
      expect(mailer.sent).toHaveLength(0);
    });

    it('sets the new password, revokes every old session and signs in a new one', async () => {
      const { accounts, mailer, ann } = await signedUp();
      const otherDevice = await accounts.signIn({ email: 'ann@example.com', password: 'secret-pass' });
      await accounts.forgotPassword('ann@example.com');

      const result = await accounts.resetPassword({ token: resetTokenFrom(mailer.sent[0].link), password: 'brand-new-pass' });

      expect(result.user.id).toBe(ann.user.id);
      expect(await accounts.authenticate(result.token)).not.toBeNull();
      expect(await accounts.authenticate(ann.token)).toBeNull();
      expect(await accounts.authenticate(otherDevice.token)).toBeNull();
      expect(await authCode(accounts.signIn({ email: 'ann@example.com', password: 'secret-pass' }))).toBe('invalid_credentials');
      expect((await accounts.signIn({ email: 'ann@example.com', password: 'brand-new-pass' })).user.id).toBe(ann.user.id);
    });

    it('refuses a link used twice', async () => {
      const { accounts, mailer } = await signedUp();
      await accounts.forgotPassword('ann@example.com');
      const token = resetTokenFrom(mailer.sent[0].link);
      await accounts.resetPassword({ token, password: 'brand-new-pass' });
      expect(await authCode(accounts.resetPassword({ token, password: 'another-pass' }))).toBe('invalid_reset_token');
    });

    it('refuses a link older than 1 hour', async () => {
      const { accounts, mailer, advance } = await signedUp();
      await accounts.forgotPassword('ann@example.com');
      advance(60 * 60_000);
      expect(await authCode(accounts.resetPassword({ token: resetTokenFrom(mailer.sent[0].link), password: 'brand-new-pass' }))).toBe('invalid_reset_token');
    });

    it('refuses an unknown token', async () => {
      const { accounts } = await signedUp();
      expect(await authCode(accounts.resetPassword({ token: 'nope', password: 'brand-new-pass' }))).toBe('invalid_reset_token');
    });

    it('a weak new password does not use up the link', async () => {
      const { accounts, mailer } = await signedUp();
      await accounts.forgotPassword('ann@example.com');
      const token = resetTokenFrom(mailer.sent[0].link);
      expect(await authCode(accounts.resetPassword({ token, password: 'short' }))).toBe('weak_password');
      expect(await authCode(accounts.resetPassword({ token, password: 'brand-new-pass' }))).toBe('resolved');
    });
  });
});
