import type { GameState } from 'engine';
import { buildContentRegistry } from '../registry';
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

describe('Alternate Lu Xun, Humility', () => {
  const id = 'alternate:humility';
  const zone = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
  const targets = (s: GameState, cardId: string) =>
    h.legal(s, s.turn.ownerSeatId).flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === cardId ? [a.targets[0]?.seatId] : []));
  // Seat-a holds Steal and Capture; seat-c holds a Wuxie; seat-b is Lu Xun with a card in hand.
  const tools = (general: string) =>
    table(
      { 'seat-a:hand': [card('st', 'steal', 'spade', 3), card('cp', 'capture', 'spade', 6)], 'seat-b:hand': [card('x', 'peach', 'heart')], 'seat-c:hand': [card('wx', 'wuxie', 'spade')] },
      { generals: at('seat-b', general) }
    );
  const noEffect = (s: GameState, cardId: string) =>
    s.log.filter((e) => e.kind === 'AbilityUsedEvent' && e.abilityId === id && e.outcome === 'no-effect' && e.targetSeatId === 'seat-a' && e.cardId === cardId);

  it('Default Lu Xun cannot be chosen by Steal or Capture', () => {
    expect(targets(tools('lu-xun'), 'st')).not.toContain('seat-b');
    expect(targets(tools('lu-xun'), 'cp')).not.toContain('seat-b');
  });

  it('can be chosen by Steal, which is cancelled: no Wuxie asked for, nothing taken', () => {
    const t = tools('alternate:lu-xun');
    expect(targets(t, 'st')).toContain('seat-b');
    const s = h.play(t, 'st', 'seat-b');
    expect(s.pendingResponse).toBeNull();
    expect(s.pendingChoice ?? null).toBeNull();
    expect(handIds(s, 'seat-b')).toEqual(['x']);
    expect(handIds(s, 'seat-a')).toEqual(['cp']);
    expect(zone(s, 'discardPile')).toContain('st');
    expect(noEffect(s, 'steal')).toHaveLength(1);
  });

  it('can be chosen by Capture, which is cancelled: no delayed card is placed, it is discarded', () => {
    const t = tools('alternate:lu-xun');
    expect(targets(t, 'cp')).toContain('seat-b');
    const s = h.play(t, 'cp', 'seat-b');
    expect(zone(s, 'seat-b:judgment')).toEqual([]);
    expect(zone(s, 'discardPile')).toContain('cp');
    expect(handIds(s, 'seat-a')).toEqual(['st']);
    expect(noEffect(s, 'capture')).toHaveLength(1);
  });

  it('Steal and Capture on another seat still work', () => {
    const t = tools('alternate:lu-xun');
    expect(zone(h.play(t, 'cp', 'seat-d'), 'seat-d:judgment')).toEqual(['cp']);
  });
});

describe('Alternate Zhang Zhao and Zhang Hong, Stabilization', () => {
  // seat-b's Discard Phase with `count` cards discarded; seat-a is the General under test.
  const phase = (general: string, count: number) => {
    const cards = Array.from({ length: 4 + count }, (_, i) => card(`k${i + 1}`, 'shan', 'heart', i + 1));
    const s = h.act(table({ 'seat-b:hand': cards }, { generals: at('seat-a', general), owner: 'seat-b' }), { kind: 'EndPhaseAction', seatId: 'seat-b' });
    return Array.from({ length: count }, (_, i) => `k${i + 1}`).reduce((acc, cid) => h.act(acc, { kind: 'DiscardCardAction', seatId: 'seat-b', cardInstanceId: cid }), s);
  };
  const alt = 'alternate:zhang-zhao-and-zhang-hong';

  it('with exactly 1 discarded card is asked, gives it back and takes nothing', () => {
    let s = phase(alt, 1);
    expect(askedAbout(s)).toBe('alternate:stabilization');
    s = h.choose(h.use(s), 'k1');
    expect(handIds(s, 'seat-b')).toContain('k1');
    expect(handIds(s, 'seat-a')).toEqual([]);
  });

  it('with 3 discarded gives 1 back and takes the other 2', () => {
    const s = h.choose(h.use(phase(alt, 3)), 'k2');
    expect(handIds(s, 'seat-b')).toContain('k2');
    expect(handIds(s, 'seat-a')).toEqual(['k1', 'k3']);
  });

  it('is not asked when nothing was discarded', () => {
    const cards = Array.from({ length: 3 }, (_, i) => card(`k${i + 1}`, 'shan', 'heart', i + 1));
    const s = h.act(table({ 'seat-b:hand': cards }, { generals: at('seat-a', alt), owner: 'seat-b' }), { kind: 'EndPhaseAction', seatId: 'seat-b' });
    expect(askedAbout(s)).toBeNull();
  });

  it('Default Zhang Zhao is not asked at 1 discarded card, but is at 2', () => {
    expect(askedAbout(phase('zhang-zhao-and-zhang-hong', 1))).toBeNull();
    expect(askedAbout(phase('zhang-zhao-and-zhang-hong', 2))).toBe('stubborn');
  });
});

