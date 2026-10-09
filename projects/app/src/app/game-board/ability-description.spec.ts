import { Action, CardInstance, GameState, PendingChoice, PendingSelection } from 'engine';
import { describeArrangement, describeAsk, describeSelection } from './ability-description';

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
      { id: 'p2', seatId: 'seat-2', kind: 'bot', name: 'Seat 2' },
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

describe('describeAsk', () => {
  it('names the ability and its target, says what it does, and shows the worn card', () => {
    expect(describeAsk(state({ pendingChoice: ask('axe', 'seat-1') }), 'seat-0', asked)).toEqual({
      title: 'Axe',
      prompt: 'Use Axe on Seat 1?',
      hint: 'Discard 2 cards to make your Sha hit Seat 1',
      card: axe,
      generalId: null,
      useLabel: 'Use',
      use: asked[0],
      decline: asked[1],
    });
  });

  it('a hidden General’s skill: shows the General and asks to reveal it', () => {
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
    expect(describeAsk(seated, 'seat-0', asked)).toMatchObject({
      title: 'Fighting Saint',
      prompt: 'Reveal Guan Yu to use Fighting Saint?',
      useLabel: 'Reveal and Use',
      generalId: 'guan-yu',
      card: null,
    });
  });

  it('leaves out a target that is the viewer', () => {
    expect(describeAsk(state({ pendingChoice: ask('eight-trigrams', 'seat-0') }), 'seat-0', asked)).toMatchObject({ prompt: 'Use Eight Trigrams?' });
  });

  it('is null for another seat’s ask, or for a choice that isn’t an ask', () => {
    expect(describeAsk(state({ pendingChoice: ask('axe') }), 'seat-1', asked)).toBeNull();
    expect(describeAsk(state({ pendingChoice: { ...ask('axe'), verb: 'discard', reason: { kind: 'choice', card: { as: 'break', colour: 'black', physical: [] }, userSeatId: 'seat-0' } } }), 'seat-0', asked)).toBeNull();
  });
});

