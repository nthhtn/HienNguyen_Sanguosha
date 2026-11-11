import type { Action, GameState, Seat } from 'engine';
import { weakestFirst } from '../helpers';
import { ruleBasedPolicy, ruleBasedV5Policy } from '../rule-based';
import { card, decideWaste, decideWith, registry, table } from '../testing';
import { chainsRule } from './tools';

const decide = (s: GameState) => decideWith(ruleBasedPolicy, s);
const seatIdsOf = (a: Action) => ('targets' in a ? a.targets.map((t) => (t.kind === 'seat' ? t.seatId : '')) : []);
// The table with some seats changed (chained, an Ambitionist).
const withSeats = (s: GameState, change: Record<string, Partial<Seat>>): GameState => ({ ...s, seats: s.seats.map((seat) => ({ ...seat, ...change[seat.id] })) });
const hidden: [string, string, boolean] = ['filler-xu-huang', 'filler-dong-zhuo', false];

describe('rules/tools: Amass', () => {
  it('amass: played with an ally at the table', () => {
    const s = table({ 'seat-a:hand': [card('am', 'amass')] }, { seats: 6 });
    expect(decide(s)).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 'am' });
  });

  it('amass: kept when alone', () => {
    const s = table({ 'seat-a:hand': [card('am', 'amass')] });
    expect(decide(s).kind).toBe('EndPhaseAction');
  });

  it('amass: an Ambitionist is alone', () => {
    const s = withSeats(table({ 'seat-a:hand': [card('am', 'amass')] }, { seats: 6 }), { 'seat-a': { allegiance: 'ambitionist' } });
    expect(decide(s).kind).toBe('EndPhaseAction');
  });
});

describe('rules/tools: Ally Far Attack Near', () => {
  it('ally far attack near: the least-liked seat gets the card', () => {
    // seat-d is Wei like seat-a, so not a target; weakest-first likes seat-b (1 HP) most.
    const s = table({ 'seat-a:hand': [card('af', 'ally-far-attack-near')] }, { hp: { 'seat-b': 1, 'seat-c': 4 }, kingdoms: { 'seat-d': 'Wei' } });
    const action = decide(s);
    expect(action).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 'af' });
    expect(seatIdsOf(action)).toEqual(['seat-c']);
  });

  it('ally far attack near: no exposed seat of another Kingdom → not played, phase ends', () => {
    const s = table(
      { 'seat-a:hand': [card('af', 'ally-far-attack-near')] },
      { kingdoms: { 'seat-b': 'Wei' }, generals: { 'seat-c': hidden, 'seat-d': hidden } },
    );
    expect(decide(s).kind).toBe('EndPhaseAction');
  });
});

describe('rules/tools: Harvest', () => {
  it('harvest: played when allies + 1 > foes (3 vs 2)', () => {
    const s = table({ 'seat-a:hand': [card('hv', 'harvest')] }, { seats: 5, kingdoms: { 'seat-d': 'Wei' } });
    expect(decide(s)).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 'hv' });
  });

  it('harvest: not played at 1 vs 3', () => {
    const s = table({ 'seat-a:hand': [card('hv', 'harvest')] });
    expect(decide(s).kind).toBe('EndPhaseAction');
  });

  it('harvest: an Ambitionist is alone', () => {
    const s = withSeats(table({ 'seat-a:hand': [card('hv', 'harvest')] }, { seats: 5, kingdoms: { 'seat-d': 'Wei' } }), { 'seat-a': { allegiance: 'ambitionist' } });
    expect(decide(s).kind).toBe('EndPhaseAction');
  });
});

describe('rules/tools: Ascertain', () => {
  it('ascertain: Recast late', () => {
    const s = table({ 'seat-a:hand': [card('as', 'ascertain')] });
    expect(decide(s)).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 'as', targets: [] });
  });
});

