import { Action, CardInstance, ChoiceOption, GameState, PendingChoice, PendingSelection } from 'engine';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { describeAsk, describeSelection } from './ability-description';
import { describeChoice } from './choice-description';

// A translator that speaks Vietnamese, and one that has the Vietnamese catalog but no locale.
const trVi = makeTranslator(vi, 'vi');
const trCatalogOnly = makeTranslator(vi);
const both = <T>(build: (translator?: typeof trVi) => T): { en: T; vi: T } => ({ en: build(), vi: build(trVi) });

const axe: CardInstance = { instanceId: 'ax', definitionId: 'axe', suit: 'diamond', rank: 5 };
const equipmentOwner = { kind: 'equipment' as const, seatId: 'seat-0', cardInstanceId: 'ax' };
const general = (skillId: string) => ({ kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId });

function state(o: { pendingChoice?: PendingChoice; pendingSelection?: PendingSelection } = {}): GameState {
  return {
    seats: [], log: [], pendingResponse: null, result: null, generalSelection: null, phase: 'Play',
    players: [
      { id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot', name: 'Seat 1' },
    ],
    zones: [{ id: 'seat-0:equip', kind: 'equip', ownerSeatId: 'seat-0', cards: [axe] }],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, rng: { seed: 1, counter: 0 },
    ...o,
  };
}

describe('an ability hint', () => {
  const ask = (targetSeatId?: string): PendingChoice => ({
    id: 'ask', seatId: 'seat-0', verb: 'use',
    reason: { kind: 'ability', owner: equipmentOwner, abilityId: 'axe', ...(targetSeatId ? { targetSeatId } : {}) },
    options: [{ id: 'use', shows: { kind: 'use' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
  });
  const asked: Action[] = ['use', 'decline'].map((optionId) => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId }));

  it('is Vietnamese with a Vietnamese translator, with the target named', () => {
    expect(both((t) => describeAsk(state({ pendingChoice: ask('seat-1') }), 'seat-0', asked, t)!.hint)).toEqual({
      en: 'Discard 2 cards to make your Sha hit Seat 1',
      vi: 'Bỏ 2 lá bài để Sát của bạn trúng Seat 1',
    });
  });

  it('names "the target" in the viewer’s language when no seat is named', () => {
    expect(both((t) => describeAsk(state({ pendingChoice: ask() }), 'seat-0', asked, t)!.hint)).toEqual({
      en: 'Discard 2 cards to make your Sha hit the target',
      vi: 'Bỏ 2 lá bài để Sát của bạn trúng mục tiêu',
    });
  });

  it('stays English when the translator has the catalog but no locale', () => {
    expect(describeAsk(state({ pendingChoice: ask('seat-1') }), 'seat-0', asked, trCatalogOnly)!.hint).toBe('Discard 2 cards to make your Sha hit Seat 1');
  });
});

describe('a skill’s selection text', () => {
  const selection = (abilityId: string, over: Partial<PendingSelection>): PendingSelection => ({
    id: 's1', seatId: 'seat-0', reason: { kind: 'ability', owner: general(abilityId), abilityId }, of: 'cards', eligibleIds: [], min: 1, max: 2,
    then: { kind: 'give', toSeatIds: ['seat-1'] }, ...over,
  });
  const template: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's1', ids: [] };
  const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's1' };
  const describe2 = (sel: PendingSelection, t?: typeof trVi) => describeSelection(state({ pendingSelection: sel }), 'seat-0', [template, cancel], t)!;

  it('uses the skill’s own words, button and cancel label', () => {
    expect(both((t) => { const d = describe2(selection('bestowed-rouse', {}), t); return [d.prompt, d.confirmLabel, d.cancelLabel]; })).toEqual({
      en: ['Choose drawn cards to give away', 'Give', 'Keep the Rest'],
      vi: ['Chọn các lá bài vừa rút để đưa đi', 'Đưa', 'Giữ phần còn lại'],
    });
  });

  it('a step’s text wins, and the cancel label falls back to the catalog', () => {
    const step = { kind: 'SkillStepEffect' as const, owner: general('heavens-justice'), step: 'compete-user', data: {} };
    const competing = selection('heavens-justice', { then: { kind: 'skill-step', step } });
    expect(both((t) => { const d = describe2(competing, t); return [d.prompt, d.confirmLabel, d.cancelLabel]; })).toEqual({
      en: ['Choose a hand card to compete with', 'Compete', 'Cancel'],
      vi: ['Chọn một lá bài trên tay để đấu điểm', 'Đấu điểm', 'Hủy'],
    });
  });

  it('a skill with no text of its own uses the catalog sentences', () => {
    expect(both((t) => describe2(selection('some-skill', { min: 2, max: 2, then: { kind: 'discard' } }), t).prompt)).toEqual({
      en: 'Choose 2 cards to discard',
      vi: 'Chọn 2 lá bài để bỏ',
    });
  });
});

describe('a skill’s pick prompt', () => {
  const seatOption: ChoiceOption = { id: 'seat-1', shows: { kind: 'seat', seatId: 'seat-1' }, effects: [] };
  const labelOption: ChoiceOption = { id: 'pass', shows: { kind: 'label', text: 'Pass' }, effects: [] };
  const pick = (skillId: string, options: ChoiceOption[], targetSeatId?: string): PendingChoice => ({
    id: 'k', seatId: 'seat-0', verb: 'pick', options,
    reason: { kind: 'ability', owner: general(skillId), abilityId: skillId, ...(targetSeatId ? { targetSeatId } : {}) },
  });

  it('a seat pick in the skill’s own words, with its target named', () => {
    expect(both((t) => describeChoice(state({ pendingChoice: pick('rouse-the-tiger', [seatOption], 'seat-1') }), 'seat-0', t)!.prompt)).toEqual({
      en: 'Choose a seat for Seat 1 to damage',
      vi: 'Chọn một người chơi để Seat 1 gây sát thương',
    });
  });

  it('a seat pick with no target names "a seat" in the viewer’s language', () => {
    expect(both((t) => describeChoice(state({ pendingChoice: pick('rouse-the-tiger', [seatOption]) }), 'seat-0', t)!.prompt)).toEqual({
      en: 'Choose a seat for a seat to damage',
      vi: 'Chọn một người chơi để một người chơi gây sát thương',
    });
  });

  it('a mixed pick uses the skill’s fixed prompt', () => {
    expect(both((t) => describeChoice(state({ pendingChoice: pick('upheaval', [seatOption, labelOption]) }), 'seat-0', t)!.prompt)).toEqual({
      en: 'Choose a seat to play a Sha at, or pass',
      vi: 'Chọn một người chơi để ra Sát vào, hoặc bỏ qua',
    });
  });

  it('a skill with no text of its own uses the catalog prompt', () => {
    expect(both((t) => describeChoice(state({ pendingChoice: pick('some-skill', [seatOption]) }), 'seat-0', t)!.prompt)).toEqual({
      en: 'Choose a seat',
      vi: 'Chọn một người chơi',
    });
  });
});
