import { Value } from '@sinclair/typebox/value';
import { CreateRoomBodySchema, JoinRoomBodySchema, RoomParamsSchema, RoomRulesSchema } from './index';

describe('room schemas', () => {
  it('accepts a create-room body', () => {
    expect(Value.Check(CreateRoomBodySchema, { seatCount: 4, rules: { firstRevealDraw: true }, displayName: 'Ann' })).toBe(true);
    expect(Value.Check(CreateRoomBodySchema, { seatCount: 4, rules: {}, displayName: 'Ann' })).toBe(true);
  });

  it('refuses a fractional seat count or a missing field', () => {
    expect(Value.Check(CreateRoomBodySchema, { seatCount: 4.5, rules: {}, displayName: 'Ann' })).toBe(false);
    expect(Value.Check(CreateRoomBodySchema, { seatCount: 4, displayName: 'Ann' })).toBe(false);
  });

  it('refuses unknown rule keys and non-boolean rule values', () => {
    expect(Value.Check(RoomRulesSchema, { firstRevealDraw: true, extra: 1 })).toBe(false);
    expect(Value.Check(RoomRulesSchema, { firstRevealDraw: 'yes' })).toBe(false);
  });

  it('accepts the known decks and refuses any other', () => {
    expect(Value.Check(RoomRulesSchema, { deck: 'kingdomWars' })).toBe(true);
    expect(Value.Check(RoomRulesSchema, { deck: 'dynastyWars', firstRevealDraw: true })).toBe(true);
    expect(Value.Check(RoomRulesSchema, { deck: 'bogus' })).toBe(false);
    expect(Value.Check(RoomRulesSchema, { deck: 1 })).toBe(false);
  });

  it('requires a display name to join', () => {
    expect(Value.Check(JoinRoomBodySchema, {})).toBe(false);
    expect(Value.Check(JoinRoomBodySchema, { displayName: 'Bo' })).toBe(true);
  });

  it('accepts only a uuid as a room id', () => {
    expect(Value.Check(RoomParamsSchema, { id: '5b0d6c1e-2f43-4a8e-9a57-0c7d0c4f8e21' })).toBe(true);
    expect(Value.Check(RoomParamsSchema, { id: 'room-1' })).toBe(false);
  });
});
