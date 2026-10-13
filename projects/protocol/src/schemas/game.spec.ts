import { Value } from '@sinclair/typebox/value';
import { ActionSchema, SoloRoomBodySchema } from './index';

describe('game schemas', () => {
  it('accepts any object with a kind and a seat as an action, extra fields included', () => {
    expect(Value.Check(ActionSchema, { kind: 'EndPhaseAction', seatId: 'seat-0' })).toBe(true);
    expect(Value.Check(ActionSchema, { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'card-1', targets: [] })).toBe(true);
  });

  it('refuses an action without a kind or a seat, or with an empty one', () => {
    expect(Value.Check(ActionSchema, { kind: 'EndPhaseAction' })).toBe(false);
    expect(Value.Check(ActionSchema, { seatId: 'seat-0' })).toBe(false);
    expect(Value.Check(ActionSchema, { kind: '', seatId: 'seat-0' })).toBe(false);
    expect(Value.Check(ActionSchema, 'EndPhaseAction')).toBe(false);
  });

  it('accepts a solo-room body, with or without replace', () => {
    expect(Value.Check(SoloRoomBodySchema, { seatCount: 4, rules: {} })).toBe(true);
    expect(Value.Check(SoloRoomBodySchema, { seatCount: 5, rules: { firstRevealDraw: true }, replace: true })).toBe(true);
    expect(Value.Check(SoloRoomBodySchema, { seatCount: 4 })).toBe(false);
    expect(Value.Check(SoloRoomBodySchema, { seatCount: 4, rules: {}, replace: 'yes' })).toBe(false);
  });
});
