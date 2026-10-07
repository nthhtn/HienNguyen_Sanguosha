import { advanceToDecision, resolve } from './resolve';
import { Action } from './actions';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, GeneralOwner } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { getLegalActions } from '../rules/legality';
import { applyEffect } from './effects';

const filler: CardDefinition = { id: 'filler', name: 'Filler', category: 'basic', legalPlayTargets: () => [], play: () => [] };
// Study (once per turn, needs a hand card): discard 1 hand card, then draw 1. Cancellable.
const study: SkillDefinition = {
  id: 'study',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => (state.zones.find((z) => z.id === `${seatId}:hand`)?.cards.length ?? 0) > 0,
    start: (state, { seatId, owner }) => [{
      kind: 'OpenSelectionEffect',
      selection: {
        id: `study-${state.log.length}`, seatId, reason: { kind: 'ability', owner, abilityId: 'study' }, of: 'cards',
        eligibleIds: state.zones.find((z) => z.id === `${seatId}:hand`)!.cards.map((c) => c.instanceId), min: 1, max: 1,
        then: { kind: 'discard', then: [{ kind: 'DrawCardsEffect', seatId, count: 1 }] }, onCancel: [],
      },
    }],
  },
};
// Rally (any number of times): draw 1. No decision.
const rally: SkillDefinition = { id: 'rally', active: { canUse: () => true, start: (_s, { seatId }) => [{ kind: 'DrawCardsEffect', seatId, count: 1 }] } };
const registry: ContentRegistry = {
  cards: new Map([[filler.id, filler]]),
  generals: new Map([
    ['scholar', { id: 'scholar', kingdom: 'Wu', maxHp: 4, skills: [study] }],
    ['captain', { id: 'captain', kingdom: 'Wu', maxHp: 4, skills: [rally] }],
  ]),
};
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'filler', suit: 'club', rank: 5 });
const studyOwner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'main', skillId: 'study' };
const rallyOwner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'deputy', skillId: 'rally' };
const useSkill = (owner: GeneralOwner): Action => ({ kind: 'UseSkillAction', seatId: 'a', owner });

// Seat a (turn owner, Play Phase): Main 'scholar', Deputy 'captain'; holds k1.
function table(revealed = true, phase: GameState['phase'] = 'Play'): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wu' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'scholar', revealed }, deputy: { generalDefinitionId: 'captain', revealed } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), { ...seat('b', 1), generals: null }], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase,
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('k1')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}
const skillActions = (s: GameState, seatId = 'a') => getLegalActions(s, seatId, registry).filter((a) => a.kind === 'UseSkillAction');
const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
const used = (s: GameState) => s.log.filter((e) => e.kind === 'AbilityUsedEvent');

