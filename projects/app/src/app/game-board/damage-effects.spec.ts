import { EngineEvent } from 'engine';
import { damageEffectsFor } from './damage-effects';

const hit = (seatId: string, nature: 'normal' | 'fire' | 'thunder', as?: string): EngineEvent =>
  ({ kind: 'DamageDealtEvent', damage: { source: null, target: { kind: 'seat', seatId }, amount: 1, nature, ...(as ? { cause: { card: { as } } } : {}) } }) as never;

describe('damageEffectsFor', () => {
  it.each([
    ['normal', 'sha', 'slash'],
    ['normal', 'duel', 'damage'],
    ['normal', 'barbarians', 'damage'],
    ['normal', undefined, 'damage'], // a skill
    ['fire', 'fire-attack', 'slash-fire'],
    ['fire', 'sha', 'slash-fire'], // a Sha turned fire by Fire Fan
    ['fire', 'blaze', 'fire'],
    ['fire', undefined, 'fire'], // a skill
    ['thunder', 'lightning-attack', 'slash-lightning'],
    ['thunder', 'sha', 'slash-lightning'],
    ['thunder', 'lightning', 'lightning'],
    ['thunder', undefined, 'lightning'], // a skill, such as Lightning Strike
  ] as const)('%s damage from %s shows %s', (nature, as, image) => {
    expect(damageEffectsFor([hit('s1', nature, as)])).toEqual([{ seatId: 's1', image }]);
  });

  describe('a chained wave', () => {
    const toggled = (seatId: string): EngineEvent => ({ kind: 'ChainToggledEvent', seatId, chained: false });
    const passed = (seatId: string, nature: 'fire' | 'thunder'): EngineEvent =>
      ({ kind: 'DamageDealtEvent', damage: { source: null, target: { kind: 'seat', seatId }, amount: 1, nature, chained: true, cause: { card: { as: 'fire-attack' } } } }) as never;
    const seats = (effects: { seatId: string }[]) => effects.map((e) => e.seatId);

    it('shows fire on every chained seat at once, the one hit first included, even for a Sha', () => {
      const log = [hit('a', 'fire', 'fire-attack'), toggled('a'), passed('b', 'fire'), passed('c', 'fire')];
      expect(damageEffectsFor(log)).toEqual([
        { seatId: 'a', image: 'fire' },
        { seatId: 'b', image: 'fire' },
        { seatId: 'c', image: 'fire' },
      ]);
    });

    it('shows lightning for thunder', () => {
      expect(damageEffectsFor([hit('a', 'thunder'), toggled('a'), passed('b', 'thunder')]).map((e) => e.image)).toEqual(['lightning', 'lightning']);
    });

    it('finds the seats the chain reaches further along the log than the stretch', () => {
      const first = [hit('a', 'fire', 'fire-attack')];
      const ahead = [toggled('a'), passed('b', 'fire'), passed('c', 'fire')];
      expect(seats(damageEffectsFor(first, ahead))).toEqual(['a', 'b', 'c']);
    });

    it('shows nothing of its own for a hit passed along the chain', () => {
      expect(damageEffectsFor([passed('b', 'fire')])).toEqual([]);
    });

    it('stops at the next hit that starts its own wave', () => {
      const log = [hit('a', 'fire'), toggled('a'), passed('b', 'fire'), hit('x', 'normal', 'sha'), passed('z', 'fire')];
      expect(seats(damageEffectsFor(log))).toEqual(['a', 'b', 'x']);
    });

    it('keeps its own picture for fire damage to a seat that was not chained', () => {
      expect(damageEffectsFor([hit('a', 'fire', 'fire-attack')], [passed('b', 'fire')])).toEqual([{ seatId: 'a', image: 'slash-fire' }]);
    });
  });

  it('ignores everything but damage', () => {
    expect(damageEffectsFor([{ kind: 'HpLostEvent', seatId: 's1', amount: 1 }])).toEqual([]);
  });

  it('gives each damage event its own effect, in order', () => {
    expect(damageEffectsFor([hit('a', 'fire'), hit('b', 'fire')]).map((e) => e.seatId)).toEqual(['a', 'b']);
  });
});
