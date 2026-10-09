import { skillsInPlay } from 'engine';
import { askedAbout, card, handIds, harness, ids, registry, table, TableOptions } from './skills.testing';
import { seatDistance } from '../shared/queries';

const h = harness();
const at = (seatId: string, main: string, deputy = 'filler-jiang-wei', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const hand = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => card(`${prefix}${i + 1}`, 'shan', 'heart', i + 1));
const flags = (s: ReturnType<typeof table>) => s.turn.flags ?? {};

describe('Zhang He — Clever Change', () => {
  // seat-d's turn ends; seat-a's Start Phase comes.
  const starting = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    h.settle(table({ 'seat-a:hand': hand('a', 2), ...cards }, { generals: at('seat-a', 'zhang-he'), owner: 'seat-d', phase: 'End', ...o }));
  // Seat-a's Play Phase begins.
  const playing = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    h.settle(table({ 'seat-a:hand': hand('a', 2), ...cards }, { generals: at('seat-a', 'zhang-he'), phase: 'Draw', ...o }));

  it('Judgment Phase: asked as the turn starts when a card waits in the Judgment slot; Use discards a hand card and skips it', () => {
    let s = starting({ 'seat-a:judgment': [card('cap', 'capture', 'club')] });
    expect(askedAbout(s)).toBe('clever-change');
    s = h.select(h.use(s), 'a1');
    expect(ids(s, 'discardPile')).toEqual(['a1']);
    expect(flags(s)['skipJudgment']).toBe(true);
  });

  it('Judgment Phase: not asked with an empty Judgment slot or an empty hand', () => {
    expect(askedAbout(starting())).toBeNull();
    expect(askedAbout(starting({ 'seat-a:hand': [], 'seat-a:judgment': [card('cap', 'capture', 'club')] }))).toBeNull();
  });

  it('Draw Phase: skipping it takes 1 hand card from each of up to 2 chosen seats, and draws nothing', () => {
    const drawing = (o: TableOptions = {}) =>
      h.run(table({ 'seat-a:hand': hand('a', 2), 'seat-b:hand': hand('b', 2), 'seat-c:hand': hand('c', 1), drawPile: hand('d', 4) }, { generals: at('seat-a', 'zhang-he'), ...o }), [{ kind: 'DrawPhaseEffect', seatId: 'seat-a', count: 2 }]);
    let s = drawing();
    expect(askedAbout(s)).toBe('clever-change');
    s = h.select(h.use(s), 'a1');
    expect(s.pendingSelection).toMatchObject({ of: 'seats', min: 1, max: 2 });
    expect(s.pendingSelection!.eligibleIds).toEqual(['seat-b', 'seat-c']); // seat-d holds nothing
    s = h.select(s, 'seat-b', 'seat-c');
    expect(handIds(s, 'seat-a')).toHaveLength(3); // 2 − 1 discarded + 2 taken
    expect(handIds(s, 'seat-b')).toHaveLength(1);
    expect(handIds(s, 'seat-c')).toHaveLength(0);
    expect(ids(s, 'drawPile')).toHaveLength(4); // nothing drawn
  });

  it('Draw Phase: Don’t draws as usual; cancelling the payment goes back to the draw', () => {
    const drawing = () => h.run(table({ 'seat-a:hand': hand('a', 2), 'seat-b:hand': hand('b', 2), drawPile: hand('d', 4) }, { generals: at('seat-a', 'zhang-he') }), [{ kind: 'DrawPhaseEffect', seatId: 'seat-a', count: 2 }]);
    expect(handIds(h.decline(drawing()), 'seat-a')).toHaveLength(4);
    expect(handIds(h.cancel(h.use(drawing())), 'seat-a')).toHaveLength(4);
  });

  it('Play Phase: skipping it ends the phase and moves an equipment card to a free slot', () => {
    let s = playing({ 'seat-b:equip': [card('cb', 'crossbow', 'club')] });
    expect(askedAbout(s)).toBe('clever-change');
    s = h.select(h.use(s), 'a1');
    expect(flags(s)['endPlay']).toBe(true);
    s = h.select(s, 'seat-b'); // the seat to move a card from
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a' });
    s = h.choose(s, 'cb');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(ids(s, 'seat-c:equip')).toEqual(['cb']);
    expect(ids(s, 'seat-b:equip')).toEqual([]);
  });

  it('Play Phase: a slot already filled is not a destination, and a duplicate delayed Tool is not either', () => {
    let s = playing({ 'seat-b:equip': [card('cb', 'crossbow', 'club')], 'seat-c:equip': [card('cc', 'crossbow', 'spade')], 'seat-d:equip': [card('cd', 'crossbow', 'heart')] });
    s = h.choose(h.select(h.select(h.use(s), 'a1'), 'seat-b'), 'cb');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a']); // seat-c and seat-d already wear a Weapon
    const j = playing({ 'seat-b:judgment': [card('cap1', 'capture', 'club')], 'seat-c:judgment': [card('cap2', 'capture', 'spade')] });
    const picked = h.choose(h.select(h.select(h.use(j), 'a1'), 'seat-b'), 'cap1');
    expect(picked.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a', 'seat-d']); // seat-c already holds a Capture
  });

  it('Play Phase: not asked when nothing can be moved', () => {
    expect(askedAbout(playing())).toBeNull();
  });

  it('Discard Phase: asked when cards are owed; Use discards one and skips the phase', () => {
    let s = h.act(table({ 'seat-a:hand': hand('a', 6) }, { generals: at('seat-a', 'zhang-he') }), { kind: 'EndPhaseAction', seatId: 'seat-a' });
    expect(askedAbout(s)).toBe('clever-change');
    s = h.select(h.use(s), 'a1');
    expect(handIds(s, 'seat-a')).toHaveLength(5);
    expect(s.turn.ownerSeatId).toBe('seat-b'); // no discards owed any more: the turn moved on
  });

  it('Discard Phase: not asked with nothing owed', () => {
    const s = h.act(table({ 'seat-a:hand': hand('a', 2) }, { generals: at('seat-a', 'zhang-he') }), { kind: 'EndPhaseAction', seatId: 'seat-a' });
    expect(askedAbout(s)).toBeNull();
  });

  it('each phase is skipped once: the Judgment skip does not run the Draw Phase twice (Review Focus 5)', () => {
    let s = starting({ 'seat-a:judgment': [card('cap', 'capture', 'club')], drawPile: hand('d', 4) });
    s = h.select(h.use(s), 'a1');
    expect(s.log.filter((e) => e.kind === 'PhaseSkippedEvent')).toHaveLength(1);
  });
});

describe('Deng Ai — Military Farm and Strategic Pass', () => {
  // seat-b's turn, so seat-a (Deng Ai) is outside its own turn.
  const outside = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    table({ 'seat-a:hand': hand('a', 2), drawPile: [card('j1', 'shan', 'spade', 5), card('j2', 'shan', 'heart', 6)], ...cards }, { generals: at('seat-a', 'deng-ai'), owner: 'seat-b', ...o });
  const lose = (s: ReturnType<typeof table>, cardId = 'a1') => h.run(s, [{ kind: 'MoveCardEffect', cardInstanceId: cardId, toZoneId: 'discardPile' }]);

  it('loses a card outside his own turn: may judge; a non-heart becomes a Farm in his stash', () => {
    let s = lose(outside());
    expect(askedAbout(s)).toBe('military-farm');
    s = h.use(s);
    expect(ids(s, 'seat-a:stash')).toEqual(['j1']);
    expect(ids(s, 'discardPile')).toEqual(['a1']);
  });

  it('a heart is discarded instead', () => {
    const s = h.use(lose(outside({ drawPile: [card('j2', 'shan', 'heart', 6)] })));
    expect(ids(s, 'seat-a:stash')).toEqual([]);
    expect(ids(s, 'discardPile')).toContain('j2');
  });

  it('is not asked in his own turn, and Don’t does nothing', () => {
    expect(askedAbout(lose(outside({}, { owner: 'seat-a' })))).toBeNull();
    expect(ids(h.decline(lose(outside())), 'seat-a:stash')).toEqual([]);
  });

  it('a card worn counts too; a card that only moves from hand to the equipment slot does not', () => {
    expect(askedAbout(lose(outside({ 'seat-a:equip': [card('w', 'crossbow', 'club')] }), 'w'))).toBe('military-farm');
    expect(askedAbout(h.run(outside({ 'seat-a:hand': [card('w', 'crossbow', 'club')] }), [{ kind: 'MoveCardEffect', cardInstanceId: 'w', toZoneId: 'seat-a:equip' }]))).toBeNull();
  });

  it('the Farm that is gained does not trigger another judgment (Review Focus 5)', () => {
    const s = h.use(lose(outside()));
    expect(s.pendingChoice).toBeUndefined();
  });

  it('each Farm is a −1 horse for his distance to others, while he is revealed', () => {
    const six = (o: TableOptions = {}, c: Record<string, ReturnType<typeof card>[]> = {}) => table(c, { seats: 6, generals: at('seat-a', 'deng-ai'), ...o });
    const dist = (s: ReturnType<typeof table>) => seatDistance(s, 'seat-a', 'seat-d', registry);
    expect(dist(six())).toBe(3);
    expect(dist(six({}, { 'seat-a:stash': [card('f1', 'shan'), card('f2', 'shan')] }))).toBe(1);
    expect(dist(six({ generals: at('seat-a', 'deng-ai', 'filler-jiang-wei', false) }, { 'seat-a:stash': [card('f1', 'shan'), card('f2', 'shan')] }))).toBe(3);
  });

  it('Strategic Pass: at the start of his turn with 3 Farms he reduces his max HP and awakens, once', () => {
    const farms = [card('f1', 'shan'), card('f2', 'shan'), card('f3', 'shan')];
    let s = h.settle(table({ 'seat-a:stash': farms }, { generals: at('seat-a', 'deng-ai'), owner: 'seat-d', phase: 'End' }));
    expect(s.seats[0].maxCombinedHp).toBe(3);
    expect(s.seats[0].marks?.['awakened:strategic-pass']).toBe(1);
    // Next time round it does not fire again.
    s = h.settle({ ...s, turn: { ...s.turn, ownerSeatId: 'seat-d' }, phase: 'End' });
    expect(s.seats[0].maxCombinedHp).toBe(3);
  });

  it('Strategic Pass: not with 2 Farms', () => {
    const s = h.settle(table({ 'seat-a:stash': [card('f1', 'shan'), card('f2', 'shan')] }, { generals: at('seat-a', 'deng-ai'), owner: 'seat-d', phase: 'End' }));
    expect(s.seats[0].maxCombinedHp).toBe(4);
  });

  it('once awakened a Farm may be used as Steal; before that no', () => {
    const farms = [card('f1', 'shan', 'spade', 3)];
    const base = table({ 'seat-a:stash': farms, 'seat-b:hand': [card('x', 'sha')] }, { generals: at('seat-a', 'deng-ai') });
    expect(h.legal(base, 'seat-a').some((a) => a.kind === 'UseConversionAction' && a.via.conversionId === 'strategic-pass')).toBe(false);
    const awake = { ...base, seats: base.seats.map((x) => (x.id === 'seat-a' ? { ...x, marks: { 'awakened:strategic-pass': 1 } } : x)) };
    let s = h.select(h.convert(awake, 'seat-a', 'strategic-pass', 'seat-b'), 'f1'); // the Farm to use
    s = h.choose(s, 'hand');
    expect(handIds(s, 'seat-a')).toEqual(['x']);
    expect(ids(s, 'seat-a:stash')).toEqual([]);
  });

  it('Strategic Pass is off while Deng Ai is hidden', () => {
    const s = table({ 'seat-a:stash': [card('f1', 'shan'), card('f2', 'shan'), card('f3', 'shan')] }, { generals: at('seat-a', 'deng-ai', 'filler-jiang-wei', false) });
    expect(skillsInPlay(s, 'seat-a', registry).map((x) => x.skill.id)).not.toContain('strategic-pass');
  });
});
