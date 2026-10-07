import { advanceToDecision, resolve } from './resolve';
import { ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { GameState, GeneralOwner } from '../domain/types';
import { Effect } from './effects';
import { drawPileTop } from '../cards/zones';

const owner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'main', skillId: 'echo' };
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const card = (instanceId: string) => ({ instanceId, definitionId: 'x', suit: 'spade' as const, rank: 1 });

// Echo: step 'pick' opens a selection of a's hand; step 'picked' draws one card per pick.
const echo: SkillDefinition = {
  id: 'echo',
  onStep: (state, step) => {
    if (step.step === 'pick') {
      return [{
        kind: 'OpenSelectionEffect',
        selection: { id: 'sel', seatId: 'a', reason: { kind: 'ability', owner, abilityId: 'echo' }, of: 'cards', eligibleIds: ['h1', 'h2'], min: 1, max: 2, then: { kind: 'skill-step', step: { kind: 'SkillStepEffect', owner, step: 'picked', data: { keep: true } } } },
      }];
    }
    const picked = step.data?.['picked'] as string[];
    return [{ kind: 'DrawCardsEffect', seatId: 'a', count: picked.length }];
  },
};
const registry: ContentRegistry = { cards: new Map(), generals: new Map([['g', { id: 'g', kingdom: 'Wei', maxHp: 4, skills: [echo] }]]) };
const ctx = { registry, mode };

function table(queue: Effect[] = []): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, eliminated: false,
    generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } },
    combinedHp: 4, maxCombinedHp: 4, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('h1'), card('h2')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
      { id: 'b:judgment', kind: 'judgment', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    ...(queue.length ? { resolutionQueue: queue } : {}),
  };
}

describe('SkillStepEffect', () => {
  it("runs its skill's onStep, and a skill-step selection hands the picks on with the step's data", () => {
    const opened = advanceToDecision(table([{ kind: 'SkillStepEffect', owner, step: 'pick' }]), ctx).state;
    expect(opened.pendingSelection?.id).toBe('sel');
    const done = resolve(opened, { kind: 'SelectAction', seatId: 'a', selectionId: 'sel', ids: ['h1', 'h2'] }, ctx).state;
    expect(done.zones.find((z) => z.id === 'a:hand')!.cards.map((c) => c.instanceId)).toEqual(['h1', 'h2', 'd1', 'd2']);
  });

  it('a skill with no onStep fails loudly', () => {
    const bare: ContentRegistry = { cards: new Map(), generals: new Map([['g', { id: 'g', kingdom: 'Wei', maxHp: 4, skills: [{ id: 'echo' }] }]]) };
    expect(() => advanceToDecision(table([{ kind: 'SkillStepEffect', owner, step: 'pick' }]), { registry: bare, mode })).toThrow('echo has no onStep');
  });
});

describe('ShowCardEffect', () => {
  it('logs the card face for everyone; an unknown card shows nothing', () => {
    const shown = advanceToDecision(table([{ kind: 'ShowCardEffect', seatId: 'a', cardInstanceId: 'h1', abilityId: 'echo' }, { kind: 'ShowCardEffect', seatId: 'a', cardInstanceId: 'nope' }]), ctx).state;
    expect(shown.log).toEqual([{ kind: 'CardShownEvent', seatId: 'a', card: card('h1'), abilityId: 'echo' }]);
  });
});

describe('drawPileTop', () => {
  it('is the top cards of the draw pile, top first, as many as there are', () => {
    expect(drawPileTop(table(), 2).map((c) => c.instanceId)).toEqual(['d1', 'd2']);
    expect(drawPileTop(table(), 9)).toHaveLength(3);
  });
});

describe('the give continuation’s tally', () => {
  it('counts the cards given under the tally key', () => {
    const give: Effect = {
      kind: 'OpenSelectionEffect',
      selection: { id: 'g1', seatId: 'a', reason: { kind: 'ability', owner, abilityId: 'echo' }, of: 'cards', eligibleIds: ['h1', 'h2'], min: 1, max: 2, then: { kind: 'give', toSeatIds: ['b'], tally: 'a/main/echo/given' } },
    };
    const opened = advanceToDecision(table([give]), ctx).state;
    const picked = resolve(opened, { kind: 'SelectAction', seatId: 'a', selectionId: 'g1', ids: ['h1', 'h2'] }, ctx).state;
    const given = resolve(picked, { kind: 'ChooseOptionAction', seatId: 'a', choiceId: picked.pendingChoice!.id, optionId: 'b' }, ctx).state;
    expect(given.turn.abilityUses).toEqual({ 'a/main/echo/given': 2 });
    expect(given.zones.find((z) => z.id === 'b:hand')!.cards.map((c) => c.instanceId)).toEqual(['h1', 'h2']);
  });
});
