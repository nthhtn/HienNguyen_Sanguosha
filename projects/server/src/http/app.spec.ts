import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { AccountService } from '../auth/accounts';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { RoomService } from '../rooms/roomService';
import { AppDeps, buildApp } from './app';

const ORIGIN = 'http://localhost:4200';
const SIGN_UP = { email: 'ann@example.com', password: 'secret-pass', displayName: 'Ann' };

async function setup(overrides: Partial<AppDeps> = {}) {
  const mailer = new RecordingMailer();
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer, publicOrigin: ORIGIN });
  const rooms = new RoomService({ repos, seatLimits: { min: 2, max: 6 } });
  const app = await buildApp({ accounts, rooms, publicOrigin: ORIGIN, cookieSecure: false, ...overrides });
  return { app, mailer };
}

const post = (app: FastifyInstance, url: string, payload: object, token?: string) =>
  app.inject({ method: 'POST', url, payload, headers: { origin: ORIGIN }, cookies: token ? { sgs_session: token } : {} });
const getMe = (app: FastifyInstance, token?: string) => app.inject({ method: 'GET', url: '/api/me', cookies: token ? { sgs_session: token } : {} });
const sessionCookies = (res: LightMyRequestResponse) => res.cookies.filter((c) => c.name === 'sgs_session');
const sessionToken = (res: LightMyRequestResponse) => sessionCookies(res)[0]?.value;

