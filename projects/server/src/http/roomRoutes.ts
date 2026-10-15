import type { RoomCreated } from 'protocol';
import { CreateRoomBodySchema, JoinRoomBodySchema, RoomParamsSchema, SoloRoomBodySchema } from 'protocol/schemas';
import { RoomService } from '../rooms/roomService';
import { signedIn } from './guard';
import { TypedApp } from './types';

export function registerRoomRoutes(app: TypedApp, deps: { rooms: RoomService }): void {
  const { rooms } = deps;

  app.get('/api/rooms', { onRequest: signedIn }, async (request) => rooms.list(request.auth!.user));

  app.post('/api/rooms', { onRequest: signedIn, schema: { body: CreateRoomBodySchema } }, async (request, reply) => {
    const created: RoomCreated = { id: await rooms.create(request.auth!.user, request.body) };
    return reply.code(201).send(created);
  });

  app.post('/api/rooms/solo', { onRequest: signedIn, schema: { body: SoloRoomBodySchema } }, async (request, reply) => {
    const created: RoomCreated = { id: await rooms.createSolo(request.auth!.user, request.body) };
    return reply.code(201).send(created);
  });

  app.post('/api/rooms/:id/join', { onRequest: signedIn, schema: { params: RoomParamsSchema, body: JoinRoomBodySchema } }, async (request) => {
    await rooms.join(request.auth!.user, request.params.id, request.body.displayName);
    const joined: RoomCreated = { id: request.params.id };
    return joined;
  });

  app.get('/api/rooms/:id', { onRequest: signedIn, schema: { params: RoomParamsSchema } }, async (request) => rooms.snapshot(request.auth!.user, request.params.id));
}
