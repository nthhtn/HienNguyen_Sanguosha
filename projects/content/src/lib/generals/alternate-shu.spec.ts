import type { GameState } from 'engine';
import { card, handIds, harness, hp, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, general: string): TableOptions['generals'] => ({ [seatId]: [general, 'filler-meng-huo', true] });
const hand = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((id) => card(id, 'shan', 'spade'));
const liuBei = (general: string, combinedHp = 2) => table({ 'seat-a:hand': hand }, { generals: at('seat-a', general), hp: { 'seat-a': combinedHp } });
const give = (s: GameState, skillId: string, to: string, ...cards: string[]) => h.choose(h.select(h.useSkill(s, 'seat-a', skillId), ...cards), to);

describe('Alternate Liu Bei, Benevolence', () => {
  const alt = (s: GameState, to: string, ...cards: string[]) => give(s, 'alternate:benevolence', to, ...cards);

  it('giving 2 cards in the turn does not heal', () => {
    let s = alt(liuBei('alternate:liu-bei'), 'seat-b', 'k1');
    s = alt(s, 'seat-c', 'k2');
    expect(hp(s, 'seat-a')).toBe(2);
    expect(handIds(s, 'seat-b')).toEqual(['k1']);
  });

  it('giving the 3rd card heals 1', () => {
    let s = alt(liuBei('alternate:liu-bei'), 'seat-b', 'k1', 'k2');
    s = alt(s, 'seat-c', 'k3');
    expect(hp(s, 'seat-a')).toBe(3);
  });

  it('giving 5 cards in total heals once only', () => {
    let s = alt(liuBei('alternate:liu-bei'), 'seat-b', 'k1', 'k2', 'k3');
    expect(hp(s, 'seat-a')).toBe(3);
    s = alt(s, 'seat-c', 'k4', 'k5');
    expect(hp(s, 'seat-a')).toBe(3);
  });

  it('tracks its own counts under its own id, apart from Default Kindness', () => {
    const s = alt(liuBei('alternate:liu-bei'), 'seat-b', 'k1', 'k2');
    const keys = Object.keys(s.turn.abilityUses ?? {});
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key).toContain('alternate:benevolence');
      expect(key).not.toContain('kindness');
    }
  });

  it('is not an Alternate rule for a Default Liu Bei, who still heals at 2', () => {
    const s = give(liuBei('liu-bei'), 'kindness', 'seat-b', 'k1', 'k2');
    expect(hp(s, 'seat-a')).toBe(3);
  });
});
