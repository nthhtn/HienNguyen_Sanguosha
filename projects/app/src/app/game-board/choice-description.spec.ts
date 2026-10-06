import { GameState, PendingChoice } from 'engine';
import { choiceOptionLabel, describeChoice } from './choice-description';

const players = [
  { id: 'p0', seatId: 'seat-0', kind: 'human' as const, name: 'Hing' },
  { id: 'p1', seatId: 'seat-1', kind: 'bot' as const, name: 'Seat 1' },
];
const choice = (as: string, verb: 'take' | 'discard', targetSeatId?: string): PendingChoice => ({
  id: 'c', seatId: 'seat-0', verb, options: [],
  reason: { kind: 'choice', card: { as, colour: 'black', physical: [] }, userSeatId: 'seat-0', ...(targetSeatId ? { targetSeatId } : {}) },
});
const state = (pendingChoice?: PendingChoice): GameState => ({
  seats: [], zones: [], log: [], pendingResponse: null, result: null, generalSelection: null, phase: 'Play', players,
  turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, rng: { seed: 1, counter: 0 },
  ...(pendingChoice ? { pendingChoice } : {}),
});

describe('describeChoice', () => {
  it('names the Tool, says what to do, and labels the button Take or Discard', () => {
    expect(describeChoice(state(choice('steal', 'take', 'seat-1')), 'seat-0')).toEqual({ title: 'Steal', prompt: 'Choose a card to take from Seat 1', confirmLabel: 'Take' });
    expect(describeChoice(state(choice('break', 'discard', 'seat-1')), 'seat-0')).toEqual({ title: 'Break', prompt: 'Choose a card to discard from Seat 1', confirmLabel: 'Discard' });
    expect(describeChoice(state(choice('harvest', 'take')), 'seat-0')).toEqual({ title: 'Harvest', prompt: 'Choose a card to take', confirmLabel: 'Take' });
  });

  it('is null when the viewer has no choice to make', () => {
    expect(describeChoice(state(choice('steal', 'take', 'seat-1')), 'seat-1')).toBeNull();
    expect(describeChoice(state(), 'seat-0')).toBeNull();
  });
});

describe('choiceOptionLabel', () => {
  it('labels a hand by its owner and size, and a card by its name and face', () => {
    expect(choiceOptionLabel({ kind: 'hidden-hand', seatId: 'seat-1', count: 3 }, players)).toBe("Seat 1's Hand (3 Cards)");
    expect(choiceOptionLabel({ kind: 'hidden-hand', seatId: 'seat-1', count: 1 }, players)).toBe("Seat 1's Hand (1 Card)");
    expect(choiceOptionLabel({ kind: 'card', card: { instanceId: 'l', definitionId: 'silver-lion', suit: 'club', rank: 1 } }, players)).toBe('Silver Lion (A ♣)');
  });
});
