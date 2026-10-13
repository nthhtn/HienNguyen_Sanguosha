import { Value } from '@sinclair/typebox/value';
import { ClientMessageSchema } from './index';

const ROOM_ID = '5b0d6c1e-2f43-4a8e-9a57-0c7d0c4f8e21';
const valid = (message: unknown) => Value.Check(ClientMessageSchema, message);

describe('client message schema', () => {
  it('accepts every client message, with or without a reqId', () => {
    expect(valid({ type: 'hello', protocolVersion: 1, roomId: ROOM_ID })).toBe(true);
    expect(valid({ type: 'lobby.addBot', reqId: 'r1' })).toBe(true);
    expect(valid({ type: 'lobby.removePlayer', reqId: 'r2', playerId: 'p1' })).toBe(true);
    expect(valid({ type: 'lobby.setRules', seatCount: 5, rules: { firstRevealDraw: false } })).toBe(true);
    expect(valid({ type: 'lobby.makeHost', playerId: 'p1' })).toBe(true);
    expect(valid({ type: 'room.leave', reqId: 'r3' })).toBe(true);
  });

  it('refuses an unknown type, extra fields and missing fields', () => {
    expect(valid({ type: 'lobby.start' })).toBe(false);
    expect(valid({ type: 'lobby.addBot', extra: true })).toBe(false);
    expect(valid({ type: 'lobby.removePlayer' })).toBe(false);
    expect(valid({ type: 'hello', protocolVersion: 1 })).toBe(false);
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