describe('active skills', () => {
  it('are offered in their owner’s Play Phase while canUse holds', () => {
    expect(skillActions(table())).toEqual([useSkill(studyOwner), useSkill(rallyOwner)]);
    expect(skillActions(table(), 'b')).toEqual([]);
    expect(skillActions(table(true, 'Discard'))).toEqual([]);
    const emptyHand = table();
    emptyHand.zones = emptyHand.zones.map((z) => (z.id === 'a:hand' ? { ...z, cards: [] } : z));
    expect(skillActions(emptyHand)).toEqual([useSkill(rallyOwner)]);
  });

  it('with no decision, the use is counted and logged at once', () => {
    const next = act(table(), useSkill(rallyOwner));
    expect(next.turn.abilityUses).toEqual({ 'a/deputy/rally': 1 });
    expect(used(next)).toEqual([{ kind: 'AbilityUsedEvent', owner: rallyOwner, abilityId: 'rally', outcome: 'used' }]);
    expect(next.log.at(-1)).toMatchObject({ kind: 'CardsDrawnEvent', seatId: 'a' });
    // Unlimited: still offered.
    expect(skillActions(next)).toContainEqual(useSkill(rallyOwner));
  });

  it('a first selection is confirmed: the use is counted, then the skill goes on; once per turn', () => {
    const opened = act(table(), useSkill(studyOwner));
    expect(opened.turn.abilityUses).toBeUndefined();
    const done = act(opened, { kind: 'SelectAction', seatId: 'a', selectionId: opened.pendingSelection!.id, ids: ['k1'] });
    expect(done.turn.abilityUses).toEqual({ 'a/main/study': 1 });
    expect(done.log.map((e) => e.kind)).toEqual(['SelectionMadeEvent', 'AbilityUsedEvent', 'CardMovedEvent', 'CardsDrawnEvent']);
    expect(skillActions(done)).toEqual([useSkill(rallyOwner)]);
  });

  it('cancelling the first selection undoes the use (Review Focus 2)', () => {
    const opened = act(table(false), useSkill(studyOwner));
    const cancelled = act(opened, { kind: 'CancelSelectionAction', seatId: 'a', selectionId: opened.pendingSelection!.id });
    expect(cancelled.turn.abilityUses).toBeUndefined();
    expect(cancelled.seats[0].generals!.main.revealed).toBe(false);
    expect(cancelled.log).toEqual([]);
    expect(cancelled.phase).toBe('Play');
    expect(skillActions(cancelled)).toContainEqual(useSkill(studyOwner));
  });

  it('a hidden General’s skill is offered, and using it reveals the General', () => {
    expect(skillActions(table(false))).toEqual([useSkill(studyOwner), useSkill(rallyOwner)]);
    const next = act(table(false), useSkill(rallyOwner));
    expect(next.seats[0].generals!.deputy.revealed).toBe(true);
    expect(next.log[0]).toEqual({ kind: 'GeneralRevealedEvent', seatId: 'a', slot: 'deputy', forAbilityId: 'rally' });
  });

  it('a new turn starts with no uses counted', () => {
    const spent = act(act(table(), useSkill(studyOwner)), { kind: 'SelectAction', seatId: 'a', selectionId: 'study-0', ids: ['k1'] });
    const ended = act(spent, { kind: 'EndPhaseAction', seatId: 'a' });
    expect(ended.turn.ownerSeatId).toBe('b');
    expect(ended.turn.abilityUses).toBeUndefined();
  });

  it('an action that isn’t offered is refused', () => {
    expect(() => act(table(true, 'Discard'), useSkill(rallyOwner))).toThrow();
    expect(() => act(table(), { kind: 'UseSkillAction', seatId: 'a', owner: { ...studyOwner, skillId: 'nope' } })).toThrow('can’t use');
  });

  it('a cancellable first selection must be all of start: nothing may slip past a Cancel (final review)', () => {
    const greedy: SkillDefinition = {
      id: 'greedy',
      active: {
        usesPerTurn: 1,
        canUse: () => true,
        start: (state, { seatId, owner }) => [
          { kind: 'OpenSelectionEffect', selection: { id: 'g-1', seatId, reason: { kind: 'ability', owner, abilityId: 'greedy' }, of: 'cards', eligibleIds: ['k1'], min: 1, max: 1, then: { kind: 'discard' }, onCancel: [] } },
          { kind: 'DrawCardsEffect', seatId, count: 2 },
        ],
      },
    };
    const withGreedy: ContentRegistry = { ...registry, generals: new Map([...registry.generals, ['miser', { id: 'miser', kingdom: 'Wu', maxHp: 4, skills: [greedy] }]]) };
    const s = table();
    s.seats = s.seats.map((x) => (x.id === 'a' ? { ...x, generals: { ...x.generals!, main: { generalDefinitionId: 'miser', revealed: true } } } : x));
    const owner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'main', skillId: 'greedy' };
    expect(() => resolve(s, { kind: 'UseSkillAction', seatId: 'a', owner }, { registry: withGreedy, mode })).toThrow('only effect');
  });

  it('a paused first selection survives a JSON round trip', () => {
    const opened = act(table(false), useSkill(studyOwner));
    const select = (s: GameState) => act(s, { kind: 'SelectAction', seatId: 'a', selectionId: opened.pendingSelection!.id, ids: ['k1'] });
    expect(select(JSON.parse(JSON.stringify(opened)))).toEqual(select(opened));
  });
});

describe('counters', () => {
  it('IncrementEffect counts for the turn, or marks a seat for the game', () => {
    const turn = applyEffect(table(), { kind: 'IncrementEffect', scope: 'turn', key: 'x', by: 2 }).state;
    expect(turn.turn.abilityUses).toEqual({ x: 2 });
    const marked = applyEffect(applyEffect(table(), { kind: 'IncrementEffect', scope: 'seat', seatId: 'a', key: 'm', by: 1 }).state, { kind: 'IncrementEffect', scope: 'seat', seatId: 'a', key: 'm', by: 1 }).state;
    expect(marked.seats[0].marks).toEqual({ m: 2 });
    expect(() => applyEffect(table(), { kind: 'IncrementEffect', scope: 'seat', key: 'm', by: 1 })).toThrow('seatId');
  });

  it('ownerUses counts every card the turn owner used, answers included; never another seat’s', () => {
    const shan: CardDefinition = { id: 'shan', name: 'Shan', category: 'basic', legalPlayTargets: () => [], play: () => [] };
    const withShan: ContentRegistry = { ...registry, cards: new Map([...registry.cards, [shan.id, shan]]) };
    const s = table();
    s.zones = s.zones.map((z) => (z.id === 'a:hand' ? { ...z, cards: [{ ...card('s1'), definitionId: 'shan' }] } : z.id === 'b:hand' ? { ...z, cards: [{ ...card('s2'), definitionId: 'shan' }] } : z));
    const windowFor = (seatId: string) => ({
      ...s,
      pendingResponse: {
        id: `w-${seatId}`, respondingSeatId: seatId, allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['shan'],
        context: { effect: { kind: 'DrawCardsEffect' as const, seatId, count: 1 } },
      },
    });
    const answered = resolve(windowFor('a'), { kind: 'RespondAction', seatId: 'a', pendingResponseId: 'w-a', cardInstanceId: 's1' }, { registry: withShan, mode }).state;
    expect(answered.turn.ownerUses).toEqual({ shan: 1 });
    const other = resolve(windowFor('b'), { kind: 'RespondAction', seatId: 'b', pendingResponseId: 'w-b', cardInstanceId: 's2' }, { registry: withShan, mode }).state;
    expect(other.turn.ownerUses).toBeUndefined();
  });
});
