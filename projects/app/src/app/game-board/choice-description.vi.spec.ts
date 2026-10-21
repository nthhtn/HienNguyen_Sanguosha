import { ChoiceOption, GameState, PendingChoice } from 'engine';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { choiceDialogOptions, choiceOptionLabel, describeChoice, translateLabelText } from './choice-description';

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
  it('Brave Spirit: the owner chooses how the picked seat draws and discards', () => {
    const labels: ChoiceOption[] = [{ id: 'a', shows: { kind: 'label', text: 'A' }, effects: [] }, { id: 'b', shows: { kind: 'label', text: 'B' }, effects: [] }];
    expect(describeChoice(state(skill('brave-spirit', 'pick', 'seat-1', labels)), 'seat-0', makeTranslator(vi, 'vi'))).toMatchObject({ prompt: 'Chọn cách Người chơi 1 rút bài và bỏ bài' });
  });

  it('a skill discarding from another seat', () => {
    expect(describeChoice(state(skill('sudden-attack', 'discard', 'seat-1')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một lá bài của Người chơi 1 để bỏ', confirmLabel: 'Bỏ bài' });
  });

  it('a Tool taking from another seat', () => {
    expect(describeChoice(state(toolChoice('take', 'seat-1')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một lá bài để lấy từ Người chơi 1', confirmLabel: 'Lấy' });
  });

  it('a verb other than take or discard keeps its own wording, in English and Vietnamese', () => {
    expect(describeChoice(state(toolChoice('use')), 'seat-0')).toMatchObject({ prompt: 'Choose a card to use' });
    expect(describeChoice(state(toolChoice('use')), 'seat-0', tr)).toMatchObject({ prompt: 'Chọn một lá bài để dùng' });
    expect(describeChoice(state(toolChoice('give', 'seat-1')), 'seat-0')).toMatchObject({ prompt: 'Choose a card to give from Seat 1' });
  });

  it('believe or doubt a claim', () => {
    const doubt = skill('bewilder', 'pick', undefined, [{ id: 'believe', shows: { kind: 'label', text: 'Believe' }, effects: [] }], 'sha');
    doubt.reason = { kind: 'ability', owner: { kind: 'general', seatId: 'seat-1', slot: 'main', skillId: 'bewilder' }, abilityId: 'bewilder', cardId: 'sha' };
    expect(describeChoice(state(doubt), 'seat-0', tr)).toMatchObject({ prompt: 'Người chơi 1 tuyên bố có Slash. Tin hay nghi ngờ?', confirmLabel: 'Chọn' });
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
      prompt: 'Bỏ một lá bài trên tay, hoặc để Người chơi 1 rút 1 lá bài',
      confirmLabel: 'Bỏ bài',
      declineLabel: 'Để Người chơi 1 rút bài',
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
    expect(hand(1)).toBe('Bài trên tay của Người chơi 1 (1 lá)');
    expect(hand(2)).toBe('Bài trên tay của Người chơi 1 (2 lá)');
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

describe('the engine’s fixed label options', () => {
  const trVi = makeTranslator(vi, 'vi');
  const label = (id: string, text: string, translator?: typeof trVi) => choiceOptionLabel({ kind: 'label', text }, players, undefined, translator, id);

  it('read in Vietnamese, with their numbers', () => {
    expect(label('doubt', 'Doubt', trVi)).toBe('Nghi ngờ');
    expect(label('believe', 'Believe', trVi)).toBe('Tin');
    expect(label('lose-hp', 'Lose 1 HP', trVi)).toBe('Mất 1 Sinh lực');
    expect(label('draw-x', 'Draw 3, Then Discard 1', trVi)).toBe('Rút 3 lá bài, rồi bỏ 1 lá');
    expect(label('draw-1', 'Draw 1, Then Discard 3', trVi)).toBe('Rút 1 lá bài, rồi bỏ 3 lá');
    expect(label('pass', 'Pass (Lose 1 HP)', trVi)).toBe('Bỏ qua (mất 1 Sinh lực)');
    expect(label('cancel', 'Cancel', trVi)).toBe('Hủy');
    expect(label('cancel', 'Cancel')).toBe('Cancel');
  });

  it('keep the engine’s English in English, for an unknown id, and when the text differs from the template', () => {
    expect(label('doubt', 'Doubt')).toBe('Doubt');
    expect(label('doubt', 'Doubt', makeTranslator(vi))).toBe('Nghi ngờ');
    expect(label('something-else', 'Anything', trVi)).toBe('Anything');
    expect(label('doubt', 'Suspect', trVi)).toBe('Suspect');
    expect(choiceOptionLabel({ kind: 'label', text: 'Doubt' }, players, undefined, trVi)).toBe('Doubt');
  });

  it('name a Form’s skill and its General in Vietnamese', () => {
    expect(label('guan-yu/fighting-saint', 'Fighting Saint (Guan Yu)', trVi)).toBe('Võ thánh (Quan Vũ)');
    expect(label('guan-yu/fighting-saint', 'Fighting Saint (Guan Yu)')).toBe('Fighting Saint (Guan Yu)');
  });
});

describe('the Action History wording of a label the engine sent', () => {
  const trVi = makeTranslator(vi, 'vi');
  it('is found from the text alone', () => {
    expect(translateLabelText('Lose 1 HP', trVi)).toBe('Mất 1 Sinh lực');
    expect(translateLabelText('Draw 3, Then Discard 1', trVi)).toBe('Rút 3 lá bài, rồi bỏ 1 lá');
    expect(translateLabelText('Draw 1, Then Discard 3', trVi)).toBe('Rút 1 lá bài, rồi bỏ 3 lá');
    expect(translateLabelText('Reduce Max HP by 1', trVi)).toBe('Giảm Sinh lực tối đa đi 1');
  });
  it('is the text itself for an unknown label', () => {
    expect(translateLabelText('Something else', trVi)).toBe('Something else');
  });
});

describe('Ascertain’s secret look in Vietnamese', () => {
  const viTr = makeTranslator(vi, 'vi');
  const label = (id: string, text: string): ChoiceOption => ({ id, shows: { kind: 'label', text }, effects: [] });
  const look = (options: ChoiceOption[]): PendingChoice => ({
    id: 'a', seatId: 'seat-0', verb: 'pick', secret: true, options,
    reason: { kind: 'choice', card: { as: 'ascertain', colour: 'black', physical: [] }, userSeatId: 'seat-0', targetSeatId: 'seat-1' },
  });

  it('names the card, asks what to look at and labels the options', () => {
    const pick = look([label('main', 'Main General'), label('deputy', 'Deputy General'), label('hand', 'Hand Cards')]);
    expect(describeChoice(state(pick), 'seat-0', viTr)).toEqual({ title: 'Tri Kỷ Tri Bỉ', prompt: 'Chọn lá bài của Người chơi 1 để xem', confirmLabel: 'Chọn' });
    expect(pick.options.map((o) => choiceOptionLabel(o.shows, players, undefined, viTr, o.id))).toEqual(['Chủ tướng', 'Phó tướng', 'Bài trên tay']);
    expect(choiceOptionLabel({ kind: 'label', text: 'Done' }, players, undefined, viTr, 'done')).toBe('Xong');
    expect(choiceOptionLabel({ kind: 'general', generalId: 'cao-cao' }, players, undefined, viTr)).toBe('Tào Tháo');
    expect(describeChoice(state(look([{ id: 'general', shows: { kind: 'general', generalId: 'cao-cao' }, effects: [] }, label('done', 'Done')])), 'seat-0', viTr)!.prompt).toBe('Đây là Tướng úp của Người chơi 1');
  });
});

describe('Trident Glaive’s seat pick in Vietnamese', () => {
  it('asks to choose a seat, with a Choose button', () => {
    const glaive: PendingChoice = {
      id: 'tg', seatId: 'seat-0', verb: 'pick', options: [seatOption],
      reason: { kind: 'ability', owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'tg' }, abilityId: 'trident-glaive', targetSeatId: 'seat-1' },
    };
    expect(describeChoice(state(glaive), 'seat-0', makeTranslator(vi, 'vi'))).toMatchObject({ prompt: 'Chọn một người chơi', confirmLabel: 'Chọn' });
  });
});
