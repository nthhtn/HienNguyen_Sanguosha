import { randomUUID } from 'node:crypto';
import { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { AccountService } from '../auth/accounts';
import { GoogleAuthError, GoogleClaims, GoogleClient } from '../auth/google';
import { AuthRateLimits, RATE_LIMITS } from '../auth/rateLimits';
import { GameHistory } from '../game/history';
import { RecordingMailer } from '../mail/recordingMailer';
import { createMemoryRepositories } from '../persistence/memory/memoryRepositories';
import { ProfileService } from '../profile/profileService';
import { RoomService } from '../rooms/roomService';
import { buildApp } from './app';
import { safeReturnPath } from './googleRoutes';

const ORIGIN = 'http://localhost:4200';
const CLAIMS: GoogleClaims = { sub: 'google-sub-1', email: 'gail@example.com', emailVerified: true, name: 'Gail Lee' };

async function setup(options: { google?: GoogleClient | null; rateLimits?: AuthRateLimits } = {}) {
  const repos = createMemoryRepositories();
  const accounts = new AccountService({ repos, mailer: new RecordingMailer(), publicOrigin: ORIGIN });
  const exchange = jest.fn<ReturnType<GoogleClient['exchange']>, Parameters<GoogleClient['exchange']>>(async () => CLAIMS);
  const google: GoogleClient | null =
    options.google === undefined ? { authorizeUrl: ({ state, nonce, codeChallenge }) => `https://google.test/auth?state=${state}&nonce=${nonce}&cc=${codeChallenge}`, exchange } : options.google;
  const rateLimits = options.rateLimits ?? new AuthRateLimits({ ...RATE_LIMITS, signUpPerIp: { limit: 1000, windowMs: 60_000 } });
  const app = await buildApp({ accounts, rooms: new RoomService({ repos, seatLimits: { min: 2, max: 6 } }), history: new GameHistory(repos), profile: new ProfileService({ repos }), google, publicOrigin: ORIGIN, cookieSecure: false, rateLimits });
  return { app, repos, exchange };
}

const cookie = (res: LightMyRequestResponse, name: string) => res.cookies.find((c) => c.name === name);
const get = (app: FastifyInstance, url: string, cookies: Record<string, string> = {}) => app.inject({ method: 'GET', url, cookies });
const location = (res: LightMyRequestResponse) => new URL(res.headers.location as string, ORIGIN);
const signUp = async (app: FastifyInstance, email: string) => {
  const res = await app.inject({ method: 'POST', url: '/api/auth/signup', payload: { email, password: 'secret-pass', displayName: 'Ann' }, headers: { origin: ORIGIN } });
  return cookie(res, 'sgs_session')!.value;
};

// Starts the flow and returns what Google would send back, and the cookie the browser keeps.
async function begin(app: FastifyInstance, returnUrl?: string) {
  const res = await get(app, `/api/auth/google/start${returnUrl === undefined ? '' : `?returnUrl=${encodeURIComponent(returnUrl)}`}`);
  const url = new URL(res.headers.location as string);
  return { res, state: url.searchParams.get('state')!, nonce: url.searchParams.get('nonce')!, oauth: cookie(res, 'sgs_oauth')?.value ?? '' };
}
const callback = (app: FastifyInstance, query: string, cookies: Record<string, string> = {}) => get(app, `/api/auth/google/callback?${query}`, cookies);
const oauthPayload = (value: string) => JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as { state: string; nonce: string; verifier: string; returnUrl: string };

describe('safeReturnPath', () => {
  it.each(['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '', '   ', 'rooms', '/ok\\path', '/a\nb'])('turns %j into /', (raw) => {
    expect(safeReturnPath(raw)).toBe('/');
  });

  it('turns a value that is not a string into /', () => {
    expect(safeReturnPath(undefined)).toBe('/');
    expect(safeReturnPath(['/rooms'])).toBe('/');
  });

  it('keeps a path inside the site', () => {
    expect(safeReturnPath('/rooms?x=1')).toBe('/rooms?x=1');
    expect(safeReturnPath('/profile?tab=history')).toBe('/profile?tab=history');
  });
});

describe('GET /api/auth/providers', () => {
  it('says Google is on only when a client is configured', async () => {
    expect((await get((await setup()).app, '/api/auth/providers')).json()).toEqual({ google: true });
    expect((await get((await setup({ google: null })).app, '/api/auth/providers')).json()).toEqual({ google: false });
  });
});

describe('Google sign-in when it is not configured', () => {
  it('answers 404 on start and callback', async () => {
    const { app } = await setup({ google: null });
    expect((await get(app, '/api/auth/google/start')).statusCode).toBe(404);
    expect((await callback(app, 'code=c&state=s')).statusCode).toBe(404);
  });
});

describe('GET /api/auth/google/start', () => {
  it('redirects to Google with a state and a challenge, and keeps the flow in an HttpOnly sgs_oauth cookie', async () => {
    const { app } = await setup();
    const { res, state, oauth } = await begin(app, '/rooms');
    expect(res.statusCode).toBe(302);
    expect(new URL(res.headers.location as string).origin).toBe('https://google.test');
    const stored = oauthPayload(oauth);
    expect(stored).toMatchObject({ state, returnUrl: '/rooms' });
    expect(stored.verifier.length).toBeGreaterThanOrEqual(43);
    expect(cookie(res, 'sgs_oauth')).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/api/auth/google' });
    expect(new URL(res.headers.location as string).searchParams.get('cc')).not.toBe(stored.verifier);
  });

  it('keeps / when the return URL is not a path inside the site', async () => {
    const { app } = await setup();
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example']) {
      expect(oauthPayload((await begin(app, bad)).oauth).returnUrl).toBe('/');
    }
    expect(oauthPayload((await begin(app)).oauth).returnUrl).toBe('/');
  });
});