describe('Alternate Lu Xun, Scrutinize', () => {
  const id = 'scrutinize-amass';
  const zone = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
  const pile12 = Array.from({ length: 12 }, (_, i) => card(`p${i}`, 'shan', 'club', i + 1));
  const tableFor = (general: string, hand = [card('r1', 'shan', 'heart', 3), card('r2', 'peach', 'diamond', 4), card('b1', 'shan', 'spade', 5)], more: Record<string, ReturnType<typeof card>[]> = {}) =>
    table({ 'seat-a:hand': hand, drawPile: pile12, ...more }, { generals: at('seat-a', general), kingdoms: { 'seat-a': 'Wu', 'seat-b': 'Shu', 'seat-c': 'Wu', 'seat-d': 'Qun' } });
  const converts = (s: GameState) => h.legal(s, 'seat-a').some((a) => a.kind === 'UseConversionAction' && a.via.conversionId === id);

  it('Default Lu Xun has no such conversion; Alternate Lu Xun has it', () => {
    expect(converts(tableFor('lu-xun'))).toBe(false);
    expect(converts(tableFor('alternate:lu-xun'))).toBe(true);
  });

  it('offers only red hand cards, as an Amass resolving for Kingdom members', () => {
    let s = h.convert(tableFor('alternate:lu-xun', undefined, { 'seat-c:hand': [card('c1', 'peach', 'heart')] }), 'seat-a', id);
    expect(s.pendingSelection?.eligibleIds).toEqual(['r1', 'r2']);
    s = h.select(s, 'r1');
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', min: 2, max: 2 });
    expect(handIds(s, 'seat-a')).toHaveLength(4);
    s = h.select(s, 'p0', 'p1');
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-c', min: 2, max: 2 });
    expect(handIds(s, 'seat-c')).toHaveLength(3);
    s = h.select(s, 'c1', 'p2');
    expect(handIds(s, 'seat-b')).toEqual([]);
    expect(s.pendingSelection ?? null).toBeNull();
    expect(zone(s, 'discardPile')).toContain('r1');
  });

  it('does not take equipment, and is not offered with only black cards', () => {
    const s = tableFor('alternate:lu-xun', [card('b1', 'shan', 'spade')], { 'seat-a:equip': [card('cb', 'crossbow', 'diamond', 1)] });
    expect(converts(s)).toBe(false);
  });

  it('can be done twice in a turn', () => {
    let s = h.convert(tableFor('alternate:lu-xun'), 'seat-a', id);
    s = h.select(h.select(h.select(s, 'r1'), 'p0', 'p1'), 'p2', 'p3');
    expect(converts(s)).toBe(true);
  });

  it('a Wuxie from another seat cancels the Amass for one target', () => {
    let s = h.select(h.convert(tableFor('alternate:lu-xun', undefined, { 'seat-b:hand': [card('wx', 'wuxie', 'spade')] }), 'seat-a', id), 'r1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', reason: { kind: 'wuxie' } });
  });

  it('is its own skill on the Alternate General, in place of Linked Camps', () => {
    const skills = buildContentRegistry().generals.get('alternate:lu-xun')!.skills.map((x) => x.id);
    expect(skills).toContain('alternate:scrutinize');
    expect(skills).not.toContain('linked-camps');
  });
});
