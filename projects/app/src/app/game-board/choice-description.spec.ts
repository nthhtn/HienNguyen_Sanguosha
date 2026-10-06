import { Action, ChoiceOption, GameState, PendingChoice } from 'engine';
import { choiceDialogOptions, choiceOptionLabel, describeChoice } from './choice-description';

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
  it('Gender Swords’ target: discard a hand card, or let the user draw', () => {
    const gs: PendingChoice = {
      id: 'gs', seatId: 'seat-0', verb: 'discard',
      reason: { kind: 'choice', card: { as: 'gender-swords', colour: 'black', physical: [] }, userSeatId: 'seat-1', targetSeatId: 'seat-0' },
      options: [{ id: 'decline', shows: { kind: 'decline' }, effects: [] }],
    };
    expect(describeChoice(state(gs), 'seat-0')).toEqual({
      title: 'Gender Swords',
      prompt: 'Discard a hand card, or let Seat 1 draw 1 card',
      confirmLabel: 'Discard',
      declineLabel: 'Let Seat 1 Draw',
    });
    expect(choiceOptionLabel({ kind: 'decline' }, players, 'Let Seat 1 Draw')).toBe('Let Seat 1 Draw');
  });

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

describe('choiceDialogOptions', () => {
  const pick = (optionId: string): Action => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'c', optionId });
  const lion = { instanceId: 'lion-1', definitionId: 'silver-lion', suit: 'club' as const, rank: 1 };
  const options: ChoiceOption[] = [
    { id: 'hand', shows: { kind: 'hidden-hand', seatId: 'seat-1', count: 3 }, effects: [] },
    { id: 'lion-1', shows: { kind: 'card', card: lion }, effects: [] },
  ];

  it('shows a hand as one face-down card per card in it, each picking the hand at random', () => {
    const shown = choiceDialogOptions(options, [pick('hand'), pick('lion-1')], players);
    const hand = shown.filter((o) => o.faceDown);
    expect(hand.map((o) => o.id)).toEqual(['hand#1', 'hand#2', 'hand#3']);
    expect(hand.map((o) => o.label)).toEqual(['Hand Card 1', 'Hand Card 2', 'Hand Card 3']);
    expect(hand.every((o) => o.action === shown[0].action && !o.card)).toBe(true);
    expect(hand[0].action).toEqual(pick('hand'));
  });

  it('keeps each face-up card as its own option', () => {
    expect(choiceDialogOptions(options, [pick('hand'), pick('lion-1')], players)[3]).toEqual({ id: 'lion-1', action: pick('lion-1'), card: lion, label: 'Silver Lion (A ♣)' });
  });

  it('drops an option the engine does not offer', () => {
    expect(choiceDialogOptions(options, [pick('lion-1')], players).map((o) => o.id)).toEqual(['lion-1']);
  });
});

describe('ability asks', () => {
  it('labels the Use and Don’t options', () => {
    expect(choiceOptionLabel({ kind: 'use' }, [])).toBe('Use');
    expect(choiceOptionLabel({ kind: 'decline' }, [])).toBe("Don't");
  });
});
