import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, ids, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, deputy = 'filler-sun-jian', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const pile = Array.from({ length: 6 }, (_, i) => card(`d${i + 1}`, 'shan', 'heart', i + 1));
const drawnCount = (s: GameState) => s.log.reduce((n, e) => n + (e.kind === 'CardsDrawnEvent' ? e.cardInstanceIds.length : 0), 0);
const playTargets = (s: GameState, seatId: string, cardId: string) =>
  h.legal(s, seatId).flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === cardId ? [a.targets[0]?.seatId] : []));

describe('Da Qiao — Country Scene', () => {
  it('uses a diamond card from her hand or equipment as a Capture; it lies in the Judgment slot as one', () => {
    const s = table({ 'seat-a:hand': [card('dm', 'shan', 'diamond', 3), card('hr', 'peach', 'heart')], 'seat-a:equip': [card('dy', 'da-yuan', 'diamond', 13)] }, { generals: at('seat-a', 'da-qiao') });
    const selecting = h.convert(s, 'seat-a', 'country-scene', 'seat-b');
    expect(selecting.pendingSelection?.eligibleIds).toEqual(['dm', 'dy']);
    const placed = h.select(selecting, 'dm');
    const slot = placed.zones.find((z) => z.id === 'seat-b:judgment')!;
    expect(slot.cards.map((c) => c.instanceId)).toEqual(['dm']);
    expect(slot.countsAs).toEqual({ dm: 'capture' });
    expect(ids(placed, 'discardPile')).toEqual([]);
  });
});

describe('Gan Ning — Surprise', () => {
  it('uses a black card from his hand or equipment as a Break', () => {
    const s = table({ 'seat-a:hand': [card('k', 'shan', 'spade')], 'seat-b:equip': [card('cb', 'crossbow', 'diamond', 1)] }, { generals: at('seat-a', 'gan-ning') });
    const picking = h.select(h.convert(s, 'seat-a', 'surprise', 'seat-b'), 'k');
    expect(picking.pendingChoice).toMatchObject({ seatId: 'seat-a', verb: 'discard' });
    expect(ids(h.choose(picking, 'cb'), 'seat-b:equip')).toEqual([]);
  });
});

describe('Lu Xun — Humility', () => {
  it('Steal and Capture can’t target him', () => {
    const s = table({ 'seat-a:hand': [card('st', 'steal'), card('cp', 'capture', 'spade', 6)], 'seat-b:hand': [card('x', 'shan')] }, { generals: at('seat-b', 'lu-xun') });
    expect(playTargets(s, 'seat-a', 'st')).not.toContain('seat-b');
    expect(playTargets(s, 'seat-a', 'cp')).not.toContain('seat-b');
  });
});

describe('Lu Xun — Linked Camps', () => {
  const luXun = (hand: ReturnType<typeof card>[], o: TableOptions = {}, more: Record<string, ReturnType<typeof card>[]> = {}) =>
    table({ 'seat-a:hand': hand, drawPile: pile, ...more }, { generals: at('seat-a', 'lu-xun'), ...o });

  it('draws 1 when he plays his last hand card', () => {
    const s = h.play(luXun([card('s1', 'sha')]), 's1', 'seat-b');
    expect(handIds(s, 'seat-a')).toEqual(['d1']);
    expect(abilityLog(s)).toEqual([expect.objectContaining({ abilityId: 'linked-camps', outcome: 'used' })]);
  });

  it('draws 1 when it is discarded, discarded by Break, or taken by another seat', () => {
    expect(handIds(h.run(luXun([card('x', 'shan')]), [{ kind: 'MoveCardEffect', cardInstanceId: 'x', toZoneId: 'discardPile' }]), 'seat-a')).toEqual(['d1']);
    let broken = h.play(luXun([card('x', 'shan')], { owner: 'seat-b' }, { 'seat-b:hand': [card('br', 'break', 'spade', 3)] }), 'br', 'seat-a');
    broken = h.choose(broken, 'hand');
    expect(handIds(broken, 'seat-a')).toEqual(['d1']);
    const taken = h.run(luXun([card('x', 'shan')]), [{ kind: 'MoveRandomCardEffect', fromZoneId: 'seat-a:hand', toZoneId: 'seat-c:hand' }]);
    expect(handIds(taken, 'seat-a')).toEqual(['d1']);
  });

  it('only once when a Serpent Spear Slash takes his last two', () => {
    const s = h.select(h.convert(luXun([card('x1', 'shan'), card('x2', 'peach', 'heart')], {}, { 'seat-a:equip': [card('sp', 'serpent-spear', 'spade', 12)] }), 'seat-a', 'serpent-spear', 'seat-b'), 'x1', 'x2');
    expect(drawnCount(s)).toBe(1);
  });

  it('not while a card is left, and not while he is hidden', () => {
    expect(handIds(h.play(luXun([card('s1', 'sha'), card('x', 'shan')]), 's1', 'seat-b'), 'seat-a')).toEqual(['x']);
    expect(handIds(h.play(luXun([card('s1', 'sha')], { generals: at('seat-a', 'lu-xun', 'filler-sun-jian', false) }), 's1', 'seat-b'), 'seat-a')).toEqual([]);
  });
});

