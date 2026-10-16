import { advanceToDecision, resolve } from './resolve';
import { Effect, applyEffect } from './effects';
import { createRng } from '../rng/rng';
import { CardInstance, Damage, GameResult, GameState, GeneralOwner } from '../domain/types';
import { ContentRegistry, GameModeDefinition, SkillDefinition } from '../registry/types';
import { livingSeatOrderFrom } from '../rules/seatOrder';
import { isChained } from '../rules/chains';
import { DamageDealtEvent, EngineEvent } from './events';

// Chains: a chained seat that takes fire or thunder damage becomes unchained,
// and once that damage has fully resolved every other living chained seat
// takes the original amount in turn order (see the elemental damage spec).

type DamageStep = Extract<Effect, { kind: 'DamageEffect' }>;
const ownerSeat = (owner: unknown) => (owner as GeneralOwner).seatId;
const targetOf = (subject: unknown) => {
  const target = (subject as DamageStep).damage.target;
  return target.kind === 'seat' ? target.seatId : null;
};

// Damage to the owner is increased by 1.
const plusOne: SkillDefinition = {
  id: 'plus-one',
  triggers: [{
    point: 'before:DamageEffect',
    condition: (_s, subject, owner) => targetOf(subject) === ownerSeat(owner),
    effect: (_s, subject) => {
      const step = subject as DamageStep;
      return [{ ...step, damage: { ...step.damage, amount: step.damage.amount + 1 } }];
    },
  }],
};
// Damage to the owner is reduced to 0.
const toZero: SkillDefinition = {
  id: 'to-zero',
  triggers: [{
    point: 'before:DamageEffect',
    condition: (_s, subject, owner) => targetOf(subject) === ownerSeat(owner),
    effect: (_s, subject) => {
      const step = subject as DamageStep;
      return [{ ...step, damage: { ...step.damage, amount: 0 } }];
    },
  }],
};
// After the owner takes damage: it draws 1 (an after-damage skill).
const drawOnHurt: SkillDefinition = {
  id: 'draw-on-hurt',
  triggers: [{
    point: 'after:DamageDealtEvent',
    condition: (_s, subject, owner) => (subject as DamageDealtEvent).damage.target.kind === 'seat' && (subject as DamageDealtEvent).damage.target.seatId === ownerSeat(owner),
    effect: (_s, _subject, owner) => [{ kind: 'DrawCardsEffect', seatId: ownerSeat(owner), count: 1 }],
  }],
};
// After the owner takes damage: seat b is eliminated, or unchained.
const hurtDoes = (id: string, effect: Effect): SkillDefinition => ({
  id,
  triggers: [{
    point: 'after:DamageDealtEvent',
    condition: (_s, subject, owner) => (subject as DamageDealtEvent).damage.target.kind === 'seat' && (subject as DamageDealtEvent).damage.target.seatId === ownerSeat(owner),
    effect: () => [effect],
  }],
});

const general = (id: string, skills: SkillDefinition[] = []) => [id, { id, kingdom: 'Wei' as const, maxHp: 4, skills }] as const;
const registry: ContentRegistry = {
  cards: new Map([['peach', { id: 'peach', name: 'Peach', category: 'basic', play: () => [] }]]),
  generals: new Map([
    general('plain'),
    general('plus-one', [plusOne]),
    general('to-zero', [toZero]),
    general('draw-on-hurt', [drawOnHurt]),
    general('kills-b', [hurtDoes('kills-b', { kind: 'EliminateSeatEffect', seatId: 'b' })]),
    general('unchains-b', [hurtDoes('unchains-b', { kind: 'SetChainedEffect', seatId: 'b', chained: false })]),
  ]),
};

// The dying round, as a mode would start it; no one holds a Peach.
function modeWith(checkWinCondition: GameModeDefinition['checkWinCondition'] = () => null): GameModeDefinition {
  return {
    id: 'stub',
    setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'],
    checkWinCondition,
    triggers: [{
      point: 'after:DamageDealtEvent',
      condition: (state, subject) => {
        const target = (subject as DamageDealtEvent).damage.target;
        return target.kind === 'seat' && (state.seats.find((s) => s.id === target.seatId)?.combinedHp ?? 1) <= 0;
      },
      effect: (state, subject) => {
        const target = (subject as DamageDealtEvent).damage.target as { kind: 'seat'; seatId: string };
        return [{ kind: 'DyingEffect', seatId: target.seatId, order: livingSeatOrderFrom(state, state.turn.ownerSeatId), rescueCardIds: { any: ['peach'], self: [] }, entering: true }];
      },
    }],
  };
}
const ctx = { registry, mode: modeWith() };