describe('GET /api/auth/google/callback', () => {
  it('signs in a new Google user, sets the session cookie, clears sgs_oauth and goes to the return URL', async () => {
    const { app, repos, exchange } = await setup();
    const { state, nonce, oauth } = await begin(app, '/profile?tab=history');
    const res = await callback(app, `code=the-code&state=${state}`, { sgs_oauth: oauth });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toBe('/profile?tab=history');
    expect(exchange).toHaveBeenCalledWith({ code: 'the-code', codeVerifier: oauthPayload(oauth).verifier, nonce });
    const me = await get(app, '/api/me', { sgs_session: cookie(res, 'sgs_session')!.value });
    expect(me.json()).toMatchObject({ kind: 'registered', displayName: 'Gail Lee', email: 'gail@example.com', hasPassword: false });
    expect(cookie(res, 'sgs_oauth')?.value ?? '').toBe('');
    expect((await repos.identities.findByProviderUser('google', CLAIMS.sub))?.userId).toBe(me.json().id);
  });

  it('goes to / when the flow had no return URL', async () => {
    const { app } = await setup();
    const { state, oauth } = await begin(app);
    expect((await callback(app, `code=c&state=${state}`, { sgs_oauth: oauth })).headers.location).toBe('/');
  });

  it.each([
    ['the cookie is missing', (b: { state: string; oauth: string }) => ({ query: `code=c&state=${b.state}`, cookies: {} })],
    ['the state is different', (b: { state: string; oauth: string }) => ({ query: 'code=c&state=wrong', cookies: { sgs_oauth: b.oauth } })],
    ['the state is missing', (b: { state: string; oauth: string }) => ({ query: 'code=c', cookies: { sgs_oauth: b.oauth } })],
    ['the code is missing', (b: { state: string; oauth: string }) => ({ query: `state=${b.state}`, cookies: { sgs_oauth: b.oauth } })],
    ['the cookie is garbage', (b: { state: string; oauth: string }) => ({ query: `code=c&state=${b.state}`, cookies: { sgs_oauth: 'not-base64-json!' } })],
  ])('refuses with google_failed and creates no user, identity or session when %s', async (_name, build) => {
    const { app, repos, exchange } = await setup();
    const started = await begin(app, '/rooms');
    const { query, cookies } = build(started);
    const res = await callback(app, query, cookies);
    expect(res.statusCode).toBe(302);
    expect(location(res).pathname).toBe('/sign-in');
    expect(location(res).searchParams.get('error')).toBe('google_failed');
    expect(exchange).not.toHaveBeenCalled();
    expect(cookie(res, 'sgs_session')).toBeUndefined();
    expect(await repos.users.findByEmail(CLAIMS.email)).toBeNull();
    expect(await repos.identities.findByProviderUser('google', CLAIMS.sub)).toBeNull();
  });

  it('refuses with google_cancelled when Google sent access_denied, and keeps the return URL', async () => {
    const { app } = await setup();
    const { state, oauth } = await begin(app, '/rooms');
    const res = await callback(app, `error=access_denied&state=${state}`, { sgs_oauth: oauth });
    expect(location(res).searchParams.get('error')).toBe('google_cancelled');
    expect(location(res).searchParams.get('returnUrl')).toBe('/rooms');
  });

  it('refuses with google_failed for any other error from Google', async () => {
    const { app } = await setup();
    const { state, oauth } = await begin(app);
    expect(location(await callback(app, `error=server_error&state=${state}`, { sgs_oauth: oauth })).searchParams.get('error')).toBe('google_failed');
  });

  it('refuses with the client\'s own code, google_unverified, and with google_failed for any other failure', async () => {
    const { app, exchange } = await setup();
    const first = await begin(app);
    exchange.mockRejectedValueOnce(new GoogleAuthError('google_unverified'));
    expect(location(await callback(app, `code=c&state=${first.state}`, { sgs_oauth: first.oauth })).searchParams.get('error')).toBe('google_unverified');
    const second = await begin(app);
    exchange.mockRejectedValueOnce(new Error('boom'));
    expect(location(await callback(app, `code=c&state=${second.state}`, { sgs_oauth: second.oauth })).searchParams.get('error')).toBe('google_failed');
  });

  it('refuses with google_email_in_use for a password account, creating nothing and leaving the old session working', async () => {
    const { app, repos, exchange } = await setup();
    const session = await signUp(app, 'gail@example.com');
    const { state, oauth } = await begin(app, '/rooms');
    const res = await callback(app, `code=c&state=${state}`, { sgs_oauth: oauth, sgs_session: session });
    expect(exchange).toHaveBeenCalled();
    expect(location(res).pathname).toBe('/sign-in');
    expect(location(res).searchParams.get('error')).toBe('google_email_in_use');
    expect(location(res).searchParams.get('returnUrl')).toBe('/rooms');
    expect(await repos.identities.findByProviderUser('google', CLAIMS.sub)).toBeNull();
    expect(cookie(res, 'sgs_session')?.value).toBe(session);
    expect((await get(app, '/api/me', { sgs_session: session })).statusCode).toBe(200);
  });

  it('replaces a session the browser already had', async () => {
    const { app } = await setup();
    const old = await signUp(app, 'ann@example.com');
    const { state, oauth } = await begin(app);
    const res = await callback(app, `code=c&state=${state}`, { sgs_oauth: oauth, sgs_session: old });
    expect((await get(app, '/api/me', { sgs_session: old })).statusCode).toBe(401);
    expect((await get(app, '/api/me', { sgs_session: cookie(res, 'sgs_session')!.value })).statusCode).toBe(200);
  });

  it('never puts the client secret or the code verifier in a redirect it sends back to the browser', async () => {
    const { app } = await setup();
    const { state, oauth } = await begin(app);
    const res = await callback(app, `code=c&state=${state}`, { sgs_oauth: oauth });
    expect(String(res.headers.location)).not.toContain(oauthPayload(oauth).verifier);
  });
});

describe('the Google routes and the rate limit', () => {
  it('answers 429 once an IP has used its budget on start and callback together', async () => {
    const limits = new AuthRateLimits({ ...RATE_LIMITS, googlePerIp: { limit: 2, windowMs: 60_000 } });
    const { app } = await setup({ rateLimits: limits });
    expect((await get(app, '/api/auth/google/start')).statusCode).toBe(302);
    expect((await callback(app, 'code=c&state=s')).statusCode).toBe(302);
    expect((await get(app, '/api/auth/google/start')).statusCode).toBe(429);
  });
});

describe('GET /api/me', () => {
  it('reports hasPassword false for a Google-created user and true for a password user', async () => {
    const { app } = await setup();
    const session = await signUp(app, `ann-${randomUUID()}@example.com`);
    expect((await get(app, '/api/me', { sgs_session: session })).json().hasPassword).toBe(true);
  });
});