describe('Sun Shangxiang — Armed Consorts', () => {
  const her = (equip: ReturnType<typeof card>[], hand: ReturnType<typeof card>[], deputy = 'filler-sun-jian', o: TableOptions = {}, more = {}) =>
    table({ 'seat-a:equip': equip, 'seat-a:hand': hand, drawPile: pile, ...more }, { generals: at('seat-a', 'sun-shangxiang', deputy), ...o });

  it('draws 2 when a worn card is replaced', () => {
    const s = h.play(her([card('cb', 'crossbow', 'diamond', 1)], [card('is', 'ice-sword', 'spade', 2)]), 'is');
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
  });

  it('draws 2 when Steal takes a worn card', () => {
    let s = h.play(her([card('cb', 'crossbow', 'diamond', 1)], [], 'filler-sun-jian', { owner: 'seat-b' }, { 'seat-b:hand': [card('st', 'steal', 'spade', 3)] }), 'st', 'seat-a');
    s = h.choose(s, 'cb');
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
  });

  it('draws 2 when she uses a worn card through a conversion', () => {
    const s = h.select(h.convert(her([card('cb', 'crossbow', 'club', 1)], [], 'gan-ning', {}, { 'seat-b:hand': [card('x', 'shan')] }), 'seat-a', 'surprise', 'seat-b'), 'cb');
    expect(handIds(s, 'seat-a')).toEqual(['d1', 'd2']);
  });
});

describe('Lu Meng — Self-Restraint', () => {
  // seat-a at 2 HP holds 4 cards: ending its Play Phase brings the Discard Phase.
  const ending = (o: TableOptions = {}) => {
    const s = table({ 'seat-a:hand': [card('k1', 'shan'), card('k2', 'shan'), card('k3', 'peach', 'heart'), card('k4', 'shan')] }, { generals: at('seat-a', 'lu-meng'), hp: { 'seat-a': 2 }, ...o });
    return h.act(s, { kind: 'EndPhaseAction', seatId: 'seat-a' });
  };

  it('with no Slash used this turn, may skip the Discard Phase', () => {
    const s = ending();
    expect(askedAbout(s)).toBe('self-restraint');
    const skipped = h.use(s);
    expect(handIds(skipped, 'seat-a')).toHaveLength(4);
    expect(skipped.turn.ownerSeatId).toBe('seat-b');
    expect(h.legal(h.decline(s), 'seat-a').every((a) => a.kind === 'DiscardCardAction')).toBe(true);
  });

  it('is not asked after any Slash this turn, answers included', () => {
    expect(ending({ ownerUses: { sha: 1 } }).pendingChoice).toBeUndefined();
  });

  it('is not asked with nothing to discard', () => {
    expect(ending({ hp: { 'seat-a': 4 } }).pendingChoice).toBeUndefined();
  });
});