interface SeatSetup { chained?: boolean; hp?: number; general?: string }
const card = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'peach', suit: 'club', rank: 5 });

// Seats a, b, c, d in that order; a's turn, in Play.
function table(setup: Record<string, SeatSetup>, queue: Effect[]): GameState {
  const ids = ['a', 'b', 'c', 'd'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: 'Wei' as const, eliminated: false,
      combinedHp: setup[id]?.hp ?? 4, maxCombinedHp: 4,
      generals: { main: { generalDefinitionId: setup[id]?.general ?? 'plain', revealed: true }, deputy: { generalDefinitionId: 'plain', revealed: true } },
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
      ...(setup[id]?.chained ? { chained: true as const } : {}),
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3'), card('d4')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, resolutionQueue: queue,
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

const damage = (seatId: string, amount: number, nature: Damage['nature']): Effect => ({
  kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'a' }, target: { kind: 'seat', seatId }, amount, nature },
});
const run = (s: GameState, c = ctx) => advanceToDecision(s, c).state;
const hp = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!.combinedHp;
const hits = (s: GameState) =>
  s.log.flatMap((e) => (e.kind === 'DamageDealtEvent' && e.damage.target.kind === 'seat' ? [`${e.damage.target.seatId}:${e.damage.amount}`] : []));
const passDying = (s: GameState, c = ctx) => resolve(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id }, c).state;

describe('SetChainedEffect', () => {
  it('chains and unchains a seat, logging only a change', () => {
    let s = table({}, []);
    s = applyEffect(s, { kind: 'SetChainedEffect', seatId: 'b', chained: true }).state;
    expect(isChained(s, 'b')).toBe(true);
    expect(s.seats.find((x) => x.id === 'b')!.chained).toBe(true);
    expect(s.log).toEqual([{ kind: 'ChainToggledEvent', seatId: 'b', chained: true }]);

    const again = applyEffect(s, { kind: 'SetChainedEffect', seatId: 'b', chained: true });
    expect(again.events).toEqual([]);
    expect(again.state.log).toHaveLength(1);

    s = applyEffect(s, { kind: 'SetChainedEffect', seatId: 'b', chained: false }).state;
    expect(isChained(s, 'b')).toBe(false);
    expect('chained' in s.seats.find((x) => x.id === 'b')!).toBe(false);
    expect(s.log.at(-1)).toEqual({ kind: 'ChainToggledEvent', seatId: 'b', chained: false });

    const unchanged = applyEffect(s, { kind: 'SetChainedEffect', seatId: 'b', chained: false });
    expect(unchanged.events).toEqual([]);
  });
});

