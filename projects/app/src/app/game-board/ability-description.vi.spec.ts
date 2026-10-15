import { Action, CardInstance, GameState, PendingChoice, PendingSelection } from 'engine';
import { makeTranslator } from '../i18n/translator';
import { vi } from '../i18n/vi';
import { describeArrangement, describeAsk, describeSelection } from './ability-description';

const tr = makeTranslator(vi);
const axe: CardInstance = { instanceId: 'ax', definitionId: 'axe', suit: 'diamond', rank: 5 };
const peach: CardInstance = { instanceId: 'p1', definitionId: 'peach', suit: 'heart', rank: 3 };
const sha: CardInstance = { instanceId: 's2', definitionId: 'sha', suit: 'spade', rank: 7 };
const owner = { kind: 'equipment' as const, seatId: 'seat-0', cardInstanceId: 'ax' };

function state(o: { pendingChoice?: PendingChoice; pendingSelection?: PendingSelection } = {}): GameState {
  return {
    seats: [], log: [], pendingResponse: null, result: null, generalSelection: null, phase: 'Play',
    players: [
      { id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot', name: 'Seat 1' },
    ],
    zones: [
      { id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: [peach, sha] },
      { id: 'seat-0:equip', kind: 'equip', ownerSeatId: 'seat-0', cards: [axe] },
    ],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, rng: { seed: 1, counter: 0 },
    ...o,
  };
}
const ask = (abilityId: string, targetSeatId?: string): PendingChoice => ({
  id: 'ask', seatId: 'seat-0', verb: 'use',
  reason: { kind: 'ability', owner, abilityId, ...(targetSeatId ? { targetSeatId } : {}) },
  options: [{ id: 'use', shows: { kind: 'use' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
});
const asked: Action[] = ['use', 'decline'].map((optionId) => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId }));

describe('describeAsk in Vietnamese', () => {
  it('names the ability and its target', () => {
    expect(describeAsk(state({ pendingChoice: ask('axe', 'seat-1') }), 'seat-0', asked, tr)).toMatchObject({
      prompt: 'Dùng Axe lên Seat 1?',
      hint: 'Discard 2 cards to make your Sha hit Seat 1',
      useLabel: 'Dùng',
    });
  });

  it('asks without a target, and a hint falls back to "the target"', () => {
    const description = describeAsk(state({ pendingChoice: ask('axe') }), 'seat-0', asked, tr);
    expect(description).toMatchObject({ prompt: 'Dùng Axe?', hint: 'Discard 2 cards to make your Sha hit mục tiêu' });
    expect(describeAsk(state({ pendingChoice: ask('axe') }), 'seat-0', asked)).toMatchObject({ prompt: 'Use Axe?', hint: 'Discard 2 cards to make your Sha hit the target' });
  });

  it('a hidden General’s skill asks to reveal it', () => {
    const general = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'fighting-saint' };
    const revealAsk: PendingChoice = {
      id: 'ask', seatId: 'seat-0', verb: 'use',
      reason: { kind: 'ability', owner: general, abilityId: 'fighting-saint' },
      options: [{ id: 'use', shows: { kind: 'use', reveals: 'main' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
    };
    const seated = state({ pendingChoice: revealAsk });
    seated.seats = [{
      id: 'seat-0', index: 0, kingdom: 'Shu', combinedHp: 4, maxCombinedHp: 4, eliminated: false,
      generals: { main: { generalDefinitionId: 'guan-yu', revealed: false }, deputy: { generalDefinitionId: 'zhang-fei', revealed: true } },
      hand: { zoneId: 'seat-0:hand' }, equipped: { zoneId: 'seat-0:equip' }, judgment: { zoneId: 'seat-0:judgment' },
    }];
    expect(describeAsk(seated, 'seat-0', asked, tr)).toMatchObject({ prompt: 'Lật Guan Yu để dùng Fighting Saint?', useLabel: 'Lật Tướng và dùng' });
  });
});

describe('describeSelection in Vietnamese', () => {
  const template: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's1', ids: [] };
  const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's1' };
  const selection = (over: Partial<PendingSelection>): PendingSelection => ({
    id: 's1', seatId: 'seat-0', reason: { kind: 'ability', owner, abilityId: 'axe' }, of: 'cards', eligibleIds: ['p1', 's2'], min: 2, max: 2, then: { kind: 'discard' }, ...over,
  });
  const describe2 = (sel: PendingSelection) => describeSelection(state({ pendingSelection: sel }), 'seat-0', [template, cancel], tr);
  // No translator passed: the builder's English default.
  const describeEn = (sel: PendingSelection) => describeSelection(state({ pendingSelection: sel }), 'seat-0', [template, cancel]);

  it('discard: an exact count, an "up to" count, and one card', () => {
    expect(describe2(selection({}))).toMatchObject({ title: 'Axe', prompt: 'Chọn 2 lá bài để bỏ', confirmLabel: 'Bỏ bài', cancelLabel: 'Hủy' });
    expect(describe2(selection({ min: 1, max: 3 }))).toMatchObject({ prompt: 'Chọn tối đa 3 lá bài để bỏ' });
    expect(describe2(selection({ min: 1, max: 1 }))).toMatchObject({ prompt: 'Chọn 1 lá bài để bỏ' });
    expect(describeEn(selection({ min: 1, max: 3 }))).toMatchObject({ prompt: 'Choose up to 3 cards to discard', confirmLabel: 'Discard', cancelLabel: 'Cancel' });
    expect(describeEn(selection({ min: 1, max: 1 }))).toMatchObject({ prompt: 'Choose 1 card to discard' });
  });

  it('use as a Tool, and play a card at a seat', () => {
    expect(describe2(selection({ then: { kind: 'use-card', as: 'sha', targets: [], counted: true } }))).toMatchObject({ prompt: 'Chọn 2 lá bài trên tay để dùng làm Sha', confirmLabel: 'Dùng' });
    expect(describe2(selection({ min: 1, max: 1, eligibleIds: ['s2'], then: { kind: 'use-card', targets: [{ kind: 'seat', seatId: 'seat-1' }], counted: false, free: true } }))).toMatchObject({ prompt: 'Chọn Sha để đánh vào Seat 1' });
    expect(describeEn(selection({ min: 1, max: 1, eligibleIds: ['s2'], then: { kind: 'use-card', targets: [{ kind: 'seat', seatId: 'seat-1' }], counted: false, free: true } }))).toMatchObject({ prompt: 'Choose a Sha to play at Seat 1' });
  });

  it('give: one card, and several', () => {
    expect(describe2(selection({ min: 1, max: 1, then: { kind: 'give', toSeatIds: ['seat-1'] } }))).toMatchObject({ prompt: 'Chọn một lá bài để đưa', confirmLabel: 'Đưa' });
    expect(describeEn(selection({ then: { kind: 'give', toSeatIds: ['seat-1'] } }))).toMatchObject({ prompt: 'Choose cards to give' });
  });

  it('use as a Tool: one card', () => {
    const one = selection({ min: 1, max: 1, then: { kind: 'use-card', as: 'sha', targets: [], counted: true } });
    expect(describe2(one)).toMatchObject({ prompt: 'Chọn một lá bài để dùng làm Sha' });
    expect(describeEn(one)).toMatchObject({ prompt: 'Choose a card to use as Sha' });
  });

  it('play a card with no target seat', () => {
    const play = selection({ min: 1, max: 1, eligibleIds: ['s2'], then: { kind: 'use-card', targets: [], counted: false, free: true } });
    expect(describe2(play)).toMatchObject({ prompt: 'Chọn Sha để đánh' });
    expect(describeEn(play)).toMatchObject({ prompt: 'Choose a Sha to play' });
  });

  it('more targets: one, and several, with the Add Targets button', () => {
    const blaze = { as: 'blaze', colour: 'red' as const, physical: [] };
    const step = { kind: 'CardStepEffect' as const, step: 'unnamed-step', card: blaze, userSeatId: 'seat-1', target: { kind: 'seat' as const, seatId: 'seat-0' } };
    const reason = { kind: 'choice' as const, card: blaze, userSeatId: 'seat-1', targetSeatId: 'seat-0' };
    const targets = (max: number) => selection({ reason, min: max, max, then: { kind: 'card-step', step } });
    expect(describe2(targets(1))).toMatchObject({ prompt: 'Chọn thêm 1 mục tiêu', confirmLabel: 'Thêm mục tiêu' });
    expect(describeEn(targets(1))).toMatchObject({ prompt: 'Choose 1 more target', confirmLabel: 'Add Targets' });
    expect(describeEn(targets(2))).toMatchObject({ prompt: 'Choose 2 more targets' });
  });

  it('a skill step with no words of its own: seats and cards, one and several', () => {
    const general = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'some-skill' };
    const step = { kind: 'SkillStepEffect' as const, owner: general, step: 'unnamed-step', data: {} };
    const pick = (of: 'cards' | 'seats', max: number) =>
      selection({ reason: { kind: 'ability', owner: general, abilityId: 'some-skill' }, of, min: max, max, then: { kind: 'skill-step', step } });
    expect(describe2(pick('seats', 1))).toMatchObject({ prompt: 'Chọn 1 người chơi', confirmLabel: 'Xác nhận' });
    expect(describe2(pick('cards', 2))).toMatchObject({ prompt: 'Chọn 2 lá bài' });
    expect(describeEn(pick('seats', 1))).toMatchObject({ prompt: 'Choose 1 seat', confirmLabel: 'Confirm' });
    expect(describeEn(pick('seats', 2))).toMatchObject({ prompt: 'Choose 2 seats' });
    expect(describeEn(pick('cards', 1))).toMatchObject({ prompt: 'Choose 1 card' });
    expect(describeEn(pick('cards', 2))).toMatchObject({ prompt: 'Choose 2 cards' });
  });

  it('falls back to a plain title and a plain card label', () => {
    const plain = selection({ reason: { kind: 'dying', seatId: 'seat-0' }, eligibleIds: ['gone'] });
    expect(describe2(plain)).toMatchObject({ title: 'Chọn', items: [{ id: 'gone', label: 'Lá bài' }] });
    expect(describeEn(plain)).toMatchObject({ title: 'Choose', items: [{ id: 'gone', label: 'Card' }] });
  });

  it('labels each card of the selection by name and face', () => {
    expect(describe2(selection({}))?.items).toEqual([{ id: 'p1', card: peach, label: 'Peach (3 ♥)' }, { id: 's2', card: sha, label: 'Sha (7 ♠)' }]);
  });
});

describe('describeArrangement in Vietnamese', () => {
  const owner2 = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'astrology' };
  const template: Action = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };
  it('says where each card goes', () => {
    const s = state();
    s.zones = [...s.zones, { id: 'drawPile', kind: 'drawPile', cards: [sha, peach] }];
    s.pendingArrangement = { id: 'arr', seatId: 'seat-0', reason: { kind: 'ability', owner: owner2, abilityId: 'astrology' }, cardInstanceIds: ['s2', 'p1'] };
    expect(describeArrangement(s, 'seat-0', [template], tr)).toMatchObject({
      title: 'Astrology',
      prompt: 'Đặt mỗi lá bài lên trên chồng bài rút hoặc xuống dưới cùng. Từ trái sang phải là thứ tự đặt.',
    });
  });

  it('falls back to a plain title when no skill asked', () => {
    const s = state();
    s.zones = [...s.zones, { id: 'drawPile', kind: 'drawPile', cards: [sha] }];
    s.pendingArrangement = { id: 'arr', seatId: 'seat-0', reason: { kind: 'dying', seatId: 'seat-0' }, cardInstanceIds: ['s2'] };
    expect(describeArrangement(s, 'seat-0', [template], tr)).toMatchObject({ title: 'Sắp xếp' });
    expect(describeArrangement(s, 'seat-0', [template])).toMatchObject({ title: 'Arrange' });
  });
});
