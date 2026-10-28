import { askedAbout, card, handIds, harness, hp, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const kw = harness(kwMode);
const at = (seatId: string, main: string, deputy = 'filler-jiang-wei', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const damages = (s: ReturnType<typeof table>) => s.log.flatMap((e) => (e.kind === 'DamageDealtEvent' ? [e.damage] : []));
// Everyone passes until nobody is asked; the seats asked, in order.
const passAll = (s: ReturnType<typeof table>) => {
  const asked: string[] = [];
  let cur = s;
  while (cur.pendingResponse) {
    asked.push(cur.pendingResponse.respondingSeatId);
    cur = h.pass(cur);
  }
  return { state: cur, asked };
};

describe('Meng Huo — Culprit', () => {
  const barbarians = (o: TableOptions = {}) => h.play(table({ 'seat-b:hand': [card('bb', 'barbarians', 'spade', 7)] }, { owner: 'seat-b', generals: at('seat-a', 'meng-huo'), ...o }), 'bb');

  it('Barbarians skips him, and the damage it deals elsewhere counts as his', () => {
    const { state, asked } = passAll(barbarians());
    expect(asked).toEqual(['seat-c', 'seat-d']);
    expect(hp(state, 'seat-a')).toBe(4);
    expect(damages(state)).toEqual([
      expect.objectContaining({ source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-c' } }),
      expect.objectContaining({ source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-d' } }),
    ]);
  });

  it('a hidden Meng Huo is asked whether to reveal him; Use skips him, Don’t leaves him hit and the source stays the user', () => {
    // His skill answers each damage to another seat, so the first ask comes at the first of them.
    let start = barbarians({ generals: at('seat-a', 'meng-huo', 'filler-jiang-wei', false) });
    while (start.pendingResponse && !start.pendingChoice) start = h.pass(start);
    expect(askedAbout(start)).toBe('culprit');
    expect(h.choose(start, 'use').seats[0].generals!.main.revealed).toBe(true);
    // Declining every ask leaves him hidden, hit like anyone, with the damage still the user's.
    let s = h.choose(start, 'decline');
    while (s.pendingResponse || s.pendingChoice) s = s.pendingChoice ? h.choose(s, 'decline') : h.pass(s);
    expect(s.seats[0].generals!.main.revealed).toBe(false);
    expect(damages(s).length).toBeGreaterThan(0);
    expect(damages(s).every((d) => d.source?.kind === 'seat' && d.source.seatId === 'seat-b')).toBe(true);
  });

  it('his own Barbarians keeps him as the source', () => {
    const own = h.play(table({ 'seat-a:hand': [card('bb', 'barbarians', 'spade', 7)] }, { generals: at('seat-a', 'meng-huo') }), 'bb');
    const { state } = passAll(own);
    expect(damages(state)).toHaveLength(3);
  });
});

describe('Meng Huo — Resurgence', () => {
  const pile = [card('h1', 'peach', 'heart', 5), card('s1', 'sha', 'spade', 6), card('h2', 'peach', 'heart', 7), card('c1', 'shan', 'club', 8), card('rest', 'shan', 'diamond', 9)];
  // seat-d's turn ends; seat-a's Draw Phase comes.
  const drawing = (o: TableOptions = {}, drawPile = pile) => kw.settle(table({ drawPile }, { generals: at('seat-a', 'meng-huo'), owner: 'seat-d', phase: 'End', hp: { 'seat-a': 2 }, ...o }));

  it('instead of drawing: reveal as many cards as missing HP; each heart heals 1 and is discarded; the rest go to his hand', () => {
    let s = drawing();
    expect(askedAbout(s)).toBe('resurgence');
    s = kw.use(s);
    expect(hp(s, 'seat-a')).toBe(3); // missing 2: h1 (heart) and s1 (spade) revealed
    expect(ids(s, 'discardPile')).toEqual(['h1']);
    expect(handIds(s, 'seat-a')).toEqual(['s1']);
    expect(ids(s, 'drawPile')).toEqual(['h2', 'c1', 'rest']);
  });

  it('two hearts heal 2 and both are discarded', () => {
    const s = kw.use(drawing({}, [card('h1', 'peach', 'heart', 5), card('h2', 'peach', 'heart', 7), card('x', 'sha')]));
    expect(hp(s, 'seat-a')).toBe(4);
    expect(ids(s, 'discardPile')).toEqual(['h1', 'h2']);
    expect(handIds(s, 'seat-a')).toEqual([]);
  });

  it("Don't draws normally; at full HP it is not offered", () => {
    expect(handIds(kw.decline(drawing()), 'seat-a')).toEqual(['h1', 's1']);
    expect(askedAbout(drawing({ hp: { 'seat-a': 4 } }))).toBeNull();
  });
});

describe('Zhu Rong — Giant Elephant', () => {
  const barbarians = (o: TableOptions = {}, owner = 'seat-b') =>
    h.play(table({ [`${owner}:hand`]: [card('bb', 'barbarians', 'spade', 7)] }, { owner, generals: at('seat-a', 'zhu-rong'), ...o }), 'bb');

  it("Barbarians skips her; after it finishes resolving she takes the card", () => {
    const { state, asked } = passAll(barbarians());
    expect(asked).toEqual(['seat-c', 'seat-d']);
    expect(handIds(state, 'seat-a')).toEqual(['bb']);
    expect(ids(state, 'discardPile')).toEqual([]);
    expect(hp(state, 'seat-a')).toBe(4);
  });

  it("not her own Barbarians (Review Focus 2); a hidden Zhu Rong is hit and takes nothing", () => {
    const own = passAll(h.play(table({ 'seat-a:hand': [card('bb', 'barbarians', 'spade', 7)] }, { generals: at('seat-a', 'zhu-rong') }), 'bb')).state;
    expect(ids(own, 'discardPile')).toEqual(['bb']);
    const hidden = passAll(barbarians({ generals: at('seat-a', 'zhu-rong', 'filler-jiang-wei', false) }));
    expect(hidden.asked).toEqual(['seat-c', 'seat-d', 'seat-a']);
    expect(handIds(hidden.state, 'seat-a')).toEqual([]);
  });
});

describe('Zhu Rong — Intense Edge', () => {
  // seat-a's Slash hits seat-b, who holds no Dodge.
  const hitB = (aHand: ReturnType<typeof card>[], bHand: ReturnType<typeof card>[], o: TableOptions = {}) =>
    h.pass(h.play(table({ 'seat-a:hand': [card('s1', 'sha'), ...aHand], 'seat-b:hand': bHand, 'seat-b:equip': [card('e', 'black-pommel', 'spade', 6)] }, { generals: at('seat-a', 'zhu-rong'), ...o }), 's1', 'seat-b'));

  it('after her Slash damages a seat she may compete; on a win she takes one of its cards', () => {
    let s = hitB([card('c9', 'sha', 'heart', 9)], [card('b5', 'sha', 'heart', 5), card('b6', 'peach', 'heart', 6)]);
    expect(askedAbout(s)).toBe('intense-edge');
    s = h.select(h.select(h.use(s), 'c9'), 'b5');
    expect(s.pendingChoice).toMatchObject({ verb: 'take', seatId: 'seat-a' });
    s = h.choose(s, 'e');
    expect(handIds(s, 'seat-a')).toEqual(['e']);
  });

  it('a tie loses: she takes nothing', () => {
    const s = h.select(h.select(h.use(hitB([card('c7', 'sha', 'heart', 7)], [card('b7', 'sha', 'heart', 7)])), 'c7'), 'b7');
    expect(s.pendingChoice).toBeUndefined();
    expect(handIds(s, 'seat-a')).toEqual([]);
  });

  it('is not offered without a hand card on both sides, or when the Slash did no damage', () => {
    expect(askedAbout(hitB([], [card('b5', 'sha')]))).toBeNull(); // her hand is empty after the Slash
    expect(askedAbout(hitB([card('c9', 'sha', 'heart', 9)], []))).toBeNull(); // its hand is empty
    const dodged = h.respond(h.play(table({ 'seat-a:hand': [card('s1', 'sha'), card('c9', 'sha', 'heart', 9)], 'seat-b:hand': [card('d', 'shan', 'heart', 2)] }, { generals: at('seat-a', 'zhu-rong') }), 's1', 'seat-b'), 'd');
    expect(askedAbout(dodged)).toBeNull();
  });
});
