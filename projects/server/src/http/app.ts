import { GameHistory } from '../game/history';
import { registerGameRoutes } from './gameRoutes';
import cookie from '@fastify/cookie';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import Fastify, { FastifyError, FastifyInstance } from 'fastify';
import { AccountService, AuthError, Authenticated } from '../auth/accounts';
import { AuthRateLimits } from '../auth/rateLimits';
import { RoomError } from '../rooms/errors';
import { RoomService } from '../rooms/roomService';
import { attachSocketServer, SocketOptions } from '../socket/socketServer';
import { registerAuthRoutes } from './authRoutes';
import { AUTH_ERROR_STATUS, errorBody, ROOM_ERROR_STATUS } from './errors';
import { requestGuard } from './guard';
import { registerRoomRoutes } from './roomRoutes';
import { createStaticHandler } from './staticFiles';
import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from './session';

declare module 'fastify' {
  interface FastifyRequest {
    // The signed-in user and session, or null; set for every request.
    auth: Authenticated | null;
  }
}

export interface AppDeps {
  accounts: AccountService;
  rooms: RoomService;
  history: GameHistory;
  publicOrigin: string;
  // Heartbeat and hello timeouts; tests shorten them.
  socket?: SocketOptions;
  cookieSecure: boolean;
  // The built Angular app to serve; null or unset serves none.
  staticDir?: string | null;
  // Passed to Fastify; see ServerConfig.trustProxy.
  trustProxy?: false | number | string[];
  rateLimits?: AuthRateLimits;
  // Clock for the rate limits.
  now?: () => number;
  logger?: boolean;
}

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
  const app = Fastify({ logger: deps.logger ?? false, trustProxy: fastifyTrustProxy(deps.trustProxy ?? false) }).withTypeProvider<TypeBoxTypeProvider>();
  await app.register(cookie);
  app.decorateRequest('auth', null);

  app.addHook('onRequest', requestGuard(deps.publicOrigin));

  // Resolve the session cookie. A valid one is refreshed so the browser's copy
  // slides along with the stored expiry; an invalid one is cleared.
  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/')) return; // pages and static files never carry a session
    const token = request.cookies[SESSION_COOKIE];
    if (!token) return;
    const auth = await deps.accounts.authenticate(token);
    if (auth) {
      request.auth = auth;
      setSessionCookie(reply, token, auth.session.expiresAt, deps.cookieSecure);
    } else {
      clearSessionCookie(reply, deps.cookieSecure);
    }
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof AuthError) return reply.code(AUTH_ERROR_STATUS[error.code]).send(errorBody(error.code));
    if (error instanceof RoomError) return reply.code(ROOM_ERROR_STATUS[error.code]).send(errorBody(error.code));
    if (error.validation) return reply.code(400).send(errorBody('invalid_body'));
    // Body parsing errors (bad JSON, empty body, too large) carry their 4xx status.
    if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) return reply.code(error.statusCode).send(errorBody('invalid_body'));
    request.log.error(error);
    return reply.code(500).send(errorBody('internal'));
  });

  // With a static directory, a GET or HEAD outside /api/ that matches no route is the Angular app's.
  const serveStatic = deps.staticDir ? await createStaticHandler(deps.staticDir) : null;
  app.setNotFoundHandler((request, reply) => {
    const isPage = (request.method === 'GET' || request.method === 'HEAD') && !request.url.startsWith('/api/');
    if (serveStatic && isPage) return serveStatic(request, reply);
    return reply.code(404).send(errorBody('not_found'));
  });

  app.get('/healthz', async () => ({ status: 'ok' }));

  registerAuthRoutes(app, {
    accounts: deps.accounts,
    limits: deps.rateLimits ?? new AuthRateLimits(),
    cookieSecure: deps.cookieSecure,
    now: deps.now ?? Date.now,
  });

  registerRoomRoutes(app, { rooms: deps.rooms });
  registerGameRoutes(app, { history: deps.history });

  attachSocketServer(app, { accounts: deps.accounts, rooms: deps.rooms, publicOrigin: deps.publicOrigin, ...deps.socket });
  await app.ready();
  return app;
}

// Fastify 5 treats a numeric trustProxy as "trust nothing", so a hop count
// becomes a trust function: the socket peer is hop 0, the X-Forwarded-For
// entries behind it are hops 1, 2, ... A hop count assumes the server is only
// reachable through the proxy; otherwise configure the proxy addresses.
function fastifyTrustProxy(trust: false | number | string[]): boolean | string[] | ((address: string, hop: number) => boolean) {
  if (typeof trust !== 'number') return trust;
  return (_address, hop) => hop < trust;
}