describe('chain propagation', () => {
  it.each(['thunder', 'fire'] as const)('%s damage to a chained seat unchains it and hits the other chained seat', (nature) => {
    const s = run(table({ a: { chained: true }, b: { chained: true } }, [damage('a', 2, nature)]));
    expect(hits(s)).toEqual(['a:2', 'b:2']);
    expect(hp(s, 'a')).toBe(2);
    expect(hp(s, 'b')).toBe(2);
    expect(hp(s, 'c')).toBe(4);
    expect(isChained(s, 'a')).toBe(false);
    expect(isChained(s, 'b')).toBe(false);
    const propagated = s.log.filter((e): e is DamageDealtEvent => e.kind === 'DamageDealtEvent')[1];
    expect(propagated.damage).toMatchObject({ nature, amount: 2, chained: true, base: 2, source: { kind: 'seat', seatId: 'a' } });
    expect(s.log.filter((e) => e.kind === 'ChainToggledEvent')).toEqual([
      { kind: 'ChainToggledEvent', seatId: 'a', chained: false },
      { kind: 'ChainToggledEvent', seatId: 'b', chained: false },
    ]);
    expect(s.resolutionQueue).toBeUndefined();
  });

  it('plain damage to a chained seat neither propagates nor unchains', () => {
    const s = run(table({ a: { chained: true }, b: { chained: true } }, [damage('a', 1, 'normal')]));
    expect(hits(s)).toEqual(['a:1']);
    expect(isChained(s, 'a')).toBe(true);
    expect(isChained(s, 'b')).toBe(true);
  });

  it('fire damage to an unchained seat starts no wave', () => {
    const s = run(table({ b: { chained: true } }, [damage('a', 1, 'fire')]));
    expect(hits(s)).toEqual(['a:1']);
    expect(isChained(s, 'b')).toBe(true);
  });

  it('goes in turn order, starting after the damaged seat', () => {
    const chained = { a: { chained: true }, c: { chained: true }, d: { chained: true } };
    expect(hits(run(table(chained, [damage('a', 1, 'thunder')])))).toEqual(['a:1', 'c:1', 'd:1']);
    expect(hits(run(table(chained, [damage('c', 1, 'thunder')])))).toEqual(['c:1', 'd:1', 'a:1']);
  });

  it('propagates the original amount, and each hit applies its own before-triggers', () => {
    const s = run(table({ a: { chained: true, general: 'plus-one' }, b: { chained: true }, c: { chained: true, general: 'plus-one' } }, [damage('a', 2, 'fire')]));
    expect(hits(s)).toEqual(['a:3', 'b:2', 'c:3']);
  });

  it('keeps the original amount through a rewrite that is already stamped', () => {
    const stamped: Effect = { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'a' }, amount: 3, nature: 'thunder', base: 1 } };
    const s = run(table({ a: { chained: true }, b: { chained: true } }, [stamped]));
    expect(hits(s)).toEqual(['a:3', 'b:1']);
  });

  it('propagated damage does not propagate again', () => {
    const s = run(table({ a: { chained: true }, b: { chained: true }, c: { chained: true } }, [damage('a', 1, 'thunder')]));
    expect(hits(s)).toEqual(['a:1', 'b:1', 'c:1']);
  });

  it('a propagated hit to a seat chained again meanwhile starts no wave of its own', () => {
    // A propagated DamageEffect (chained: true) to a chained seat: unchains, no wave.
    const propagated: Effect = { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'a' }, amount: 1, nature: 'fire', base: 1, chained: true } };
    const s = run(table({ a: { chained: true }, b: { chained: true } }, [propagated]));
    expect(hits(s)).toEqual(['a:1']);
    expect(isChained(s, 'a')).toBe(false);
    expect(isChained(s, 'b')).toBe(true);
  });

  it('runs the damaged seat’s after-damage skills before the wave', () => {
    const s = run(table({ a: { chained: true, general: 'draw-on-hurt' }, b: { chained: true, general: 'draw-on-hurt' } }, [damage('a', 1, 'thunder')]));
    const order = s.log.flatMap((e: EngineEvent) =>
      e.kind === 'DamageDealtEvent' ? [`hit:${(e.damage.target as { seatId: string }).seatId}`] : e.kind === 'CardsDrawnEvent' ? [`draw:${e.seatId}`] : []
    );
    expect(order).toEqual(['hit:a', 'draw:a', 'hit:b', 'draw:b']);
  });

  it('a seat dying of its own hit: the dying round finishes, then the wave goes on', () => {
    let s = run(table({ a: { chained: true }, b: { chained: true, hp: 1 }, c: { chained: true } }, [damage('a', 1, 'thunder')]));
    expect(hits(s)).toEqual(['a:1', 'b:1']);
    expect(s.pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'b' });
    s = passDying(s);
    expect(s.seats.find((x) => x.id === 'b')!.eliminated).toBe(true);
    expect(hits(s)).toEqual(['a:1', 'b:1', 'c:1']);
    const kinds = s.log.map((e) => e.kind);
    expect(kinds.indexOf('SeatEliminatedEvent')).toBeLessThan(kinds.lastIndexOf('DamageDealtEvent'));
  });

  it('the first seat dying: its dying round finishes before the wave', () => {
    let s = run(table({ a: { chained: true, hp: 1 }, b: { chained: true } }, [damage('a', 1, 'fire')]));
    expect(hits(s)).toEqual(['a:1']);
    expect(s.pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'a' });
    s = passDying(s);
    expect(hits(s)).toEqual(['a:1', 'b:1']);
  });

  it('skips a seat eliminated before its turn', () => {
    const s = run(table({ a: { chained: true, general: 'kills-b' }, b: { chained: true }, c: { chained: true } }, [damage('a', 1, 'thunder')]));
    expect(hits(s)).toEqual(['a:1', 'c:1']);
  });

  it('skips a seat unchained before its turn', () => {
    const s = run(table({ a: { chained: true, general: 'unchains-b' }, b: { chained: true }, c: { chained: true } }, [damage('a', 1, 'thunder')]));
    expect(hits(s)).toEqual(['a:1', 'c:1']);
    expect(hp(s, 'b')).toBe(4);
  });

  it('damage reduced to 0 leaves the seat chained and propagates nothing', () => {
    const s = run(table({ a: { chained: true, general: 'to-zero' }, b: { chained: true } }, [damage('a', 2, 'fire')]));
    expect(hits(s).filter((h) => h !== 'a:0')).toEqual([]);
    expect(isChained(s, 'a')).toBe(true);
    expect(isChained(s, 'b')).toBe(true);
  });

  it('a propagated hit reduced to 0 leaves that seat chained', () => {
    const s = run(table({ a: { chained: true }, b: { chained: true, general: 'to-zero' }, c: { chained: true } }, [damage('a', 1, 'thunder')]));
    expect(hits(s)).toEqual(['a:1', 'b:0', 'c:1']);
    expect(isChained(s, 'b')).toBe(true);
  });

  it('stops when the game ends mid-wave, without throwing', () => {
    const ended: GameResult = { endedAt: 0, winningSeatIds: ['a'], losingSeatIds: ['b'] };
    const c = { registry, mode: modeWith((state) => (state.seats.some((x) => x.eliminated) ? ended : null)) };
    let s = run(table({ a: { chained: true }, b: { chained: true, hp: 1 }, c: { chained: true } }, [damage('a', 1, 'thunder')]), c);
    expect(() => (s = passDying(s, c))).not.toThrow();
    expect(s.result).toEqual(ended);
    expect(hits(s)).toEqual(['a:1', 'b:1']);
    expect(hp(s, 'c')).toBe(4);
    expect(s.resolutionQueue).toBeUndefined();
  });
});

