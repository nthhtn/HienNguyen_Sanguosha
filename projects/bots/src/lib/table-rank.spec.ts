import type { Action, CardInstance, GameState, Kingdom, Seat } from 'engine';
import { dangerOf } from './danger';
import { HOLD_FIRE } from './helpers';
import { ruleBasedV4Policy } from './rule-based';
import { isDangerous, seatDanger } from './table';
import { tableRankFor } from './table-rank';
import { card, decideTable, decideWith, registry, table } from './testing';

// Six seats seat-a ... seat-f, every General revealed and every seat playing for its Kingdom. The bot is
// seat-a (Shu); with no weapon it reaches seat-b and seat-f only.
const IDS = ['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f'];
// Wei leads with seat-c, seat-d and seat-f; seat-b (Wu) and seat-e (Qun) are truce partners; seat-f is in reach.
const LEAD_NEAR: Kingdom[] = ['Shu', 'Wu', 'Wei', 'Wei', 'Qun', 'Wei'];
// Wei leads with seat-c, seat-d and seat-e, all out of reach; seat-b (Wu) is a truce partner, seat-f an ally.
const LEAD_FAR: Kingdom[] = ['Shu', 'Wu', 'Wei', 'Wei', 'Wei', 'Shu'];
// Shu and Wei tie at 2 seats: nobody leads.
const NO_LEADER: Kingdom[] = ['Shu', 'Wu', 'Wei', 'Qun', 'Shu', 'Wei'];
// Real Kingdom Wars Generals whose summed danger is 2 or more (checked below).
const DANGEROUS: [string, string] = ['kingdomWars:gan-ning', 'kingdomWars:taishi-ci'];

function game(
  kingdoms: Kingdom[],
  o: { hp?: Record<string, number>; dangerous?: string[]; chained?: string[]; cards?: Record<string, CardInstance[]> } = {},
): GameState {
  const s = table(o.cards ?? {}, {
    seats: 6,
    kingdoms: Object.fromEntries(IDS.map((id, i) => [id, kingdoms[i]])),
    generals: Object.fromEntries((o.dangerous ?? []).map((id) => [id, DANGEROUS])),
    hp: o.hp,
  });
  return { ...s, seats: s.seats.map((seat): Seat => ({ ...seat, allegiance: 'kingdom', ...(o.chained?.includes(seat.id) ? { chained: true } : {}) })) };
}
const sha = { 'seat-a:hand': [card('sha', 'sha')] };
const seat = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!;
const isPlayOf = (definitionId: string) => (a: Action) => a.kind === 'PlayCardAction' && a.cardInstanceId === definitionId;
const targetsOf = (a: Action) => (a.kind === 'PlayCardAction' ? a.targets.map((t) => (t.kind === 'seat' ? t.seatId : t.kind)) : []);

describe('tableRank (rule 6)', () => {
  const rank = tableRankFor(registry);

  it('the dangerous fixture Generals are dangerous, the fillers are not', () => {
    const s = game(LEAD_NEAR, { dangerous: ['seat-b'] });
    expect(isDangerous(seatDanger(s, seat(s, 'seat-b'), registry, dangerOf(registry)))).toBe(true);
    expect(isDangerous(seatDanger(s, seat(s, 'seat-e'), registry, dangerOf(registry)))).toBe(false);
  });

  it('holds fire on a truce partner unless it has 3 HP or more and is dangerous', () => {
    const s = game(LEAD_NEAR, { hp: { 'seat-b': 2, 'seat-e': 4 }, dangerous: ['seat-b'] });
    expect(rank(s, seat(s, 'seat-a'), seat(s, 'seat-b'))).toBe(HOLD_FIRE);
    expect(rank(s, seat(s, 'seat-a'), seat(s, 'seat-e'))).toBe(HOLD_FIRE);
    const healthy = game(LEAD_NEAR, { hp: { 'seat-b': 3 }, dangerous: ['seat-b'] });
    expect(rank(healthy, seat(healthy, 'seat-a'), seat(healthy, 'seat-b'))).not.toBe(HOLD_FIRE);
  });

  it('ranks a dangerous truce partner below every leading-force seat', () => {
    const s = game(LEAD_NEAR, { hp: { 'seat-b': 3, 'seat-c': 4 }, dangerous: ['seat-b'] });
    const me = seat(s, 'seat-a');
    expect(rank(s, me, seat(s, 'seat-b'))).toBeLessThan(rank(s, me, seat(s, 'seat-c')));
  });

  it('adds 500 for a killing hit, 10 per HP missing and 0.01 per seat index', () => {
    const s = game(LEAD_NEAR, { hp: { 'seat-c': 1, 'seat-d': 2 } });
    const me = seat(s, 'seat-a');
    expect(rank(s, me, seat(s, 'seat-c')) - rank(s, me, seat(s, 'seat-d'))).toBeCloseTo(500 + 10 + 0.01, 10);
  });

  it('adds 30 per hostile act against the bot, counting up to 3', () => {
    const s = game(LEAD_NEAR);
    const me = seat(s, 'seat-a');
    const hit = { kind: 'DamageDealtEvent', damage: { source: { kind: 'seat', seatId: 'seat-c' }, target: { kind: 'seat', seatId: 'seat-a' }, amount: 1 } };
    const before = rank(s, me, seat(s, 'seat-c'));
    const twice = { ...s, log: [hit, hit] } as unknown as GameState;
    const often = { ...s, log: [hit, hit, hit, hit, hit] } as unknown as GameState;
    expect(rank(twice, me, seat(twice, 'seat-c')) - before).toBeCloseTo(60, 10);
    expect(rank(often, me, seat(often, 'seat-c')) - before).toBeCloseTo(90, 10);
  });
});

