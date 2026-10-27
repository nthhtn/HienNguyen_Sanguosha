import { Value } from '@sinclair/typebox/value';
import { ClientMessageSchema } from './index';

const ROOM_ID = '5b0d6c1e-2f43-4a8e-9a57-0c7d0c4f8e21';
const GAME_ID = '9a1e7c52-1b0f-4f7e-8d2a-3c4b5d6e7f80';
const valid = (message: unknown) => Value.Check(ClientMessageSchema, message);

describe('client message schema', () => {
  it('accepts every client message, with or without a reqId', () => {
    expect(valid({ type: 'hello', protocolVersion: 2, roomId: ROOM_ID })).toBe(true);
    expect(valid({ type: 'lobby.addBot', reqId: 'r1' })).toBe(true);
    expect(valid({ type: 'lobby.removePlayer', reqId: 'r2', playerId: 'p1' })).toBe(true);
    expect(valid({ type: 'lobby.setRules', seatCount: 5, rules: { firstRevealDraw: false } })).toBe(true);
    expect(valid({ type: 'lobby.makeHost', playerId: 'p1' })).toBe(true);
    expect(valid({ type: 'room.leave', reqId: 'r3' })).toBe(true);
    expect(valid({ type: 'lobby.start', reqId: 'r4' })).toBe(true);
    expect(valid({ type: 'game.resync' })).toBe(true);
    expect(valid({ type: 'game.submit', reqId: 'r5', gameId: GAME_ID, baseSeq: 0, actions: [{ kind: 'EndPhaseAction', seatId: 'seat-0' }] })).toBe(true);
  });

  it('refuses an unknown type, extra fields and missing fields', () => {
    expect(valid({ type: 'lobby.kick' })).toBe(false);
    expect(valid({ type: 'lobby.addBot', extra: true })).toBe(false);
    expect(valid({ type: 'lobby.removePlayer' })).toBe(false);
    expect(valid({ type: 'hello', protocolVersion: 1 })).toBe(false);
  });

  it('refuses a game.submit with no actions, too many, a bad action, a negative baseSeq or a bad game id', () => {
    const submit = (fields: object) => valid({ type: 'game.submit', gameId: GAME_ID, baseSeq: 3, actions: [{ kind: 'EndPhaseAction', seatId: 'seat-0' }], ...fields });
    expect(submit({})).toBe(true);
    expect(submit({ actions: [] })).toBe(false);
    expect(submit({ actions: Array.from({ length: 51 }, () => ({ kind: 'DiscardCardAction', seatId: 'seat-0' })) })).toBe(false);
    expect(submit({ actions: [{ kind: 'EndPhaseAction' }] })).toBe(false);
    expect(submit({ actions: ['EndPhaseAction'] })).toBe(false);
    expect(submit({ baseSeq: -1 })).toBe(false);
    expect(submit({ baseSeq: 1.5 })).toBe(false);
    expect(submit({ gameId: 'abc' })).toBe(false);
  });

  it('refuses a reqId that is empty or longer than 64 characters', () => {
    expect(valid({ type: 'lobby.addBot', reqId: '' })).toBe(false);
    expect(valid({ type: 'lobby.addBot', reqId: 'x'.repeat(65) })).toBe(false);
  });

  it('refuses values that are not objects', () => {
    expect(valid(null)).toBe(false);
    expect(valid('hello')).toBe(false);
    expect(valid([{ type: 'room.leave' }])).toBe(false);
  });
});
