import { ChangePasswordBodySchema, ProfileQuerySchema, UpdateProfileBodySchema } from 'protocol/schemas';
import { AuthRateLimits } from '../auth/rateLimits';
import { ProfileService } from '../profile/profileService';
import { toMe } from '../views/me';
import { errorBody } from './errors';
import { registeredOnly } from './guard';
import { TypedApp } from './types';

export interface ProfileRouteDeps {
  profile: ProfileService;
  limits: AuthRateLimits;
  now: () => number;
}

// A registered user's stats, name and password (Profile spec "Server").
export function registerProfileRoutes(app: TypedApp, deps: ProfileRouteDeps): void {
  const { profile, limits, now } = deps;

  app.get('/api/me/profile', { onRequest: registeredOnly, schema: { querystring: ProfileQuerySchema } }, async (request) => profile.stats(request.auth!.user, request.query.mode ?? 'all'));

  app.patch('/api/me/profile', { onRequest: registeredOnly, schema: { body: UpdateProfileBodySchema } }, async (request) => toMe(await profile.rename(request.auth!.user, request.body.displayName)));

  app.post('/api/me/password', { onRequest: registeredOnly, schema: { body: ChangePasswordBodySchema } }, async (request, reply) => {
    const { user, session } = request.auth!;
    if (!limits.passwordUser.hit(user.id, now())) return reply.code(429).send(errorBody('rate_limited'));
    await profile.changePassword(user, session.id, request.body);
    return reply.code(204).send();
  });
}