describe('rule-based-table: whom to attack (rule 6, HOLD_FIRE)', () => {
  it('a Sha goes to a Wei seat even when the Wu seat has less HP', () => {
    const s = game(LEAD_NEAR, { hp: { 'seat-b': 3, 'seat-f': 4 }, dangerous: ['seat-b'], cards: sha });
    const action = decideTable(s);
    expect(isPlayOf('sha')(action)).toBe(true);
    expect(targetsOf(action)).toEqual(['seat-f']);
  });

  it('rule-based-v4 on the same table still targets the weakest non-ally', () => {
    const s = game(LEAD_NEAR, { hp: { 'seat-b': 3, 'seat-f': 4 }, dangerous: ['seat-b'], cards: sha });
    expect(targetsOf(decideWith(ruleBasedV4Policy, s))).toEqual(['seat-b']);
  });

  it('a Wu truce partner at 2 HP is never the Sha target, even dangerous', () => {
    const s = game(LEAD_NEAR, { hp: { 'seat-b': 2 }, dangerous: ['seat-b'], cards: sha });
    expect(targetsOf(decideTable(s))).toEqual(['seat-f']);
  });

  it('with only a Wu truce partner at 2 HP in reach, the bot plays no Sha', () => {
    for (const dangerous of [[], ['seat-b']]) {
      const s = game(LEAD_FAR, { hp: { 'seat-b': 2 }, dangerous, cards: sha });
      expect(isPlayOf('sha')(decideTable(s))).toBe(false);
      expect(isPlayOf('sha')(decideWith(ruleBasedV4Policy, s))).toBe(true);
    }
  });

  it('a dangerous Wu partner at 4 HP is the Sha target only when no Wei seat is in reach', () => {
    const near = game(LEAD_NEAR, { dangerous: ['seat-b'], cards: sha });
    expect(targetsOf(decideTable(near))).toEqual(['seat-f']);
    const far = game(LEAD_FAR, { dangerous: ['seat-b'], cards: sha });
    expect(targetsOf(decideTable(far))).toEqual(['seat-b']);
  });

  it('a Wu partner at 4 HP that is not dangerous is never the Sha target', () => {
    const s = game(LEAD_FAR, { cards: sha });
    expect(isPlayOf('sha')(decideTable(s))).toBe(false);
  });

  it('Steal and Break skip a HOLD_FIRE seat', () => {
    const held = { 'seat-b:hand': [card('b1', 'peach', 'heart')] };
    for (const definitionId of ['steal', 'break']) {
      const s = game(LEAD_FAR, { hp: { 'seat-b': 2 }, cards: { ...held, 'seat-a:hand': [card(definitionId, definitionId)] } });
      expect(isPlayOf(definitionId)(decideWith(ruleBasedV4Policy, s))).toBe(true);
      expect(isPlayOf(definitionId)(decideTable(s))).toBe(false);
    }
  });

  it('a Chains pick skips a HOLD_FIRE seat', () => {
    // Only seat-b (truce, 2 HP) and seat-e (Wei) are unchained foes: v4 chains both, the table bot Recasts.
    const s = game(LEAD_FAR, { hp: { 'seat-b': 2 }, chained: ['seat-c', 'seat-d'], cards: { 'seat-a:hand': [card('chains', 'chains', 'club')] } });
    expect(targetsOf(decideWith(ruleBasedV4Policy, s))).toEqual(['seat-b', 'seat-e']);
    const action = decideTable(s);
    expect(isPlayOf('chains')(action)).toBe(true);
    expect(targetsOf(action)).toEqual([]);
  });

  it('with no leading force the Sha goes to the weakest foe, as before', () => {
    const s = game(NO_LEADER, { hp: { 'seat-b': 2, 'seat-f': 3 }, cards: sha });
    expect(targetsOf(decideTable(s))).toEqual(['seat-b']);
  });
});