describe('HTTP app', () => {
  let app: FastifyInstance;
  afterEach(async () => {
    await app?.close();
  });

  describe('sign up, me, sign out', () => {
    it('signs up, sets an HttpOnly Lax session cookie, and /api/me returns the user', async () => {
      ({ app } = await setup());
      const res = await post(app, '/api/auth/signup', SIGN_UP);
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ id: expect.any(String), kind: 'registered', displayName: 'Ann', email: 'ann@example.com' });
      const [cookie] = sessionCookies(res);
      expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
      expect(cookie.secure).toBeFalsy();

      const me = await getMe(app, cookie.value);
      expect(me.statusCode).toBe(200);
      expect(me.json()).toEqual(res.json());
    });

    it('marks the cookie Secure when configured', async () => {
      ({ app } = await setup({ cookieSecure: true }));
      const res = await post(app, '/api/auth/signup', SIGN_UP);
      expect(sessionCookies(res)[0].secure).toBe(true);
    });

    it('answers 401 not_signed_in without a cookie', async () => {
      ({ app } = await setup());
      const res = await getMe(app);
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'not_signed_in', message: 'Please sign in first' });
    });

    it('answers 401 and clears a garbage or revoked cookie instead of failing', async () => {
      ({ app } = await setup());
      const garbage = await getMe(app, 'garbage');
      expect(garbage.statusCode).toBe(401);
      expect(sessionCookies(garbage)[0].value).toBe('');

      const token = sessionToken(await post(app, '/api/auth/signup', SIGN_UP));
      const out = await post(app, '/api/auth/signout', {}, token);
      expect(out.statusCode).toBe(204);
      expect(sessionCookies(out)[0].value).toBe('');
      expect((await getMe(app, token)).statusCode).toBe(401);
    });

    it('sign out without a session still answers 204', async () => {
      ({ app } = await setup());
      expect((await post(app, '/api/auth/signout', {})).statusCode).toBe(204);
    });

    it('creates a guest whose Me has no email', async () => {
      ({ app } = await setup());
      const res = await post(app, '/api/auth/guest', { displayName: ' Zhou Yu ' });
      expect(res.statusCode).toBe(201);
      expect(res.json()).toEqual({ id: expect.any(String), kind: 'guest', displayName: 'Zhou Yu' });
    });
  });

  describe('errors', () => {
    it('sign-in failure says "Email or password is incorrect"', async () => {
      ({ app } = await setup());
      await post(app, '/api/auth/signup', SIGN_UP);
      const res = await post(app, '/api/auth/signin', { email: 'ann@example.com', password: 'wrong-pass' });
      expect(res.statusCode).toBe(401);
      expect(res.json()).toEqual({ code: 'invalid_credentials', message: 'Email or password is incorrect' });
    });

    it('a taken email is 409 email_taken', async () => {
      ({ app } = await setup());
      await post(app, '/api/auth/signup', SIGN_UP);
      const res = await post(app, '/api/auth/signup', { ...SIGN_UP, email: 'ANN@example.com' });
      expect(res.statusCode).toBe(409);
      expect(res.json().code).toBe('email_taken');
    });

    it('a short password is 400 weak_password and a blank name 400 invalid_name', async () => {
      ({ app } = await setup());
      expect((await post(app, '/api/auth/signup', { ...SIGN_UP, password: 'short' })).json().code).toBe('weak_password');
      expect((await post(app, '/api/auth/guest', { displayName: '   ' })).json().code).toBe('invalid_name');
    });

    it('a malformed body is 400 invalid_body', async () => {
      ({ app } = await setup());
      const res = await post(app, '/api/auth/signup', { email: 'ann@example.com' });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ code: 'invalid_body', message: 'Some fields are missing or invalid' });
    });

    it('refuses a non-GET request without the public Origin', async () => {
      ({ app } = await setup());
      const missing = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: { displayName: 'X' } });
      expect(missing.statusCode).toBe(403);
      expect(missing.json().code).toBe('bad_origin');
      const wrong = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: { displayName: 'X' }, headers: { origin: 'https://evil.example' } });
      expect(wrong.statusCode).toBe(403);
    });

    it('refuses a non-JSON body with 415', async () => {
      ({ app } = await setup());
      const res = await app.inject({ method: 'POST', url: '/api/auth/guest', payload: 'displayName=X', headers: { origin: ORIGIN, 'content-type': 'application/x-www-form-urlencoded' } });
      expect(res.statusCode).toBe(415);
      expect(res.json().code).toBe('unsupported_media_type');
    });

    it('an unknown route is 404 not_found', async () => {
      ({ app } = await setup());
      const res = await app.inject({ method: 'GET', url: '/api/nope' });
      expect(res.statusCode).toBe(404);
      expect(res.json().code).toBe('not_found');
    });
  });

  describe('switching sessions', () => {
    it('signing in while signed in as a guest revokes the guest session and sends one cookie', async () => {
      ({ app } = await setup());
      await post(app, '/api/auth/signup', SIGN_UP);
      const guestToken = sessionToken(await post(app, '/api/auth/guest', { displayName: 'Guest' }));

      const res = await post(app, '/api/auth/signin', { email: 'ann@example.com', password: 'secret-pass' }, guestToken);

      expect(res.statusCode).toBe(200);
      expect(sessionCookies(res)).toHaveLength(1);
      expect(sessionToken(res)).not.toBe(guestToken);
      expect((await getMe(app, guestToken)).statusCode).toBe(401);
      expect((await getMe(app, sessionToken(res))).json().kind).toBe('registered');
    });
  });

  describe('password reset', () => {
    it('answers the same for a known and an unknown email, and mails only the known one', async () => {
      let mailer: RecordingMailer;
      ({ app, mailer } = await setup());
      await post(app, '/api/auth/signup', SIGN_UP);
      const known = await post(app, '/api/auth/forgot-password', { email: 'ann@example.com' });
      const unknown = await post(app, '/api/auth/forgot-password', { email: 'nobody@example.com' });
      expect(known.statusCode).toBe(200);
      expect(known.json()).toEqual({ message: 'If that email has an account, we sent a link' });
      expect(unknown.json()).toEqual(known.json());
      expect(mailer.sent).toHaveLength(1);
    });

    it('resets from the emailed link: new cookie works, the old one does not', async () => {
      let mailer: RecordingMailer;
      ({ app, mailer } = await setup());
      const oldToken = sessionToken(await post(app, '/api/auth/signup', SIGN_UP));
      await post(app, '/api/auth/forgot-password', { email: 'ann@example.com' });
      const token = new URL(mailer.sent[0].link).searchParams.get('token')!;

      const res = await post(app, '/api/auth/reset-password', { token, password: 'brand-new-pass' });

      expect(res.statusCode).toBe(200);
      expect((await getMe(app, sessionToken(res))).statusCode).toBe(200);
      expect((await getMe(app, oldToken)).statusCode).toBe(401);
      const again = await post(app, '/api/auth/reset-password', { token, password: 'another-pass' });
      expect(again.statusCode).toBe(400);
      expect(again.json()).toEqual({ code: 'invalid_reset_token', message: 'This reset link is invalid or has expired' });
    });
  });

  describe('rate limits', () => {
    it('refuses sign-in attempts over the per-email limit with 429', async () => {
      ({ app } = await setup({ rateLimits: new AuthRateLimits({ ...RATE_LIMITS, signInPerEmail: { limit: 2, windowMs: 60_000 } }) }));
      const attempt = () => post(app, '/api/auth/signin', { email: 'Ann@example.com ', password: 'wrong-pass' });
      expect((await attempt()).statusCode).toBe(401);
      expect((await attempt()).statusCode).toBe(401);
      const third = await attempt();
      expect(third.statusCode).toBe(429);
      expect(third.json()).toEqual({ code: 'rate_limited', message: 'Too many attempts. Wait a few minutes and try again' });
    });

    it('guest creation shares the sign-up budget per IP', async () => {
      ({ app } = await setup({ rateLimits: new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1, windowMs: 60_000 } }) }));
      expect((await post(app, '/api/auth/guest', { displayName: 'A' })).statusCode).toBe(201);
      expect((await post(app, '/api/auth/signup', SIGN_UP)).statusCode).toBe(429);
    });

    it('behind one trusted proxy, a spoofed X-Forwarded-For entry does not dodge the per-IP limit', async () => {
      ({ app } = await setup({ trustProxy: 1, rateLimits: new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1, windowMs: 60_000 } }) }));
      const guest = (forwardedFor: string) =>
        app.inject({ method: 'POST', url: '/api/auth/guest', payload: { displayName: 'A' }, headers: { origin: ORIGIN, 'x-forwarded-for': forwardedFor } });
      expect((await guest('spoofed-a, 10.0.0.9')).statusCode).toBe(201);
      expect((await guest('spoofed-b, 10.0.0.9')).statusCode).toBe(429);
    });

    it('behind one trusted proxy, clients with different real IPs have separate budgets', async () => {
      ({ app } = await setup({ trustProxy: 1, rateLimits: new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1, windowMs: 60_000 } }) }));
      const guest = (forwardedFor: string) =>
        app.inject({ method: 'POST', url: '/api/auth/guest', payload: { displayName: 'A' }, headers: { origin: ORIGIN, 'x-forwarded-for': forwardedFor } });
      expect((await guest('10.0.0.9')).statusCode).toBe(201);
      expect((await guest('10.0.0.10')).statusCode).toBe(201);
    });

    it('limits reset-password per IP before it hashes anything', async () => {
      ({ app } = await setup({ rateLimits: new AuthRateLimits({ ...RATE_LIMITS, resetPerIp: { limit: 1, windowMs: 60_000 } }) }));
      const attempt = () => post(app, '/api/auth/reset-password', { token: 'junk', password: 'brand-new-pass' });
      const first = await attempt();
      expect(first.statusCode).toBe(400);
      expect(first.json().code).toBe('invalid_reset_token');
      const second = await attempt();
      expect(second.statusCode).toBe(429);
      expect(second.json()).toEqual({ code: 'rate_limited', message: 'Too many attempts. Wait a few minutes and try again' });
    });

    it('limits forgot-password per email', async () => {
      ({ app } = await setup({ rateLimits: new AuthRateLimits({ ...RATE_LIMITS, forgotPerEmail: { limit: 1, windowMs: 60_000 } }) }));
      expect((await post(app, '/api/auth/forgot-password', { email: 'a@example.com' })).statusCode).toBe(200);
      expect((await post(app, '/api/auth/forgot-password', { email: 'A@example.com' })).statusCode).toBe(429);
    });
  });
});
