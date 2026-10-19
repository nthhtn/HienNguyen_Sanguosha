import type { DecisionReason, GameState } from 'engine';
import { HARMFUL_TOOLS, HELPFUL_TOOLS, shouldHoldShan, wuxieWorthCancelling } from './responses';
import { card, table } from './testing';

const seatOf = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!;
const shans = (n: number) => Array.from({ length: n }, (_, i) => card(`sh${i}`, 'shan'));

// A Slash's hit window on `target`: not answering leads to `amount` damage.
function shaWindow(s: GameState, target: string, amount = 1): GameState {
  return {
    ...s,
    pendingResponse: {
      id: 'r1', respondingSeatId: target, allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['shan'],
      context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: target }, amount: 0 } },
      outcome: { kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-b' }, target: { kind: 'seat', seatId: target }, amount, nature: 'normal' } },
    },
  };
}

describe('shouldHoldShan', () => {
  const at = (hp: number, n: number, amount = 1) => {
    const s = shaWindow(table({ 'seat-a:hand': shans(n) }, { hp: { 'seat-a': hp }, maxHp: { 'seat-a': 4 } }), 'seat-a', amount);
    return shouldHoldShan(s, seatOf(s, 'seat-a'));
  };
  it('holds a lone Dodge against a non-lethal hit at 3+ HP', () => expect(at(3, 1)).toBe(true));
  it('answers when it holds two Dodge', () => expect(at(3, 2)).toBe(false));
  it('answers at 2 HP or less', () => expect(at(2, 1)).toBe(false));
  it('answers a lethal hit', () => expect(at(3, 1, 3)).toBe(false));
  it('answers with no DamageEffect outcome', () => {
    const s = shaWindow(table({ 'seat-a:hand': shans(1) }, { hp: { 'seat-a': 4 } }), 'seat-a');
    const bare = { ...s, pendingResponse: { ...s.pendingResponse!, outcome: undefined } };
    expect(shouldHoldShan(bare, seatOf(bare, 'seat-a'))).toBe(false);
  });
  it('answers when the damage lands on another seat', () => {
    const s = shaWindow(table({ 'seat-a:hand': shans(1) }, { hp: { 'seat-a': 4 } }), 'seat-b');
    expect(shouldHoldShan(s, seatOf(s, 'seat-a'))).toBe(false);
  });
});

describe('wuxieWorthCancelling', () => {
  // seat-a is the bot (Wei). seat-b Wei (ally), seat-c Shu (known foe), seat-d hidden.
  const s = table({}, { kingdoms: { 'seat-a': 'Wei', 'seat-b': 'Wei', 'seat-c': 'Shu', 'seat-d': 'hidden' } });
  const reason = (tool: string, user: string, target: string): Extract<DecisionReason, { kind: 'wuxie' }> => ({
    kind: 'wuxie', tool: { as: tool, colour: 'black', physical: [] }, toolUserSeatId: user, target: { kind: 'seat', seatId: target },
  });
  const check = (r: ReturnType<typeof reason>, extended = true) => wuxieWorthCancelling(s, seatOf(s, 'seat-a'), r, extended);

  it('knows the tool lists', () => {
    expect(HARMFUL_TOOLS.has('duel')).toBe(true);
    expect([...HELPFUL_TOOLS].sort()).toEqual(['draw-two', 'harvest', 'peach-garden']);
  });
  it('always cancels a harmful Tool aimed at itself, even its own Starvation judgment', () => {
    expect(check(reason('starvation', 'seat-a', 'seat-a'), false)).toBe(true);
    expect(check(reason('duel', 'seat-c', 'seat-a'), false)).toBe(true);
  });
  it('without the extended rule, ignores allies and helpful Tools', () => {
    expect(check(reason('duel', 'seat-c', 'seat-b'), false)).toBe(false);
    expect(check(reason('peach-garden', 'seat-d', 'seat-c'), false)).toBe(false);
  });
  it('extended: cancels a harmful Tool aimed at a revealed ally', () => {
    expect(check(reason('duel', 'seat-c', 'seat-b'))).toBe(true);
  });
  it('extended: not a harmful Tool on a hidden seat or a foe', () => {
    expect(check(reason('duel', 'seat-c', 'seat-d'))).toBe(false);
    expect(check(reason('duel', 'seat-d', 'seat-c'))).toBe(false);
  });
  it('extended: cancels a helpful Tool aimed at a known foe, not an ally or hidden seat', () => {
    expect(check(reason('peach-garden', 'seat-d', 'seat-c'))).toBe(true);
    expect(check(reason('peach-garden', 'seat-d', 'seat-b'))).toBe(false);
    expect(check(reason('peach-garden', 'seat-c', 'seat-d'))).toBe(false);
  });
  it('extended: never cancels a Tool its own seat or an ally used', () => {
    expect(check(reason('duel', 'seat-a', 'seat-b'))).toBe(false);
    expect(check(reason('duel', 'seat-b', 'seat-b'))).toBe(false);
    expect(check(reason('peach-garden', 'seat-b', 'seat-c'))).toBe(false);
  });
  it('does not crash on a non-seat target', () => {
    const r = { ...reason('duel', 'seat-c', 'seat-a'), target: { kind: 'general' as const, seatId: 'seat-a', generalSlot: 'main' as const } };
    expect(check(r)).toBe(false);
  });
});