describe('describeSelection', () => {
  const template: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's1', ids: [] };
  const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's1' };
  const selection = (abilityId: string, over: Partial<PendingSelection>): PendingSelection => ({
    id: 's1', seatId: 'seat-0', reason: { kind: 'ability', owner, abilityId }, of: 'cards', eligibleIds: [], min: 2, max: 2, then: { kind: 'discard' }, ...over,
  });
  const describe2 = (sel: PendingSelection, legal: Action[] = [template, cancel]) => describeSelection(state({ pendingSelection: sel }), 'seat-0', legal);

  it("a skill's selection uses the skill's words", () => {
    const owner = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'bestowed-rouse' };
    const sel: PendingSelection = {
      id: 'sel', seatId: 'seat-0', reason: { kind: 'ability', owner, abilityId: 'bestowed-rouse' }, of: 'cards', eligibleIds: [], min: 1, max: 2,
      then: { kind: 'give', toSeatIds: ['seat-1'] }, onCancel: [],
    };
    expect(describe2(sel)).toMatchObject({ title: 'Bestowed Rouse', prompt: 'Choose drawn cards to give away', confirmLabel: 'Give', cancelLabel: 'Keep the Rest' });
  });

  it('Axe: choose 2 cards to discard, shown face up, with Cancel', () => {
    expect(describe2(selection('axe', { eligibleIds: ['p1', 's2'] }))).toEqual({
      title: 'Axe', prompt: 'Choose 2 cards to discard', confirmLabel: 'Discard', cancelLabel: 'Cancel', min: 2, max: 2,
      items: [{ id: 'p1', card: peach, label: 'Peach (3 ♥)' }, { id: 's2', card: sha, label: 'Sha (7 ♠)' }],
      template, cancel,
    });
  });

  it('Serpent Spear: 2 hand cards to use as Sha', () => {
    const sel = selection('serpent-spear', { eligibleIds: ['p1', 's2'], then: { kind: 'use-card', as: 'sha', targets: [], counted: true } });
    expect(describe2(sel)).toMatchObject({ title: 'Serpent Spear', prompt: 'Choose 2 hand cards to use as Sha', confirmLabel: 'Use' });
  });

  it('Green Dragon Blade: a Sha to play at its target', () => {
    const sel = selection('green-dragon-blade', { eligibleIds: ['s2'], min: 1, max: 1, then: { kind: 'use-card', targets: [{ kind: 'seat', seatId: 'seat-1' }], counted: false, free: true } });
    expect(describe2(sel)).toMatchObject({ prompt: 'Choose a Sha to play at Seat 1', confirmLabel: 'Use' });
  });

  it('competing: both seats are asked for a hand card to compete with', () => {
    const general = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'rouse-the-tiger' };
    for (const step of ['compete-user', 'compete-target']) {
      const sel = selection('rouse-the-tiger', { reason: { kind: 'ability', owner: general, abilityId: 'rouse-the-tiger', targetSeatId: 'seat-1' }, eligibleIds: ['s2'], min: 1, max: 1, then: { kind: 'skill-step', step: { kind: 'SkillStepEffect', owner: general, step, data: {} } } });
      expect(describe2(sel, [template])).toMatchObject({ title: 'Rouse the Tiger', prompt: 'Choose a hand card to compete with', confirmLabel: 'Compete' });
    }
  });

  it('Blaze: the target shows a card; the user may discard a match', () => {
    const blaze = { as: 'blaze', colour: 'red' as const, physical: [] };
    const step = (name: string) => ({ kind: 'CardStepEffect' as const, step: name, card: blaze, userSeatId: 'seat-1', target: { kind: 'seat' as const, seatId: 'seat-0' } });
    const reason = { kind: 'choice' as const, card: blaze, userSeatId: 'seat-1', targetSeatId: 'seat-0' };
    const shown = selection('x', { reason, eligibleIds: ['s2'], min: 1, max: 1, then: { kind: 'card-step', step: step('blaze-shown') } });
    expect(describe2(shown, [template])).toMatchObject({ title: 'Blaze', prompt: 'Choose a hand card to show', confirmLabel: 'Show' });
    const hit = selection('x', { reason, eligibleIds: ['s2'], min: 1, max: 1, then: { kind: 'card-step', step: step('blaze-hit') } });
    expect(describe2(hit)).toMatchObject({ title: 'Blaze', prompt: 'Discard a card of the same suit to deal 1 damage', confirmLabel: 'Discard', cancelLabel: 'Cancel' });
  });

  it('the Fire skills’ own selections', () => {
    const general = (skillId: string) => ({ kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId });
    const sel = (skillId: string, of: 'cards' | 'seats') => selection(skillId, { reason: { kind: 'ability', owner: general(skillId), abilityId: skillId }, of, eligibleIds: [], min: 1, max: 1, then: { kind: 'skill-step', step: { kind: 'SkillStepEffect', owner: general(skillId), step: 'chosen', data: {} } } });
    expect(describe2(sel('shackle', 'cards'))).toMatchObject({ prompt: 'Choose a club to discard, then draw 1', confirmLabel: 'Recast' });
    expect(describe2(sel('assault', 'cards'))).toMatchObject({ prompt: 'Choose a Weapon to discard', confirmLabel: 'Discard' });
    expect(describe2(sel('rouse-the-tiger', 'seats'))).toMatchObject({ prompt: 'Choose a seat with more HP to compete with', confirmLabel: 'Choose' });
    expect(describe2(sel('heavens-justice', 'seats'))).toMatchObject({ prompt: 'Choose a seat to compete with', confirmLabel: 'Choose' });
  });

  it('has no Cancel when the engine offers none, and is null for another seat', () => {
    expect(describe2(selection('axe', { eligibleIds: ['p1', 's2'] }), [template])?.cancel).toBeNull();
    expect(describeSelection(state({ pendingSelection: selection('axe', {}) }), 'seat-1', [])).toBeNull();
  });

  it('prompts for giving cards and for replacing a judgment', () => {
    const general = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'kindness' };
    const base: PendingSelection = { id: 'g', seatId: 'seat-0', reason: { kind: 'ability', owner: general, abilityId: 'kindness' }, of: 'cards', eligibleIds: ['p1'], min: 1, max: 2, then: { kind: 'give', toSeatIds: ['seat-1'] } };
    const template: Action[] = [{ kind: 'SelectAction', seatId: 'seat-0', selectionId: 'g', ids: [] }];
    expect(describeSelection(state({ pendingSelection: base }), 'seat-0', template)).toMatchObject({ title: 'Kindness', prompt: 'Choose cards to give', confirmLabel: 'Give' });
    const judgment = { seatId: 'seat-1', reader: { kind: 'card' as const, card: { as: 'capture', colour: 'red' as const, physical: [] } }, card: sha };
    const replace: PendingSelection = { ...base, reason: { ...base.reason, abilityId: 'devil' } as PendingSelection['reason'], then: { kind: 'replace-judgment', judgment, owner: general, abilityId: 'devil' } };
    expect(describeSelection(state({ pendingSelection: replace }), 'seat-0', template)).toMatchObject({ title: 'Devil', prompt: 'Choose a hand card to replace the judgment', confirmLabel: 'Replace' });
  });
});

describe('describeArrangement', () => {
  const owner = { kind: 'general' as const, seatId: 'seat-0', slot: 'main' as const, skillId: 'astrology' };
  const template: Action = { kind: 'ArrangeCardsAction', seatId: 'seat-0', arrangementId: 'arr', top: [], bottom: [] };
  it('names the skill and shows the cards being arranged, in order', () => {
    const s = state();
    s.zones = [...s.zones, { id: 'drawPile', kind: 'drawPile', cards: [sha, peach] }];
    s.pendingArrangement = { id: 'arr', seatId: 'seat-0', reason: { kind: 'ability', owner, abilityId: 'astrology' }, cardInstanceIds: ['s2', 'p1'] };
    expect(describeArrangement(s, 'seat-0', [template])).toEqual({
      title: 'Astrology',
      prompt: 'Put each card on top of the draw pile or at the bottom. Left to right is the order they go in.',
      cards: [sha, peach],
      template,
    });
    expect(describeArrangement(s, 'seat-1', [])).toBeNull();
  });
});
