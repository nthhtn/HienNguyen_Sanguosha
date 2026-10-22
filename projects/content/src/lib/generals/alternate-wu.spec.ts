import type { GameState } from 'engine';
import { askedAbout, card, handIds, harness, table, TableOptions } from './skills.testing';

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

describe('Alternate Sun Shangxiang, Warrior Lady', () => {
  const id = 'alternate:warrior-lady';
  const her = (general: string, equip = [card('cb', 'crossbow', 'diamond', 1)], hand: ReturnType<typeof card>[] = []) =>
    table({ 'seat-a:equip': equip, 'seat-a:hand': hand, drawPile: pile }, { generals: at('seat-a', general) });
  const replace = (general: string) => h.play(her(general, undefined, [card('is', 'ice-sword', 'spade', 2)]), 'is');
  const pieces = () => [card('ax', 'axe', 'diamond', 5), card('ar', 'eight-trigrams', 'spade', 2), card('mt', 'chitu', 'heart', 5)];
  // An Axe discard of two other worn pieces, as Rock Cleaving Axe's selection queues it: two moves in a row.
  const twoLeave = (general: string) => {
    const s = her(general, pieces());
    return h.run(s, [
      { kind: 'MoveCardEffect', cardInstanceId: 'ar', toZoneId: 'discardPile' },
      { kind: 'MoveCardEffect', cardInstanceId: 'mt', toZoneId: 'discardPile' },
    ]);
  };

  it('asks when a worn card is replaced; accepting draws 2, declining draws 0', () => {
    const asked = replace('alternate:sun-shangxiang');
    expect(askedAbout(asked)).toBe(id);
    expect(handIds(h.use(asked), 'seat-a')).toEqual(['d1', 'd2']);
    expect(handIds(h.decline(asked), 'seat-a')).toEqual([]);
  });

  it('Default draws 2 at once with no ask for the same replacement', () => {
    const s = replace('sun-shangxiang');
    expect(s.pendingChoice).toBeUndefined();
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
  });

  it('asks once for two pieces leaving in one resolution and draws 2 in total', () => {
    const asked = twoLeave('alternate:sun-shangxiang');
    expect(askedAbout(asked)).toBe(id);
    const used = h.use(asked);
    expect(used.pendingChoice).toBeUndefined();
    expect(handIds(used, 'seat-a')).toEqual(['d1', 'd2']);
  });

  it('Default draws 2 for each of the two pieces', () => {
    expect(handIds(twoLeave('sun-shangxiang'), 'seat-a')).toEqual(['d1', 'd2', 'd3', 'd4']);
  });

  it('asks once after the Axe discards two other worn pieces', () => {
    let s = table(
      { 'seat-a:equip': pieces(), 'seat-a:hand': [card('s1', 'sha', 'spade', 7)], 'seat-b:hand': [card('sh', 'shan', 'heart', 2)], drawPile: pile },
      { generals: at('seat-a', 'alternate:sun-shangxiang') }
    );
    s = h.respond(h.play(s, 's1', 'seat-b'), 'sh');
    s = h.use(s);
    s = h.select(s, 'ar', 'mt');
    expect(askedAbout(s)).toBe(id);
    const used = h.use(s);
    expect(used.pendingChoice).toBeUndefined();
    expect(handIds(used, 'seat-a')).toEqual(['d1', 'd2']);
  });

  it('asks once when one effect moves her whole equipment area', () => {
    const asked = h.run(her('alternate:sun-shangxiang', pieces()), [{ kind: 'DiscardZoneEffect', zoneId: 'seat-a:equip' }]);
    expect(askedAbout(asked)).toBe(id);
    const used = h.use(asked);
    expect(used.pendingChoice).toBeUndefined();
    expect(handIds(used, 'seat-a')).toEqual(['d1', 'd2']);
  });

  it('asks again for a second, separate loss', () => {
    const first = h.use(
      h.run(her('alternate:sun-shangxiang', pieces()), [{ kind: 'MoveCardEffect', cardInstanceId: 'ar', toZoneId: 'discardPile' }])
    );
    expect(handIds(first, 'seat-a')).toEqual(['d1', 'd2']);
    const second = h.run(first, [{ kind: 'MoveCardEffect', cardInstanceId: 'mt', toZoneId: 'discardPile' }]);
    expect(askedAbout(second)).toBe(id);
    expect(handIds(h.use(second), 'seat-a')).toEqual(['d1', 'd2', 'd3', 'd4']);
  });
});
