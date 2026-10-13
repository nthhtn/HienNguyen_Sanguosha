import { FastifyReply, FastifyRequest } from 'fastify';
import { FORGOT_PASSWORD_MESSAGE } from 'protocol';
import { ForgotPasswordBodySchema, GuestBodySchema, ResetPasswordBodySchema, SignInBodySchema, SignUpBodySchema } from 'protocol/schemas';
import { AccountService, SignedIn } from '../auth/accounts';
import { AuthRateLimits } from '../auth/rateLimits';
import { toMe } from '../views/me';
import { errorBody } from './errors';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from './session';
import { TypedApp } from './types';

export interface AuthRouteDeps {
  accounts: AccountService;
  limits: AuthRateLimits;
  cookieSecure: boolean;
  now: () => number;
}

const emailKey = (email: string) => email.trim().toLowerCase();

export function registerAuthRoutes(app: TypedApp, deps: AuthRouteDeps): void {
  const { accounts, limits, cookieSecure, now } = deps;

  const tooMany = (reply: FastifyReply) => reply.code(429).send(errorBody('rate_limited'));

  // Ends the session this browser had before, if any: signing in as someone
  // new on the same browser never leaves the old session usable.
  const endCurrentSession = async (request: FastifyRequest) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await accounts.signOut(token);
  };

  const signedIn = async (request: FastifyRequest, reply: FastifyReply, result: SignedIn, status: number) => {
    await endCurrentSession(request);
    setSessionCookie(reply, result.token, result.expiresAt, cookieSecure);
    return reply.code(status).send(toMe(result.user));
  };

  app.post('/api/auth/signup', { schema: { body: SignUpBodySchema } }, async (request, reply) => {
    if (!limits.signUpIp.hit(request.ip, now())) return tooMany(reply);
    return signedIn(request, reply, await accounts.signUp(request.body), 201);
  });

  app.post('/api/auth/signin', { schema: { body: SignInBodySchema } }, async (request, reply) => {
    const ipAllowed = limits.signInIp.hit(request.ip, now());
    const emailAllowed = limits.signInEmail.hit(emailKey(request.body.email), now());
    if (!ipAllowed || !emailAllowed) return tooMany(reply);
    return signedIn(request, reply, await accounts.signIn(request.body), 200);
  });

  app.post('/api/auth/guest', { schema: { body: GuestBodySchema } }, async (request, reply) => {
    if (!limits.signUpIp.hit(request.ip, now())) return tooMany(reply);
    return signedIn(request, reply, await accounts.createGuest(request.body), 201);
  });

  app.post('/api/auth/signout', async (request, reply) => {
    await endCurrentSession(request);
    clearSessionCookie(reply, cookieSecure);
    return reply.code(204).send();
  });

  app.post('/api/auth/forgot-password', { schema: { body: ForgotPasswordBodySchema } }, async (request, reply) => {
    const ipAllowed = limits.forgotIp.hit(request.ip, now());
    const emailAllowed = limits.forgotEmail.hit(emailKey(request.body.email), now());
    if (!ipAllowed || !emailAllowed) return tooMany(reply);
    await accounts.forgotPassword(request.body.email);
    return { message: FORGOT_PASSWORD_MESSAGE };
  });

  app.post('/api/auth/reset-password', { schema: { body: ResetPasswordBodySchema } }, async (request, reply) => {
    return signedIn(request, reply, await accounts.resetPassword(request.body), 200);
  });

  app.get('/api/me', async (request, reply) => {
    if (!request.auth) return reply.code(401).send(errorBody('not_signed_in'));
    return toMe(request.auth.user);
  });
}
