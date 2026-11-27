import { createHash } from 'node:crypto';
import { DISPLAY_NAME_MAX } from 'protocol';
import { createGoogleClient, GoogleAuthError, googleDisplayName, pkceChallenge } from './google';

const NOW = Date.parse('2026-11-27T12:00:00.000Z');
const REDIRECT = 'http://localhost:4200/api/auth/google/callback';
const SECRET = 'super-secret-value';

const jwt = (claims: object) => `${Buffer.from('{"alg":"RS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;
const VALID = { iss: 'https://accounts.google.com', aud: 'cid', exp: NOW / 1000 + 3600, nonce: 'n1', sub: 's1', email: 'gail@example.com', email_verified: true, name: 'Gail Lee' };

function clientWith(respond: () => Response) {
  const fetch = jest.fn(async () => respond());
  const client = createGoogleClient({ clientId: 'cid', clientSecret: SECRET, redirectUri: REDIRECT, fetch: fetch as unknown as typeof globalThis.fetch, now: () => NOW });
  return { client, fetch };
}
const withClaims = (claims: object) => clientWith(() => new Response(JSON.stringify({ id_token: jwt(claims), access_token: 'x' }), { status: 200 }));
const exchange = (client: ReturnType<typeof clientWith>['client']) => client.exchange({ code: 'the-code', codeVerifier: 'the-verifier', nonce: 'n1' });
const failure = (promise: Promise<unknown>) => promise.then(() => 'resolved', (err: unknown) => (err instanceof GoogleAuthError ? err.code : String(err)));

describe('pkceChallenge', () => {
  it('is the base64url SHA-256 of the verifier (the RFC 7636 example)', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(pkceChallenge('x')).toBe(createHash('sha256').update('x').digest('base64url'));
  });
});

describe('GoogleClient.authorizeUrl', () => {
  it('carries the client id, redirect uri, scope, state, nonce and an S256 challenge, and never the secret', () => {
    const { client } = withClaims(VALID);
    const url = new URL(client.authorizeUrl({ state: 'st', nonce: 'no', codeChallenge: 'ch' }));
    expect(`${url.origin}${url.pathname}`).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(Object.fromEntries(url.searchParams)).toEqual({ client_id: 'cid', redirect_uri: REDIRECT, response_type: 'code', scope: 'openid email profile', state: 'st', nonce: 'no', code_challenge: 'ch', code_challenge_method: 'S256' });
    expect(url.toString()).not.toContain(SECRET);
  });
});

describe('GoogleClient.exchange', () => {
  it('posts the code, verifier, client id, secret and redirect uri to the token endpoint and returns the claims', async () => {
    const { client, fetch } = withClaims(VALID);
    expect(await exchange(client)).toEqual({ sub: 's1', email: 'gail@example.com', emailVerified: true, name: 'Gail Lee' });
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(init.body as string))).toEqual({ grant_type: 'authorization_code', code: 'the-code', code_verifier: 'the-verifier', client_id: 'cid', client_secret: SECRET, redirect_uri: REDIRECT });
  });

  it('accepts the bare accounts.google.com issuer', async () => {
    expect(await exchange(withClaims({ ...VALID, iss: 'accounts.google.com' }).client)).toMatchObject({ sub: 's1' });
  });

  it.each([
    ['a wrong audience', { ...VALID, aud: 'someone-else' }],
    ['a wrong issuer', { ...VALID, iss: 'https://evil.example' }],
    ['an expired token', { ...VALID, exp: NOW / 1000 - 1 }],
    ['a wrong nonce', { ...VALID, nonce: 'other' }],
    ['a missing subject', { ...VALID, sub: undefined }],
    ['an empty subject', { ...VALID, sub: '' }],
    ['a missing email', { ...VALID, email: undefined }],
  ])('refuses %s as google_failed', async (_name, claims) => {
    expect(await failure(exchange(withClaims(claims).client))).toBe('google_failed');
  });

  it('refuses an email that is not verified as google_unverified', async () => {
    expect(await failure(exchange(withClaims({ ...VALID, email_verified: false }).client))).toBe('google_unverified');
    expect(await failure(exchange(withClaims({ ...VALID, email_verified: undefined }).client))).toBe('google_unverified');
  });

  it('refuses a token endpoint error, a body with no id_token, a body that is not JSON and a network failure as google_failed', async () => {
    expect(await failure(exchange(clientWith(() => new Response('{"error":"invalid_grant"}', { status: 400 })).client))).toBe('google_failed');
    expect(await failure(exchange(clientWith(() => new Response('{}', { status: 200 })).client))).toBe('google_failed');
    expect(await failure(exchange(clientWith(() => new Response('<html>', { status: 200 })).client))).toBe('google_failed');
    const down = createGoogleClient({ clientId: 'cid', clientSecret: SECRET, redirectUri: REDIRECT, fetch: (async () => Promise.reject(new Error('offline'))) as unknown as typeof globalThis.fetch, now: () => NOW });
    expect(await failure(exchange(down))).toBe('google_failed');
  });

  it('does not put the secret in an error message', async () => {
    const err = await exchange(clientWith(() => new Response('{"error":"bad"}', { status: 401 })).client).catch((e: Error) => e);
    expect(String((err as Error).message)).not.toContain(SECRET);
  });
});

describe('googleDisplayName', () => {
  it('uses the Google name, normalized', () => {
    expect(googleDisplayName('  Gail   Lee ', 'gail@example.com')).toBe('Gail Lee');
  });

  it('falls back to the part of the email before the @ when the name is blank or starts with [Bot]', () => {
    expect(googleDisplayName(undefined, 'gail.lee@example.com')).toBe('gail.lee');
    expect(googleDisplayName('   ', 'gail@example.com')).toBe('gail');
    expect(googleDisplayName('[Bot] Gail', 'gail@example.com')).toBe('gail');
  });

  it('falls back to Player when nothing usable is left', () => {
    expect(googleDisplayName('', '@example.com')).toBe('Player');
    expect(googleDisplayName('[bot]', '[bot]@example.com')).toBe('Player');
  });

  it('cuts a long name to the display name limit', () => {
    const name = googleDisplayName('A'.repeat(DISPLAY_NAME_MAX + 20), 'a@example.com');
    expect(name).toBe('A'.repeat(DISPLAY_NAME_MAX));
  });
});
