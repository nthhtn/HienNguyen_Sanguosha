import { advanceToDecision, resolve } from './resolve';
import { Effect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, GameState, Phase, QueueItem } from '../domain/types';
import { ContentRegistry, GameModeDefinition, SkillTrigger } from '../registry/types';

const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'filler', suit: 'club', rank: 5 });
const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const modeWith = (triggers: SkillTrigger[] = []): GameModeDefinition => ({
  id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers,
});

function table(o: { queue?: QueueItem[]; phase?: Phase; hand?: number; flags?: Record<string, boolean>; eliminated?: boolean } = {}): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 3, maxCombinedHp: 4, eliminated: id === 'a' && !!o.eliminated, generals: null,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1)], players: [],
    turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [], ...(o.flags ? { flags: o.flags } : {}) }, phase: o.phase ?? 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: Array.from({ length: o.hand ?? 0 }, (_, i) => card(`h${i}`)) },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, ...(o.queue ? { resolutionQueue: o.queue } : {}),
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}
const settle = (s: GameState, triggers: SkillTrigger[] = []) => advanceToDecision(s, { registry, mode: modeWith(triggers) }).state;
const hand = (s: GameState) => s.zones.find((z) => z.id === 'a:hand')!.cards.map((c) => c.instanceId);

describe('LoseHpEffect (Review Focus 4)', () => {
  it('lowers HP and logs it, as no damage: damage triggers don’t fire, HP-lost triggers do', () => {
    const seen: string[] = [];
    const listen = (point: SkillTrigger['point']): SkillTrigger => ({ point, condition: () => true, effect: () => { seen.push(point); return []; } });
    const next = settle(table({ queue: [{ kind: 'LoseHpEffect', seatId: 'a', amount: 1, abilityId: 'battered-body' }] }), [listen('after:DamageDealtEvent'), listen('after:HpLostEvent')]);
    expect(next.seats[0].combinedHp).toBe(2);
    expect(next.log).toEqual([{ kind: 'HpLostEvent', seatId: 'a', amount: 1, abilityId: 'battered-body' }]);
    expect(seen).toEqual(['after:HpLostEvent']);
  });

  it('goes below 0 like damage, and does nothing to an eliminated seat', () => {
    expect(settle(table({ queue: [{ kind: 'LoseHpEffect', seatId: 'a', amount: 5 }] })).seats[0].combinedHp).toBe(-2);
    const out = settle(table({ eliminated: true, phase: 'Play', queue: [{ kind: 'LoseHpEffect', seatId: 'a', amount: 1 }] }));
    expect(out.log.some((e) => e.kind === 'HpLostEvent')).toBe(false);
  });
});

describe('DrawPhaseEffect', () => {
  const drawPhase = (count: number): Effect => ({ kind: 'DrawPhaseEffect', seatId: 'a', count });

  it('draws its count', () => {
    expect(hand(settle(table({ queue: [drawPhase(2)] })))).toEqual(['d1', 'd2']);
  });

  it('draws nothing, and logs nothing, at 0', () => {
    expect(settle(table({ queue: [drawPhase(0)] })).log).toEqual([]);
  });

  it('a before-trigger can change the count, or replace the draw', () => {
    const plusOne: SkillTrigger = {
      point: 'before:DrawPhaseEffect', condition: () => true,
      effect: (_s, subject) => [{ ...(subject as Extract<Effect, { kind: 'DrawPhaseEffect' }>), count: 3 }],
    };
    expect(hand(settle(table({ queue: [drawPhase(2)] }), [plusOne]))).toEqual(['d1', 'd2', 'd3']);
    const instead: SkillTrigger = { point: 'before:DrawPhaseEffect', condition: () => true, effect: () => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: 'a' }, amount: 1 }] };
    const replaced = settle(table({ queue: [drawPhase(2)] }), [instead]);
    expect(hand(replaced)).toEqual([]);
    expect(replaced.seats[0].combinedHp).toBe(4);
  });
});

describe('skipping the Discard Phase', () => {
  // Seat a's 3 HP gives a hand limit of 3, so 6 cards is over it.
  it('a seat over its hand limit skips Discard when flagged, and keeps its cards', () => {
    const ended = resolve(table({ phase: 'Play', hand: 6, flags: { skipDiscard: true } }), { kind: 'EndPhaseAction', seatId: 'a' }, { registry, mode: modeWith() }).state;
    expect(ended.log).toContainEqual({ kind: 'PhaseSkippedEvent', seatId: 'a', phase: 'Discard' });
    expect(ended.log.some((e) => e.kind === 'PhaseChangedEvent' && e.phase === 'Discard')).toBe(false);
    expect(hand(ended)).toHaveLength(6);
    expect(ended.turn.ownerSeatId).toBe('b');
  });
});

describe('before-triggers (final review)', () => {
  it('a rewrite’s further outputs run after the effect it rewrote, not dropped', () => {
    const insteadAndMore: SkillTrigger = {
      point: 'before:DrawPhaseEffect', condition: () => true,
      effect: () => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: 'a' }, amount: 1 }, { kind: 'SetTurnFlagEffect', flag: 'second' }],
    };
    const next = settle(table({ queue: [{ kind: 'DrawPhaseEffect', seatId: 'a', count: 2 }] }), [insteadAndMore]);
    expect(next.seats[0].combinedHp).toBe(4);
    expect(next.turn.flags).toEqual({ second: true });
    expect(hand(next)).toEqual([]);
  });
});
