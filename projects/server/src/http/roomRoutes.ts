import { FastifyReply, FastifyRequest } from 'fastify';
import type { RoomCreated } from 'protocol';
import { CreateRoomBodySchema, JoinRoomBodySchema, RoomParamsSchema } from 'protocol/schemas';
import { RoomService } from '../rooms/roomService';
import { errorBody } from './errors';
import { TypedApp } from './types';

// Runs before the body is parsed and validated, so a signed-out request is
// always told to sign in rather than that its body is wrong.
async function signedIn(request: FastifyRequest, reply: FastifyReply) {
  if (!request.auth) return reply.code(401).send(errorBody('not_signed_in'));
}

export function registerRoomRoutes(app: TypedApp, deps: { rooms: RoomService }): void {
  const { rooms } = deps;

  app.get('/api/rooms', { onRequest: signedIn }, async (request) => rooms.list(request.auth!.user));

  app.post('/api/rooms', { onRequest: signedIn, schema: { body: CreateRoomBodySchema } }, async (request, reply) => {
    const created: RoomCreated = { id: await rooms.create(request.auth!.user, request.body) };
    return reply.code(201).send(created);
  });

  app.post('/api/rooms/:id/join', { onRequest: signedIn, schema: { params: RoomParamsSchema, body: JoinRoomBodySchema } }, async (request) => {
    await rooms.join(request.auth!.user, request.params.id, request.body.displayName);
    const joined: RoomCreated = { id: request.params.id };
    return joined;
  });

  app.get('/api/rooms/:id', { onRequest: signedIn, schema: { params: RoomParamsSchema } }, async (request) => rooms.snapshot(request.auth!.user, request.params.id));
}
