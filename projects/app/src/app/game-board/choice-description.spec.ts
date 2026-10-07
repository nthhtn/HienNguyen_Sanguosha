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
  it("a skill's take (Feedback): choose a card to take from the seat", () => {
    const feedback: PendingChoice = {
      id: 'f', seatId: 'seat-0', verb: 'take', options: [],
      reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId: 'feedback' }, abilityId: 'feedback', targetSeatId: 'seat-1' },
    };
    expect(describeChoice(state(feedback), 'seat-0')).toEqual({ title: 'Feedback', prompt: 'Choose a card to take from Seat 1', confirmLabel: 'Take' });
  });

  it('Gender Swords’ target: discard a hand card, or let the user draw', () => {
    const gs: PendingChoice = {
      id: 'gs', seatId: 'seat-0', verb: 'discard',
      reason: { kind: 'choice', card: { as: 'gender-swords', colour: 'black', physical: [] }, userSeatId: 'seat-1', targetSeatId: 'seat-0' },
      options: [{ id: 'decline', shows: { kind: 'decline' }, effects: [] }],
    };
    expect(describeChoice(state(gs), 'seat-0')).toEqual({
      title: 'Gender Swords',
      prompt: 'Discard a hand card, Or let Seat 1 draw 1 card',
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

describe('describeChoice for a skill’s pick or give', () => {
  const owner = { kind: 'general' as const, seatId: 'seat-1', slot: 'main' as const, skillId: 'kindness' };
  const pick = (verb: 'pick' | 'give', options: ChoiceOption[]): PendingChoice => ({ id: 'p', seatId: 'seat-0', verb, options, reason: { kind: 'ability', owner, abilityId: 'kindness' } });

  it('give: who gets the cards', () => {
    expect(describeChoice(state(pick('give', [{ id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] }])), 'seat-0')).toEqual({
      title: 'Kindness', prompt: 'Choose who gets the cards', confirmLabel: 'Give',
    });
  });

  it('pick: a seat, a suit, or one of several things', () => {
    const say = (options: ChoiceOption[]) => describeChoice(state(pick('pick', options)), 'seat-0')?.prompt;
    expect(say([{ id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] }])).toBe('Choose a seat');
    expect(say([{ id: 'heart', shows: { kind: 'suit', suit: 'heart' }, effects: [] }])).toBe('Name a suit');
    expect(say([{ id: 'done', shows: { kind: 'label', text: 'Done' }, effects: [] }, { id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] }])).toBe('Choose one');
  });

  it('labels seats by name, suits by symbol and name, labels by their text; a seat carries its force', () => {
    expect(choiceOptionLabel({ kind: 'seat', seatId: 'seat-1' }, players)).toBe('Seat 1');
    expect(choiceOptionLabel({ kind: 'suit', suit: 'heart' }, players)).toBe('♥ Heart');
    expect(choiceOptionLabel({ kind: 'label', text: 'Discard 2 Hand Cards' }, players)).toBe('Discard 2 Hand Cards');
    const seats = [{ id: 'seat-1', index: 1, kingdom: 'Wu' as const, combinedHp: 3, maxCombinedHp: 3, eliminated: false, generals: null, hand: { zoneId: 'h' }, equipped: { zoneId: 'e' }, judgment: { zoneId: 'j' } }];
    const legal: Action[] = [{ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'p', optionId: 'seat-1' }, { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'p', optionId: 'spade' }];
    const options: ChoiceOption[] = [{ id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] }, { id: 'spade', shows: { kind: 'suit', suit: 'spade' }, effects: [] }];
    expect(choiceDialogOptions(options, legal, players, undefined, seats)).toEqual([
      { id: 'seat-1', action: legal[0], label: 'Seat 1', force: 'Wu' },
      { id: 'spade', action: legal[1], label: '♠ Spade', suit: 'spade' },
    ]);
  });
});
