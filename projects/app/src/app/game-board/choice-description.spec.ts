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
  const skill = (skillId: string, verb: PendingChoice['verb'], targetSeatId?: string, options: ChoiceOption[] = [{ id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] }]): PendingChoice => ({
    id: 'k', seatId: 'seat-0', verb, options,
    reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId }, abilityId: skillId, ...(targetSeatId ? { targetSeatId } : {}) },
  });

  it("Sudden Attack: choose one of the seat's cards to discard", () => {
    expect(describeChoice(state(skill('sudden-attack', 'discard', 'seat-1')), 'seat-0')).toEqual({ title: 'Sudden Attack', prompt: 'Choose a card to discard from Seat 1', confirmLabel: 'Discard' });
  });

  it('Rouse the Tiger: the seat its target damages', () => {
    expect(describeChoice(state(skill('rouse-the-tiger', 'pick', 'seat-1')), 'seat-0')).toEqual({ title: 'Rouse the Tiger', prompt: 'Choose a seat for Seat 1 to damage', confirmLabel: 'Choose' });
  });

  it('Bewilder: believe or doubt the claim', () => {
    const doubt: PendingChoice = {
      id: 'b', seatId: 'seat-0', verb: 'pick',
      reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-1', slot: 'main', skillId: 'bewilder' }, abilityId: 'bewilder', cardId: 'sha' },
      options: [{ id: 'believe', shows: { kind: 'label', text: 'Believe' }, effects: [] }, { id: 'doubt', shows: { kind: 'label', text: 'Doubt' }, effects: [] }],
    };
    expect(describeChoice(state(doubt), 'seat-0')).toEqual({ title: 'Bewilder', prompt: 'Seat 1 claims Slash. Believe or doubt?', confirmLabel: 'Choose' });
  });

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
  it('Upheaval: a seat to Slash, or pass', () => {
    const options: ChoiceOption[] = [
      { id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] },
      { id: 'pass', shows: { kind: 'label', text: 'Pass (Lose 1 HP)' }, effects: [] },
    ];
    expect(describeChoice(state(skill('upheaval', 'pick', undefined, options)), 'seat-0')).toEqual({ title: 'Upheaval', prompt: 'Choose a seat to play a Slash at, or pass', confirmLabel: 'Choose' });
  });

  it('Collapse and Brave Spirit: their own words', () => {
    const labels: ChoiceOption[] = [{ id: 'a', shows: { kind: 'label', text: 'A' }, effects: [] }, { id: 'b', shows: { kind: 'label', text: 'B' }, effects: [] }];
    expect(describeChoice(state(skill('collapse', 'pick', undefined, labels)), 'seat-0')).toEqual({ title: 'Collapse', prompt: 'Choose how Collapse costs you', confirmLabel: 'Choose' });
    expect(describeChoice(state(skill('brave-spirit', 'pick', 'seat-1', labels)), 'seat-0')).toEqual({ title: 'Brave Spirit', prompt: 'Choose how Seat 1 draws and discards', confirmLabel: 'Choose' });
  });

  it('Alternate Sorrow: which of the killer’s Generals, offered as Main and Deputy, never by name', () => {
    const slots: ChoiceOption[] = [
      { id: 'main', shows: { kind: 'label', text: 'Main General' }, effects: [] },
      { id: 'deputy', shows: { kind: 'label', text: 'Deputy General' }, effects: [] },
    ];
    expect(describeChoice(state(skill('alternate:sorrow', 'pick', 'seat-1', slots)), 'seat-0')).toEqual({ title: 'Sorrow', prompt: "Choose which of Seat 1's Generals loses its skills", confirmLabel: 'Choose' });
    expect(slots.map((o) => choiceOptionLabel(o.shows, players, undefined, undefined, o.id))).toEqual(['Main General', 'Deputy General']);
  });

  it('Exile, Brave Spirit and Alliance seat picks name what the seat does', () => {
    const seats: ChoiceOption[] = [{ id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] }];
    expect(describeChoice(state(skill('exile', 'pick', undefined, seats)), 'seat-0')!.prompt).toBe('Choose a seat to turn over');
    expect(describeChoice(state(skill('brave-spirit', 'pick', undefined, seats)), 'seat-0')!.prompt).toBe('Choose a seat to draw and discard cards');
    expect(describeChoice(state(skill('alliance', 'pick', 'seat-1', seats)), 'seat-0')!.prompt).toBe('Choose a seat to swap hands with Seat 1');
  });

  it('names the card being given, with its face', () => {
    const card = { instanceId: 'c1', definitionId: 'sha', suit: 'spade' as const, rank: 7 };
    const seats: ChoiceOption[] = [{ id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [], card }];
    expect(describeChoice(state(skill('alternate:bequeathed-strategy', 'pick', undefined, seats)), 'seat-0')!.prompt).toBe('Choose a seat to give Slash (7 ♠) to');
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

describe('Trident Glaive’s seat pick', () => {
  it('asks to choose a seat, with a Choose button, not a card to discard', () => {
    const glaive: PendingChoice = {
      id: 'trident-glaive-seat-0-3', seatId: 'seat-0', verb: 'pick', options: [{ id: 'seat-2', shows: { kind: 'seat', seatId: 'seat-2' }, effects: [] }],
      reason: { kind: 'ability', owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'tg' }, abilityId: 'trident-glaive', targetSeatId: 'seat-1' },
    };
    expect(describeChoice(state(glaive), 'seat-0')).toEqual({ title: 'Trident Glaive', prompt: 'Choose a seat', confirmLabel: 'Choose' });
  });
});

describe('Ascertain’s secret look', () => {
  let stageId = 'ascertain-pick-b1-seat-1-0';
  const look = (options: ChoiceOption[]): PendingChoice => ({
    id: stageId, seatId: 'seat-0', verb: 'pick', secret: true, options,
    reason: { kind: 'choice', card: { as: 'ascertain', colour: 'black', physical: [] }, userSeatId: 'seat-0', targetSeatId: 'seat-1' },
  });
  const label = (id: string, text: string): ChoiceOption => ({ id, shows: { kind: 'label', text }, effects: [] });
  const peach = { instanceId: 'b1', definitionId: 'peach', suit: 'heart' as const, rank: 4 };
  const done = label('done', 'Done');

  it('asks what to look at, then says what is shown', () => {
    const titled = (c: PendingChoice) => describeChoice(state(c), 'seat-0');
    expect(titled(look([label('main', 'Main General'), label('hand', 'Hand Cards')]))).toEqual({ title: 'Ascertain', prompt: "Choose which of Seat 1's cards to look at", confirmLabel: 'Choose' });
    expect(titled(look([{ id: 'b1', shows: { kind: 'card', card: peach }, effects: [] }, done]))!.prompt).toBe("These are Seat 1's hand cards");
    expect(titled(look([done]))!.prompt).toBe('Seat 1 has no hand cards');
    expect(titled(look([{ id: 'general', shows: { kind: 'general', generalId: 'cao-cao' }, effects: [] }, done]))!.prompt).toBe("This is Seat 1's hidden General");
  });

  it('closes the look stage with Done, and the pick stage with Choose', () => {
    stageId = 'ascertain-look-b1-seat-1-1';
    expect(describeChoice(state(look([done])), 'seat-0')!.confirmLabel).toBe('Done');
    stageId = 'ascertain-pick-b1-seat-1-0';
    expect(describeChoice(state(look([label('main', 'Main General'), label('hand', 'Hand Cards')])), 'seat-0')!.confirmLabel).toBe('Choose');
  });

  it('labels the options, and shows a General by name with its art', () => {
    expect(choiceOptionLabel({ kind: 'general', generalId: 'cao-cao' }, players)).toBe('Cao Cao');
    const options = look([label('main', 'Main General'), label('deputy', 'Deputy General'), label('hand', 'Hand Cards'), { id: 'general', shows: { kind: 'general', generalId: 'cao-cao' }, effects: [] }, done]).options;
    const legal: Action[] = options.map((o) => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'a', optionId: o.id }));
    const shown = choiceDialogOptions(options, legal, players);
    expect(shown.map((o) => o.label)).toEqual(['Main General', 'Deputy General', 'Hand Cards', 'Cao Cao', 'Done']);
    expect(shown[3].generalId).toBe('cao-cao');
  });
});
