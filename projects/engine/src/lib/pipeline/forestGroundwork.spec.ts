import { advanceToDecision, resolve } from './resolve';
import type { CardDefinition, ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import type { GameState, GeneralOwner } from '../domain/types';
import type { Effect } from './effects';

const owner: GeneralOwner = { kind: 'general', seatId: 'a', slot: 'main', skillId: 'probe' };
const stub: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const card = (instanceId: string, definitionId = 'x') => ({ instanceId, definitionId, suit: 'spade' as const, rank: 7 });

// What the probe skill saw when its 'answered' step ran.
let seen: Record<string, unknown> | undefined;
const probe: SkillDefinition = {
  id: 'probe',
  onStep: (_state, step) => {
    seen = step.data;
    return [{ kind: 'DrawCardsEffect', seatId: step.data?.['answeredBy'] as string, count: 1 }];
  },
};
const noopTool: CardDefinition = { id: 'noop-tool', name: 'Noop Tool', category: 'tool', legalPlayTargets: () => [[]], play: () => [] };
const quick: CardDefinition = { id: 'quick', name: 'Quick', category: 'basic', legalPlayTargets: () => [[]], play: () => [] };
const registry: ContentRegistry = {
  cards: new Map([['noop-tool', noopTool], ['quick', quick]]),
  generals: new Map([['g', { id: 'g', kingdom: 'Wei', maxHp: 4, skills: [probe] }]]),
};

function table(over: Partial<GameState> = {}): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, eliminated: false,
    generals: { main: { generalDefinitionId: 'g', revealed: true }, deputy: { generalDefinitionId: 'g', revealed: true } },
    combinedHp: 4, maxCombinedHp: 4, hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('t1', 'noop-tool'), card('q1', 'quick')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'a:judgment', kind: 'judgment', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [card('q2', 'quick')] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
      { id: 'b:judgment', kind: 'judgment', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
    ...over,
  };
}
const hand = (s: GameState, id: string) => s.zones.find((z) => z.id === `${id}:hand`)!.cards.map((c) => c.instanceId);

describe('ReduceMaxHpEffect', () => {
  const run = (s: GameState, effect: Effect) => advanceToDecision({ ...s, resolutionQueue: [effect] }, { registry, mode: stub }).state;

  it('lowers max HP and drops HP to it, logging the change', () => {
    const s = run(table(), { kind: 'ReduceMaxHpEffect', seatId: 'a', amount: 1 });
    expect(s.seats[0]).toMatchObject({ maxCombinedHp: 3, combinedHp: 3, eliminated: false });
    expect(s.log).toContainEqual({ kind: 'MaxHpReducedEvent', seatId: 'a', amount: 1, maxHp: 3 });
  });

  it('leaves HP alone when it is already below the new max', () => {
    const t = table();
    const s = run({ ...t, seats: t.seats.map((x) => (x.id === 'a' ? { ...x, combinedHp: 1 } : x)) }, { kind: 'ReduceMaxHpEffect', seatId: 'a', amount: 1 });
    expect(s.seats[0]).toMatchObject({ maxCombinedHp: 3, combinedHp: 1 });
  });

  it('eliminates a seat whose max HP reaches 0', () => {
    const t = table();
    const s = run({ ...t, seats: t.seats.map((x) => (x.id === 'a' ? { ...x, maxCombinedHp: 1, combinedHp: 1 } : x)) }, { kind: 'ReduceMaxHpEffect', seatId: 'a', amount: 1 });
    expect(s.seats[0].eliminated).toBe(true);
    expect(s.log).toContainEqual({ kind: 'MaxHpReducedEvent', seatId: 'a', amount: 1, maxHp: 0 });
    expect(s.log).toContainEqual({ kind: 'SeatEliminatedEvent', seatId: 'a' });
  });
});

describe('ToolResolvedEffect', () => {
  const marker: GameModeDefinition = {
    ...stub,
    triggers: [{ point: 'before:ToolResolvedEffect', condition: () => true, effect: () => [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }] }],
  };
  const play = (id: string) => resolve(table(), { kind: 'PlayCardAction', seatId: 'a', cardInstanceId: id, targets: [] }, { registry, mode: marker }).state;

  it('is queued behind a played Tool, where triggers can act on it', () => {
    expect(hand(play('t1'), 'a')).toEqual(['q1', 'd1']);
  });

  it('is not queued for a Basic card', () => {
    expect(hand(play('q1'), 'a')).toEqual(['t1']);
  });
});

describe('PendingResponse.sourceSkill', () => {
  const window = (): GameState =>
    table({
      pendingResponse: {
        id: 'w', respondingSeatId: 'b', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['quick'],
        context: { effect: { kind: 'DrawCardsEffect', seatId: 'a', count: 1 } },
        sourceSkill: { owner, step: 'answered', data: { victim: 'a' } },
      },
    });

  it('answering queues the skill step with the answerer and the answering card', () => {
    seen = undefined;
    const s = resolve(window(), { kind: 'RespondAction', seatId: 'b', pendingResponseId: 'w', cardInstanceId: 'q2' }, { registry, mode: stub }).state;
    expect(seen).toMatchObject({ victim: 'a', answeredBy: 'b', answeredCard: { as: 'quick' } });
    expect(hand(s, 'b')).toEqual(['d1']); // the probe drew for the answerer; the window's own effect (a draws) did not run
    expect(hand(s, 'a')).toEqual(['t1', 'q1']);
  });

  it('passing runs the window effect and not the skill step', () => {
    seen = undefined;
    const s = resolve(window(), { kind: 'PassAction', seatId: 'b', pendingResponseId: 'w' }, { registry, mode: stub }).state;
    expect(seen).toBeUndefined();
    expect(hand(s, 'a')).toEqual(['t1', 'q1', 'd1']);
  });
});

describe('DiscardZoneEffect.acted', () => {
  it('is carried and the zone is still discarded', () => {
    const s = advanceToDecision(
      { ...table(), resolutionQueue: [{ kind: 'DiscardZoneEffect', zoneId: 'b:hand', acted: ['x'] }] },
      { registry, mode: stub }
    ).state;
    expect(s.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toEqual(['q2']);
  });
});
