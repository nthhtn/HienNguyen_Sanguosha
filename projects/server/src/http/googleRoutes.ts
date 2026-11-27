import { randomBytes, timingSafeEqual } from 'node:crypto';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AccountService } from '../auth/accounts';
import { GoogleAuthError, GoogleClient, pkceChallenge } from '../auth/google';
import { AuthRateLimits } from '../auth/rateLimits';
import { errorBody } from './errors';
import { beginSession, sessionCookieSecure } from './session';
import { TypedApp } from './types';

export const OAUTH_COOKIE = 'sgs_oauth';
const OAUTH_PATH = '/api/auth/google';
const OAUTH_COOKIE_SECONDS = 10 * 60;

export interface GoogleRouteDeps {
  accounts: AccountService;
  // Null when Google sign-in is not set up.
  google: GoogleClient | null;
  limits: AuthRateLimits;
  cookieSecure: boolean;
  production: boolean;
  now: () => number;
}

// Where to go after signing in: a path inside this site, else the front page.
// Anything that could leave the site (`//host`, a scheme, a backslash) is not one.
export function safeReturnPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || Array.from(raw).some((ch) => ch === '\\' || ch.charCodeAt(0) < 32)) return '/';
  return raw;
}

// What the browser keeps between leaving for Google and coming back.
interface OAuthFlow {
  state: string;
  nonce: string;
  verifier: string;
  returnUrl: string;
}

const random = () => randomBytes(32).toString('base64url');
const encodeFlow = (flow: OAuthFlow) => Buffer.from(JSON.stringify(flow)).toString('base64url');

function decodeFlow(value: string | undefined): OAuthFlow | null {
  if (!value) return null;
  try {
    const flow = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<OAuthFlow>;
    const ok = [flow.state, flow.nonce, flow.verifier, flow.returnUrl].every((part) => typeof part === 'string' && part !== '');
    return ok ? (flow as OAuthFlow) : null;
  } catch {
    return null;
  }
}

function sameText(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// "Continue with Google" (Google sign-in spec "Flow"): start sends the browser
// to Google, callback brings it back and signs the player in.
export function registerGoogleRoutes(app: TypedApp, deps: GoogleRouteDeps): void {
  const { accounts, google, limits, cookieSecure, production, now } = deps;

  app.get('/api/auth/providers', async () => ({ google: google !== null }));

  if (!google) {
    const off = async (_request: FastifyRequest, reply: FastifyReply) => reply.code(404).send(errorBody('not_found'));
    app.get('/api/auth/google/start', off);
    app.get('/api/auth/google/callback', off);
    return;
  }

  const cookieOptions = (request: FastifyRequest) => ({ httpOnly: true, secure: sessionCookieSecure(production, cookieSecure, request.headers), sameSite: 'lax' as const, path: OAUTH_PATH });
  const tooMany = (reply: FastifyReply) => reply.code(429).send(errorBody('rate_limited'));
  // Back to Sign In with a code the page turns into a message; the page the player wanted is kept for the retry.
  const fail = (reply: FastifyReply, code: string, returnUrl: string) => reply.redirect(`/sign-in?error=${code}${returnUrl === '/' ? '' : `&returnUrl=${encodeURIComponent(returnUrl)}`}`);

  app.get('/api/auth/google/start', async (request, reply) => {
    if (!limits.googleIp.hit(request.ip, now())) return tooMany(reply);
    const returnUrl = safeReturnPath((request.query as { returnUrl?: unknown }).returnUrl);
    const flow: OAuthFlow = { state: random(), nonce: random(), verifier: random(), returnUrl };
    reply.setCookie(OAUTH_COOKIE, encodeFlow(flow), { ...cookieOptions(request), maxAge: OAUTH_COOKIE_SECONDS });
    return reply.redirect(google.authorizeUrl({ state: flow.state, nonce: flow.nonce, codeChallenge: pkceChallenge(flow.verifier) }));
  });

  app.get('/api/auth/google/callback', async (request, reply) => {
    if (!limits.googleIp.hit(request.ip, now())) return tooMany(reply);
    const query = request.query as { code?: unknown; state?: unknown; error?: unknown };
    const flow = decodeFlow(request.cookies[OAUTH_COOKIE]);
    // The flow is single use, whatever happens next.
    reply.clearCookie(OAUTH_COOKIE, cookieOptions(request));
    if (!flow || typeof query.state !== 'string' || !sameText(query.state, flow.state)) return fail(reply, 'google_failed', flow?.returnUrl ?? '/');
    if (typeof query.error === 'string') return fail(reply, query.error === 'access_denied' ? 'google_cancelled' : 'google_failed', flow.returnUrl);
    if (typeof query.code !== 'string' || query.code === '') return fail(reply, 'google_failed', flow.returnUrl);

    try {
      const claims = await google.exchange({ code: query.code, codeVerifier: flow.verifier, nonce: flow.nonce });
      const result = await accounts.signInWithGoogle(claims);
      if ('refused' in result) return fail(reply, 'google_email_in_use', flow.returnUrl);
      await beginSession(request, reply, accounts, result.signedIn, { production, cookieSecure });
      return reply.redirect(flow.returnUrl);
    } catch (err) {
      if (err instanceof GoogleAuthError) return fail(reply, err.code, flow.returnUrl);
      // The error is logged without the request, so no code or secret goes with it.
      request.log.error({ err }, 'Google sign-in failed');
      return fail(reply, 'google_failed', flow.returnUrl);
    }
  });
}
