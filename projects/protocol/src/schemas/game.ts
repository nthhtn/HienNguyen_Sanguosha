import { Type } from '@sinclair/typebox';
import { RoomRulesSchema, SeatCountSchema } from './rooms';

// Shape only: an engine action is an object with a kind and a seat. The server
// accepts only actions the engine offered, so it checks the rest itself.
export const ActionSchema = Type.Object(
  { kind: Type.String({ minLength: 1, maxLength: 64 }), seatId: Type.String({ minLength: 1, maxLength: 64 }) },
  { additionalProperties: true }
);

// POST /api/rooms/solo. `replace` abandons a running solo game first.
export const SoloRoomBodySchema = Type.Object({ seatCount: SeatCountSchema, rules: RoomRulesSchema, replace: Type.Optional(Type.Boolean()) });
