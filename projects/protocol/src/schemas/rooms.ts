import { Type } from '@sinclair/typebox';
import { DISPLAY_NAME_MAX } from '../limits';
import { DECK_IDS } from '../rooms';

// Shape checks only. The server checks the seat count against its limits and
// normalizes the name, so it can answer with a specific error code.
const DisplayName = Type.String({ maxLength: DISPLAY_NAME_MAX * 4 });

export const SeatCountSchema = Type.Integer({ minimum: 0, maximum: 100 });
// The engine's GameRules. Unknown keys never reach the store: the socket
// refuses them, and Fastify strips them from HTTP bodies.
export const DeckIdSchema = Type.Union(DECK_IDS.map((id) => Type.Literal(id)));
export const RoomRulesSchema = Type.Object({ firstRevealDraw: Type.Optional(Type.Boolean()), deck: Type.Optional(DeckIdSchema) }, { additionalProperties: false });
export const RoomIdSchema = Type.String({ pattern: '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' });
export const RoomParamsSchema = Type.Object({ id: RoomIdSchema });

export const CreateRoomBodySchema = Type.Object({ seatCount: SeatCountSchema, rules: RoomRulesSchema, displayName: DisplayName });
export const JoinRoomBodySchema = Type.Object({ displayName: DisplayName });