describe('rules/tools: Chains', () => {
  const chains = (o: Parameters<typeof table>[1] = {}) => table({ 'seat-a:hand': [card('ch', 'chains', 'club')] }, o);

  it('chains: two unchained foes → the two ranked highest', () => {
    const action = decide(chains({ hp: { 'seat-b': 3, 'seat-c': 1, 'seat-d': 2 } }));
    expect(action).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 'ch' });
    expect(action).not.toHaveProperty('pickTargets');
    expect(seatIdsOf(action)).toEqual(['seat-c', 'seat-d']);
  });

  it('chains: never an ally', () => {
    // seat-c is Wei like seat-a: the two foes are seat-b and seat-d.
    const action = decide(chains({ hp: { 'seat-b': 3, 'seat-c': 1, 'seat-d': 2 }, kingdoms: { 'seat-c': 'Wei' } }));
    expect(seatIdsOf(action)).toEqual(['seat-d', 'seat-b']);
  });

  it('chains: chained bot → itself plus a foe', () => {
    const action = decide(withSeats(chains({ hp: { 'seat-c': 1 } }), { 'seat-a': { chained: true } }));
    expect(seatIdsOf(action)).toEqual(['seat-a', 'seat-c']);
  });

  it('chains: chained bot with every foe chained → itself alone', () => {
    const s = withSeats(chains(), { 'seat-a': { chained: true }, 'seat-b': { chained: true }, 'seat-c': { chained: true }, 'seat-d': { chained: true } });
    expect(seatIdsOf(decide(s))).toEqual(['seat-a']);
  });

  it('chains: one unchained foe only → Recast (a chained foe is never toggled off)', () => {
    const s = withSeats(chains(), { 'seat-b': { chained: true }, 'seat-c': { chained: true } });
    expect(decide(s)).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 'ch', targets: [] });
    expect(decide(s)).not.toHaveProperty('pickTargets');
  });

  it('chains: converted Chains with no target that fits and no Recast → undefined, left to the ladder', () => {
    // A converted Chains offers no Recast: only the pick, here of the bot (unchained) and a chained foe.
    const s = withSeats(chains(), { 'seat-b': { chained: true } });
    const template: Action = { kind: 'PlayCardAction', seatId: 'seat-a', cardInstanceId: 'ch', targets: [], pickTargets: { eligibleIds: ['seat-a', 'seat-b'], min: 1, max: 2 } };
    const offered: Action[] = [{ kind: 'EndPhaseAction', seatId: 'seat-a' }, template];
    const me = s.seats.find((seat) => seat.id === 'seat-a')!;
    expect(chainsRule.play!.pick({ view: s, me, legal: [offered[0]], offered, registry, rank: weakestFirst })).toBeUndefined();
  });
});

describe('rules/tools: Blaze', () => {
  const holding = (others: number) =>
    table({
      'seat-a:hand': [card('bz', 'blaze'), ...Array.from({ length: others }, (_, i) => card(`k${i}`, 'shan', 'heart'))],
      'seat-b:hand': [card('b1', 'shan')],
      'seat-d:hand': [card('d1', 'shan')],
    }, { hp: { 'seat-b': 3, 'seat-c': 1, 'seat-d': 2 } });

  it('blaze: not played with only 2 other hand cards', () => {
    expect(decide(holding(2)).kind).toBe('EndPhaseAction');
  });

  it('blaze: with 3 other hand cards, at the top-ranked foe holding a hand card', () => {
    // seat-c is weakest but holds no card: seat-d (2 HP) is next.
    const action = decide(holding(3));
    expect(action).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 'bz' });
    expect(seatIdsOf(action)).toEqual(['seat-d']);
  });
});

describe('rules/tools: a hidden bot never targets itself', () => {
  it('chains: a hidden, unchained bot picks two foes, not itself', () => {
    const s = table({ 'seat-a:hand': [card('ch', 'chains', 'club')] }, { generals: { 'seat-a': hidden }, hp: { 'seat-a': 1 } });
    const ids = seatIdsOf(decide(s));
    expect(ids).toHaveLength(2);
    expect(ids).not.toContain('seat-a');
  });

  it('blaze: a hidden bot plays at a foe', () => {
    const s = table(
      { 'seat-a:hand': [card('bz', 'blaze'), card('k1', 'shan'), card('k2', 'shan'), card('k3', 'shan')], 'seat-b:hand': [card('b1', 'shan')] },
      { generals: { 'seat-a': hidden } },
    );
    expect(seatIdsOf(decide(s))).toEqual(['seat-b']);
  });
});

describe('rules/tools: surplus cards (D1)', () => {
  const spare = (defs: string[]) => defs.map((d, i) => card(`x${i}`, d, 'spade', i + 1));
  // Alone at 4 HP: Amass is usually kept; five cards in hand leave one over the limit.
  const alone = (extra: number) => table({ 'seat-a:hand': [card('am', 'amass'), ...spare(Array(extra).fill('shan'))] });

  it('amass: played when alone with a surplus card', () => {
    expect(decideWaste(alone(4))).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 'am' });
  });

  it('amass: kept when alone with no surplus', () => {
    expect(decideWaste(alone(3)).kind).toBe('EndPhaseAction');
  });

  it('amass: rule-based-v5 keeps it whatever the surplus', () => {
    expect(decideWith(ruleBasedV5Policy, alone(4)).kind).toBe('EndPhaseAction');
  });

  it('harvest: still kept when foes outnumber allies, whatever the surplus', () => {
    const s = table({ 'seat-a:hand': [card('hv', 'harvest'), ...spare(Array(5).fill('shan'))] });
    expect(decideWaste(s).kind).toBe('EndPhaseAction');
  });
});
