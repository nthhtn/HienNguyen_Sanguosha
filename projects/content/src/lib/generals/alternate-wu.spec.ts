import type { GameState } from 'engine';
import { card, handIds, harness, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, general: string): TableOptions['generals'] => ({ [seatId]: [general, 'filler-meng-huo', true] });
const pile = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'].map((id) => card(id, 'shan', 'spade'));
const hand = ['k1', 'k2', 'k3', 'k4', 'k5'].map((id) => card(id, 'shan', 'heart'));
const offered = (s: GameState, seatId: string, skillId: string) =>
  h.legal(s, seatId).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);
const sunQuan = (general: string, maxHp: number, equip = [card('cb', 'crossbow', 'diamond', 1)]) =>
  table({ 'seat-a:hand': hand, 'seat-a:equip': equip, drawPile: pile }, { generals: at('seat-a', general), maxHp: { 'seat-a': maxHp } });

describe('Alternate Sun Quan, Balance of Power', () => {
  const id = 'alternate:balance-of-power';

  it('offers at most 4 cards with combined max HP 4, and draws the same number', () => {
    let s = h.useSkill(sunQuan('alternate:sun-quan', 4), 'seat-a', id);
    expect(s.pendingSelection).toMatchObject({ min: 1, max: 4 });
    expect(s.pendingSelection!.eligibleIds).toHaveLength(6);
    s = h.select(s, 'k1', 'k2', 'k3', 'k4');
    expect(handIds(s, 'seat-a')).toEqual(['k5', 'd1', 'd2', 'd3', 'd4']);
  });

  it('is limited to 3 with combined max HP 3', () => {
    const s = h.useSkill(sunQuan('alternate:sun-quan', 3), 'seat-a', id);
    expect(s.pendingSelection).toMatchObject({ min: 1, max: 3 });
  });

  it('counts equipment cards toward the limit', () => {
    let s = h.useSkill(sunQuan('alternate:sun-quan', 4), 'seat-a', id);
    s = h.select(s, 'k1', 'k2', 'k3', 'cb');
    expect(handIds(s, 'seat-a')).toEqual(['k4', 'k5', 'd1', 'd2', 'd3', 'd4']);
  });

  it('is capped by the cards held when fewer than the limit', () => {
    const s = h.useSkill(table({ 'seat-a:hand': [card('k1', 'shan')], drawPile: pile }, { generals: at('seat-a', 'alternate:sun-quan'), maxHp: { 'seat-a': 4 } }), 'seat-a', id);
    expect(s.pendingSelection).toMatchObject({ min: 1, max: 1 });
  });

  it('is once per turn', () => {
    const s = h.select(h.useSkill(sunQuan('alternate:sun-quan', 4), 'seat-a', id), 'k1');
    expect(offered(s, 'seat-a', id)).toBe(false);
  });

  it('leaves Default Sun Quan able to discard every card', () => {
    const s = h.useSkill(sunQuan('sun-quan', 4), 'seat-a', 'reconsider');
    expect(s.pendingSelection).toMatchObject({ min: 1, max: 6 });
  });
});
