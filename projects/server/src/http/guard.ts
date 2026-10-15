import { FastifyReply, FastifyRequest } from 'fastify';
import { errorBody } from './errors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// CSRF guard: a state-changing request must come from our own origin and be
// JSON (which a plain cross-site form can't send).
export function requestGuard(publicOrigin: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (SAFE_METHODS.has(request.method)) return;
    if (request.headers.origin !== publicOrigin) return reply.code(403).send(errorBody('bad_origin'));
    if (!/^application\/json\s*(;|$)/i.test(request.headers['content-type'] ?? '')) return reply.code(415).send(errorBody('unsupported_media_type'));
  };
}

// Route hooks. They run before the body is parsed and validated, so a
// signed-out request is always told to sign in rather than that its body is wrong.
export async function signedIn(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth) return reply.code(401).send(errorBody('not_signed_in'));
}

// Signed in with an account: a guest is refused.
export async function registeredOnly(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth) return reply.code(401).send(errorBody('not_signed_in'));
  if (request.auth.user.kind !== 'registered') return reply.code(403).send(errorBody('registered_only'));
}
