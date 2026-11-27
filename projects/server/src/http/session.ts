import { FastifyReply, FastifyRequest } from 'fastify';
import type { AccountService, SignedIn } from '../auth/accounts';

export const SESSION_COOKIE = 'sgs_session';

type SessionRequestHeaders = {
  origin?: string;
  referer?: string;
  'x-forwarded-proto'?: string;
};

// Production uses PUBLIC_ORIGIN (https). In development, an https Origin (a Cloudflare tunnel or an installed PWA)
// needs Secure session cookies or the browser will not keep them across API calls.
export function sessionCookieSecure(production: boolean, configured: boolean, headers: SessionRequestHeaders): boolean {
  if (production) return configured;
  if (headers.origin?.startsWith('https://')) return true;
  if (headers.referer?.startsWith('https://')) return true;
  if (headers['x-forwarded-proto'] === 'https') return true;
  return configured;
}

export function setSessionCookie(reply: FastifyReply, token: string, expiresAt: Date, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE, token, { httpOnly: true, secure, sameSite: 'lax', path: '/', expires: expiresAt });
}

export function clearSessionCookie(reply: FastifyReply, secure: boolean): void {
  reply.clearCookie(SESSION_COOKIE, { httpOnly: true, secure, sameSite: 'lax', path: '/' });
}

// Signs the browser in as `result`: ends the session it had before, if any (so
// signing in as someone new never leaves the old one usable), and sets the new cookie.
export async function beginSession(request: FastifyRequest, reply: FastifyReply, accounts: AccountService, result: SignedIn, options: { production: boolean; cookieSecure: boolean }): Promise<void> {
  const token = request.cookies[SESSION_COOKIE];
  if (token) await accounts.signOut(token);
  setSessionCookie(reply, result.token, result.expiresAt, sessionCookieSecure(options.production, options.cookieSecure, request.headers));
}
