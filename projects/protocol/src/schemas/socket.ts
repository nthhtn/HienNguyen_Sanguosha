import { Type } from '@sinclair/typebox';
import { MAX_SUBMIT_ACTIONS, REQ_ID_MAX } from '../limits';
import { ActionSchema } from './game';
import { RoomIdSchema, RoomRulesSchema, SeatCountSchema } from './rooms';

// Every client message is an object with a `type`, and may carry a `reqId`
// that the server echoes in its `ack` or `error`. Extra fields are refused.
const ReqId = Type.Optional(Type.String({ minLength: 1, maxLength: REQ_ID_MAX }));
const PlayerId = Type.String({ minLength: 1, maxLength: 64 });
const strict = { additionalProperties: false } as const;

export const HelloSchema = Type.Object({ type: Type.Literal('hello'), reqId: ReqId, protocolVersion: Type.Integer(), roomId: RoomIdSchema }, strict);
export const AddBotSchema = Type.Object({ type: Type.Literal('lobby.addBot'), reqId: ReqId }, strict);
export const RemovePlayerSchema = Type.Object({ type: Type.Literal('lobby.removePlayer'), reqId: ReqId, playerId: PlayerId }, strict);
export const SetRulesSchema = Type.Object({ type: Type.Literal('lobby.setRules'), reqId: ReqId, seatCount: SeatCountSchema, rules: RoomRulesSchema }, strict);
export const MakeHostSchema = Type.Object({ type: Type.Literal('lobby.makeHost'), reqId: ReqId, playerId: PlayerId }, strict);
export const LeaveSchema = Type.Object({ type: Type.Literal('room.leave'), reqId: ReqId }, strict);

export const StartSchema = Type.Object({ type: Type.Literal('lobby.start'), reqId: ReqId }, strict);
export const SubmitSchema = Type.Object(
  {
    type: Type.Literal('game.submit'),
    reqId: ReqId,
    gameId: RoomIdSchema,
    baseSeq: Type.Integer({ minimum: 0 }),
    actions: Type.Array(ActionSchema, { minItems: 1, maxItems: MAX_SUBMIT_ACTIONS }),
  },
  strict
);
export const ResyncSchema = Type.Object({ type: Type.Literal('game.resync'), reqId: ReqId }, strict);

export const ClientMessageSchema = Type.Union([
  HelloSchema,
  AddBotSchema,
  RemovePlayerSchema,
  SetRulesSchema,
  MakeHostSchema,
  LeaveSchema,
  StartSchema,
  SubmitSchema,
  ResyncSchema,
]);
