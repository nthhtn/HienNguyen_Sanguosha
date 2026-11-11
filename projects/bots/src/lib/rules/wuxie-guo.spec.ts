import type { Action, GameState, UsedCard } from 'engine';
import { ruleBasedPolicy } from '../rule-based';
import { card, decideWith, table } from '../testing';

const decide = (s: GameState) => decideWith(ruleBasedPolicy, s);
// seat-a is asked to cancel `tool` on `targetSeatId`, holding `hand` (instance id = definition id).
const wuxieWindow = (hand: string[], tool: string, targetSeatId: string, hidden = false): GameState => {
  const s = table({ 'seat-a:hand': hand.map((id) => card(id, id)) });
  const used: UsedCard = { as: tool, colour: 'black', physical: [] };
  return {
    ...s,
    seats: s.seats.map((seat) => (hidden && seat.id === targetSeatId ? { ...seat, generals: { main: { ...seat.generals!.main, revealed: false }, deputy: { ...seat.generals!.deputy, revealed: false } } } : seat)),
    pendingResponse: {
      id: 'r1', respondingSeatId: 'seat-a', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: [...new Set(hand)],
      context: { effect: { kind: 'HealEffect', target: { kind: 'seat', seatId: targetSeatId }, amount: 0 } },
      reason: { kind: 'wuxie', tool: used, toolUserSeatId: 'seat-b', target: { kind: 'seat', seatId: targetSeatId } },
    },
  };
};
const played = (a: Action) => (a.kind === 'RespondAction' ? a.cardInstanceId : a.kind);

describe('rules/wuxie-guo: Wuxie Kingdom', () => {
  it('wuxie kingdom: kept for a single-target Tool', () => {
    expect(played(decide(wuxieWindow(['wuxie-guo', 'wuxie'], 'steal', 'seat-a')))).toBe('wuxie');
    expect(played(decide(wuxieWindow(['wuxie', 'wuxie-guo'], 'steal', 'seat-a')))).toBe('wuxie');
  });

  it('wuxie kingdom: played against Barbarians on an exposed bot', () => {
    expect(played(decide(wuxieWindow(['wuxie', 'wuxie-guo'], 'barbarians', 'seat-a')))).toBe('wuxie-guo');
  });

  it('wuxie kingdom: kept against Barbarians when the bot has hidden Generals', () => {
    expect(played(decide(wuxieWindow(['wuxie-guo', 'wuxie'], 'barbarians', 'seat-a', true)))).toBe('wuxie');
  });

  it('wuxie kingdom: the only Wuxie held is played', () => {
    expect(played(decide(wuxieWindow(['wuxie-guo'], 'steal', 'seat-a')))).toBe('wuxie-guo');
  });
});