describe('elimination clears chained', () => {
  it('EliminateSeatEffect', () => {
    const s = applyEffect(table({ b: { chained: true } }, []), { kind: 'EliminateSeatEffect', seatId: 'b' }).state;
    expect(isChained(s, 'b')).toBe(false);
    expect('chained' in s.seats.find((x) => x.id === 'b')!).toBe(false);
  });

  it('the dying round', () => {
    let s = run(table({ b: { chained: true, hp: 1 } }, [damage('b', 1, 'normal')]));
    s = passDying(s);
    expect(s.seats.find((x) => x.id === 'b')!.eliminated).toBe(true);
    expect('chained' in s.seats.find((x) => x.id === 'b')!).toBe(false);
  });

  it('max HP reduced to 0', () => {
    const s = applyEffect(table({ b: { chained: true } }, []), { kind: 'ReduceMaxHpEffect', seatId: 'b', amount: 4 }).state;
    expect(s.seats.find((x) => x.id === 'b')!.eliminated).toBe(true);
    expect('chained' in s.seats.find((x) => x.id === 'b')!).toBe(false);
  });
});

describe('the original amount', () => {
  it('is stamped as base on fire or thunder damage before before-triggers run', () => {
    const s = run(table({ a: { general: 'plus-one' } }, [damage('a', 2, 'thunder')]));
    const dealt = s.log.find((e): e is DamageDealtEvent => e.kind === 'DamageDealtEvent')!;
    expect(dealt.damage).toMatchObject({ amount: 3, base: 2 });
  });

  it('is not stamped on plain damage, which never propagates', () => {
    const s = run(table({ a: { general: 'plus-one' } }, [damage('a', 2, 'normal')]));
    const dealt = s.log.find((e): e is DamageDealtEvent => e.kind === 'DamageDealtEvent')!;
    expect('base' in dealt.damage).toBe(false);
  });
});
