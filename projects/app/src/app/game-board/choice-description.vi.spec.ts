import { ChoiceOption, GameState, PendingChoice } from 'engine';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { choiceDialogOptions, choiceOptionLabel, describeChoice } from './choice-description';

const tr = makeTranslator(vi);
const players = [
  { id: 'p0', seatId: 'seat-0', kind: 'human' as const, name: 'Hing' },
  { id: 'p1', seatId: 'seat-1', kind: 'bot' as const, name: 'Seat 1' },
];
const state = (pendingChoice: PendingChoice): GameState => ({
  seats: [], zones: [], log: [], pendingResponse: null, result: null, generalSelection: null, phase: 'Play', players,
  turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, rng: { seed: 1, counter: 0 }, pendingChoice,
});
const seatOption: ChoiceOption = { id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] };
const skill = (skillId: string, verb: PendingChoice['verb'], targetSeatId?: string, options: ChoiceOption[] = [seatOption], cardId?: string): PendingChoice => ({
  id: 'k', seatId: 'seat-0', verb, options,
  reason: { kind: 'ability', owner: { kind: 'general', seatId: 'seat-0', slot: 'main', skillId }, abilityId: skillId, ...(targetSeatId ? { targetSeatId } : {}), ...(cardId ? { cardId } : {}) },
});
const toolChoice = (verb: PendingChoice['verb'], targetSeatId?: string, options: ChoiceOption[] = []): PendingChoice => ({
  id: 'c', seatId: 'seat-0', verb, options,
  reason: { kind: 'choice', card: { as: 'steal', colour: 'black', physical: [] }, userSeatId: 'seat-1', ...(targetSeatId ? { targetSeatId } : {}) },
});

describe('describeChoice in Vietnamese', () => {
  it('a skill discarding from another seat', () => {
    expect(describeChoice(state(skill('sudden-attack', 'discard', 'seat-1')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một lá bài của Seat 1 để bỏ', confirmLabel: 'Bỏ bài' });
  });

  it('a Tool taking from another seat', () => {
    expect(describeChoice(state(toolChoice('take', 'seat-1')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một lá bài để lấy từ Seat 1', confirmLabel: 'Lấy' });
  });

  it('a verb other than take or discard keeps its own wording, in English and Vietnamese', () => {
    expect(describeChoice(state(toolChoice('use')), 'seat-0')).toMatchObject({ prompt: 'Choose a card to use' });
    expect(describeChoice(state(toolChoice('use')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một lá bài để dùng' });
    expect(describeChoice(state(toolChoice('give', 'seat-1')), 'seat-0')).toMatchObject({ prompt: 'Choose a card to give from Seat 1' });
  });

  it('believe or doubt a claim', () => {
    const doubt = skill('bewilder', 'pick', undefined, [{ id: 'believe', shows: { kind: 'label', text: 'Believe' }, effects: [] }], 'sha');
    doubt.reason = { kind: 'ability', owner: { kind: 'general', seatId: 'seat-1', slot: 'main', skillId: 'bewilder' }, abilityId: 'bewilder', cardId: 'sha' };
    expect(describeChoice(state(doubt), 'seat-0', tr)).toMatchObject({ prompt: 'Seat 1 tuyên bố có Sha. Tin hay nghi ngờ?', confirmLabel: 'Chọn' });
  });

  it('gives cards, and picks a seat, a suit or one of several', () => {
    expect(describeChoice(state(skill('some-skill', 'give')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn người nhận các lá bài', confirmLabel: 'Đưa' });
    expect(describeChoice(state(skill('some-skill', 'pick')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một người chơi' });
    const suit: ChoiceOption = { id: 'heart', shows: { kind: 'suit', suit: 'heart' }, effects: [] };
    expect(describeChoice(state(skill('some-skill', 'pick', undefined, [suit])), 'seat-0', tr)).toMatchObject({ prompt: 'Gọi tên một chất' });
    expect(describeChoice(state(skill('some-skill', 'pick', undefined, [suit, seatOption])), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một' });
  });

  it('Gender Swords: discard a hand card or let the user draw', () => {
    const options: ChoiceOption[] = [{ id: 'decline', shows: { kind: 'decline' }, effects: [] }];
    expect(describeChoice(state(toolChoice('discard', 'seat-0', options)), 'seat-0', tr)).toMatchObject({
      prompt: 'Bỏ một lá bài trên tay, hoặc để Seat 1 rút 1 lá bài',
      confirmLabel: 'Bỏ bài',
      declineLabel: 'Để Seat 1 rút bài',
    });
  });
});

describe('choice options in Vietnamese', () => {
  it('labels use and decline', () => {
    expect(choiceOptionLabel({ kind: 'use' }, players, undefined, tr)).toBe('Dùng');
    expect(choiceOptionLabel({ kind: 'decline' }, players, undefined, tr)).toBe('Không');
    expect(choiceOptionLabel({ kind: 'decline' }, players)).toBe("Don't");
  });

  it('labels a face-down hand by its owner and size, singular and plural', () => {
    const hand = (count: number) => choiceOptionLabel({ kind: 'hidden-hand', seatId: 'seat-1', count }, players, undefined, tr);
    expect(hand(1)).toBe('Bài trên tay của Seat 1 (1 lá)');
    expect(hand(2)).toBe('Bài trên tay của Seat 1 (2 lá)');
    expect(choiceOptionLabel({ kind: 'hidden-hand', seatId: 'seat-1', count: 1 }, players)).toBe("Seat 1's Hand (1 Card)");
    expect(choiceOptionLabel({ kind: 'hidden-hand', seatId: 'seat-1', count: 2 }, players)).toBe("Seat 1's Hand (2 Cards)");
  });

  it('numbers the face-down cards of a hand', () => {
    const option: ChoiceOption = { id: 'h', shows: { kind: 'hidden-hand', seatId: 'seat-1', count: 2 }, effects: [] };
    const legal = [{ kind: 'ChooseOptionAction' as const, seatId: 'seat-0', choiceId: 'c', optionId: 'h' }];
    expect(choiceDialogOptions([option], legal, players, undefined, [], tr).map((o) => o.label)).toEqual(['Lá bài trên tay 1', 'Lá bài trên tay 2']);
    expect(choiceDialogOptions([option], legal, players).map((o) => o.label)).toEqual(['Hand Card 1', 'Hand Card 2']);
  });
});
