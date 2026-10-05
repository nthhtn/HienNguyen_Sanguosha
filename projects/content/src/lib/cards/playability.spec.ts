import { getLegalActions, resolve } from 'engine';
import type { CardDefinition, ContentRegistry, GameState, Seat, Target } from 'engine';
import { buildContentRegistry } from '../registry';
import { kingdomWarMode } from '../modes/kingdomWar';
import { attackRange, seatDistance } from '../shared/queries';

const t = (seatId: string): Target => ({ kind: 'seat', seatId });
const stubMount = (id: string, equipSlot: 'defensiveMount' | 'offensiveMount'): CardDefinition => ({ id, name: id, category: 'equipment', equipSlot, play: () => [] });

function registry(): ContentRegistry {
  const r = buildContentRegistry();
  r.cards.set('defensive-horse', stubMount('defensive-horse', 'defensiveMount'));
  r.cards.set('offensive-horse', stubMount('offensive-horse', 'offensiveMount'));
  return r;
}

const KINGDOMS = ['Wei', 'Shu', 'Wu', 'Qun', 'Shu'] as const;

// Distinct kingdoms, so a single hit never ends the game by leaving one kingdom standing.
function seat(id: string, index: number, combinedHp = 4, eliminated = false): Seat {
  return {
    id, index, kingdom: KINGDOMS[index], combinedHp, maxCombinedHp: 4, eliminated,
    generals: { main: { generalDefinitionId: 'cao-cao', revealed: false }, deputy: { generalDefinitionId: 'xu-chu', revealed: false } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` },
  };
}

// 5 seats; seat-0 acts. Ring distances from seat-0: seat-1 1, seat-2 2, seat-3 2, seat-4 1.
function table(opts: { hand?: string[]; equip?: Record<string, string[]>; hp?: number; eliminated?: string[]; cardPlays?: Record<string, number> } = {}): GameState {
  const ids = ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4'];
  const card = (d: string, i: number) => ({ instanceId: `${d}-${i}`, definitionId: d, suit: 'spade' as const, rank: 1 });
  return {
    seats: ids.map((id, i) => seat(id, i, id === 'seat-0' ? opts.hp ?? 4 : 4, (opts.eliminated ?? []).includes(id))),
    players: [], phase: 'Play',
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [], cardPlays: opts.cardPlays },
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: id === 'seat-0' ? (opts.hand ?? []).map(card) : [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: (opts.equip?.[id] ?? []).map(card) },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const playsOf = (s: GameState, r: ContentRegistry, definitionId: string) =>
  getLegalActions(s, 'seat-0', r)
    .filter((a): a is Extract<typeof a, { kind: 'PlayCardAction' }> => a.kind === 'PlayCardAction' && a.cardInstanceId.startsWith(`${definitionId}-`))
    .map((a) => a.targets);

describe('distance and attack range', () => {
  it('is the living-seat ring distance, adjusted by mounts and never below 1', () => {
    const r = registry();
    expect(seatDistance(table(), 'seat-0', 'seat-2', r)).toBe(2);
    expect(seatDistance(table({ equip: { 'seat-2': ['defensive-horse'] } }), 'seat-0', 'seat-2', r)).toBe(3);
    expect(seatDistance(table({ equip: { 'seat-0': ['offensive-horse'] } }), 'seat-0', 'seat-2', r)).toBe(1);
    expect(seatDistance(table({ equip: { 'seat-0': ['offensive-horse'] } }), 'seat-0', 'seat-1', r)).toBe(1);
  });

  it('skips eliminated seats (Review Focus 3)', () => {
    expect(seatDistance(table({ eliminated: ['seat-1'] }), 'seat-0', 'seat-2', registry())).toBe(1);
  });

  it('is 1 without a weapon and the weapon range with one', () => {
    const r = registry();
    expect(attackRange(table(), 'seat-0', r)).toBe(1);
    expect(attackRange(table({ equip: { 'seat-0': ['green-dragon-blade'] } }), 'seat-0', r)).toBe(3);
  });
});

describe('each card’s play rule', () => {
  it('Sha targets only living seats within attack range, never untargeted (Review Focus 2)', () => {
    const r = registry();
    expect(playsOf(table({ hand: ['sha'] }), r, 'sha')).toEqual([[t('seat-1')], [t('seat-4')]]);
    expect(playsOf(table({ hand: ['sha'], equip: { 'seat-0': ['green-dragon-blade'] } }), r, 'sha')).toEqual([
      [t('seat-1')], [t('seat-2')], [t('seat-3')], [t('seat-4')],
    ]);
  });

  it('Sha is not playable once this turn’s limit is used, but still answers a Duel (Review Focus 1)', () => {
    const r = registry();
    expect(playsOf(table({ hand: ['sha'], cardPlays: { sha: 1 } }), r, 'sha')).toEqual([]);
    const s: GameState = {
      ...table({ hand: ['sha'], cardPlays: { sha: 1 } }),
      turn: { turnNumber: 1, ownerSeatId: 'seat-1', extraTurnStack: [], cardPlays: { sha: 1 } },
      pendingResponse: {
        id: 'duel-1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['sha', 'wuxie'],
        context: { effect: { kind: 'DamageEffect', damage: { source: t('seat-1'), target: t('seat-0'), amount: 2, nature: 'normal' } } },
      },
    };
    expect(getLegalActions(s, 'seat-0', r).some((a) => a.kind === 'RespondAction')).toBe(true);
  });

  it('a second Sha in the same turn is no longer legal after the first resolves', () => {
    const r = registry();
    const first = resolve(
      table({ hand: ['sha', 'sha'] }),
      { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'sha-0', targets: [t('seat-1')] },
      { registry: r, mode: kingdomWarMode }
    ).state;
    // seat-1 has no Shan, so it passes and takes the damage; afterwards it is seat-0's Play phase again.
    const afterPass = resolve(first, { kind: 'PassAction', seatId: 'seat-1', pendingResponseId: first.pendingResponse!.id }, { registry: r, mode: kingdomWarMode }).state;
    expect(playsOf(afterPass, r, 'sha')).toEqual([]);
  });

  it('Shan and Wuxie are never played proactively', () => {
    const r = registry();
    expect(playsOf(table({ hand: ['shan'] }), r, 'shan')).toEqual([]);
    expect(playsOf(table({ hand: ['wuxie'] }), r, 'wuxie')).toEqual([]);
  });

  it('Peach is playable untargeted only when hurt', () => {
    const r = registry();
    expect(playsOf(table({ hand: ['peach'], hp: 4 }), r, 'peach')).toEqual([]);
    expect(playsOf(table({ hand: ['peach'], hp: 3 }), r, 'peach')).toEqual([[]]);
  });

  it('Duel targets any living other seat at any distance', () => {
    expect(playsOf(table({ hand: ['duel'], eliminated: ['seat-3'] }), registry(), 'duel')).toEqual([[t('seat-1')], [t('seat-2')], [t('seat-4')]]);
  });

  it('equipment is played untargeted, and a weapon’s range applies at once (Review Focus 5)', () => {
    const r = registry();
    const s = table({ hand: ['green-dragon-blade', 'sha'] });
    expect(playsOf(s, r, 'green-dragon-blade')).toEqual([[]]);
    expect(playsOf(table({ hand: ['silver-lion'] }), r, 'silver-lion')).toEqual([[]]);
    const equipped = resolve(s, { kind: 'PlayCardAction', seatId: 'seat-0', cardInstanceId: 'green-dragon-blade-0', targets: [] }, { registry: r, mode: kingdomWarMode }).state;
    expect(playsOf(equipped, r, 'sha')).toHaveLength(4);
  });
});
