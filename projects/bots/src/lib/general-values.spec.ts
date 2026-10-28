import type { Action } from 'engine';
import { bestPair, HP_TIEBREAK, pairScore } from './general-values';
import { registry } from './testing';

type Choice = Extract<Action, { kind: 'ChooseGeneralsAction' }>;
const choose = (mainId: string, deputyId: string): Choice => ({ kind: 'ChooseGeneralsAction', seatId: 's', mainId, deputyId });
const wei = [...registry.generals.values()].filter((g) => g.kingdom === 'Wei').sort((a, b) => b.maxHp - a.maxHp);
const [bigA, bigB, ...rest] = wei;
const small = rest[rest.length - 1];
const smaller = rest[rest.length - 2];

describe('pairScore', () => {
  it('adds the two values and a small max HP term', () => {
    expect(pairScore({ [bigA.id]: 0.1, [bigB.id]: -0.02 }, registry, choose(bigA.id, bigB.id))).toBeCloseTo(0.08 + HP_TIEBREAK * (bigA.maxHp + bigB.maxHp), 10);
  });
  it('counts an absent id as 0', () => {
    expect(pairScore({}, registry, choose(bigA.id, bigB.id))).toBeCloseTo(HP_TIEBREAK * (bigA.maxHp + bigB.maxHp), 10);
  });
});

describe('pairScore with Kingdom Wars ids', () => {
  it('scores a Kingdom Wars pair as its Dynasty Wars pair, apart from the registry HP tiebreak', () => {
    const values = { 'cao-cao': 0.3, 'zhang-liao': 0.1 };
    const alt = pairScore(values, registry, choose('kingdomWars:cao-cao', 'kingdomWars:zhang-liao'));
    const def = pairScore(values, registry, choose('cao-cao', 'zhang-liao'));
    const hp = (id: string) => registry.generals.get(id)?.maxHp ?? 0;
    expect(alt - HP_TIEBREAK * (hp('kingdomWars:cao-cao') + hp('kingdomWars:zhang-liao'))).toBeCloseTo(0.4, 10);
    expect(def - HP_TIEBREAK * (hp('cao-cao') + hp('zhang-liao'))).toBeCloseTo(0.4, 10);
  });
});

describe('bestPair', () => {
  it('prefers a higher-valued pair over a higher-HP pair', () => {
    expect(bigA.maxHp + bigB.maxHp).toBeGreaterThan(small.maxHp + smaller.maxHp);
    const values = { [small.id]: 0.05, [smaller.id]: 0.05 };
    expect(bestPair(values, registry, [choose(bigA.id, bigB.id), choose(small.id, smaller.id)])).toEqual(choose(small.id, smaller.id));
  });
  it('falls back to max HP, then to the first legal choice, with no table', () => {
    expect(bestPair({}, registry, [choose(small.id, smaller.id), choose(bigA.id, bigB.id)])).toEqual(choose(bigA.id, bigB.id));
    expect(bestPair({}, registry, [choose(bigA.id, bigB.id), choose(bigB.id, bigA.id)])).toEqual(choose(bigA.id, bigB.id));
  });
});
