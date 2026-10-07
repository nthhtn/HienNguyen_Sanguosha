import type { GameState } from 'engine';
import { usedCardOf } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, kwMode, seat, table, TableOptions } from './skills.testing';

const stub = harness();
const kw = harness(kwMode);
const filler = (n: number) => Array.from({ length: n }, (_, i) => card(`f${i}`, 'shan', 'diamond', 1));
// seat-a's turn from its Start Phase, under Kingdom War's own triggers.
const judging = (cards: Record<string, ReturnType<typeof card>[]>, o: TableOptions) => kw.settle(table(cards, { phase: 'Start', ...o }));

describe("Guo Jia — Heaven's Envy", () => {
  const guoJia: TableOptions['generals'] = { 'seat-a': ['guo-jia', 'cao-pi'] };

  it('after a judgment of his takes effect, may take the judged card instead of discarding it', () => {
    const s = judging({ 'seat-a:judgment': [card('cp', 'capture', 'spade', 6)], drawPile: [card('j', 'sha', 'heart', 4), ...filler(4)] }, { generals: guoJia });
    expect(askedAbout(s)).toBe('heavens-envy');
    const taken = kw.use(s);
    expect(handIds(taken, 'seat-a')).toContain('j');
    expect(ids(taken, 'discardPile')).not.toContain('j');
    expect(ids(kw.decline(s), 'discardPile')).toContain('j');
  });

  it("is asked after Lightning's damage", () => {
    const s = judging({ 'seat-a:judgment': [card('li', 'lightning', 'spade', 1)], drawPile: [card('j', 'sha', 'spade', 5), ...filler(4)] }, { generals: guoJia });
    expect(hp(s, 'seat-a')).toBe(1);
    // The damage itself asks Bestowed Rouse first (3 times); the judgment's end asks Heaven's Envy.
    let after = s;
    while (askedAbout(after) === 'bestowed-rouse') after = kw.decline(after);
    expect(askedAbout(after)).toBe('heavens-envy');
    expect(handIds(kw.use(after), 'seat-a')).toContain('j');
  });

  it("works on an Eight Trigrams judgment, before the Shan it counts as", () => {
    let s = stub.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:equip': [card('et', 'eight-trigrams', 'spade', 2)], drawPile: [card('j', 'peach', 'heart', 3)] }, { generals: { 'seat-b': ['guo-jia', 'cao-pi'] } }), 's1', 'seat-b');
    s = stub.use(s); // Eight Trigrams
    expect(askedAbout(s)).toBe('heavens-envy');
    s = stub.use(s);
    expect(handIds(s, 'seat-b')).toEqual(['j']);
    expect(hp(s, 'seat-b')).toBe(4); // the red judgment still counted as a Shan
  });
});

describe('Sima Yi — Devil', () => {
  const capture = card('cp', 'capture', 'spade', 6);
  // seat-c is judged for a Capture; Devil holders at the seats given.
  const judged = (devils: string[], hands: Record<string, ReturnType<typeof card>[]>) => {
    const generals = Object.fromEntries(devils.map((id) => [id, ['sima-yi', 'xun-yu'] as [string, string]]));
    const cards = Object.fromEntries(Object.entries(hands).map(([id, cs]) => [`${id}:hand`, cs]));
    return stub.run(table({ ...cards, drawPile: [card('j', 'sha', 'club', 9)] }, { generals }), [
      { kind: 'JudgeEffect', seatId: 'seat-c', reader: { kind: 'card', card: usedCardOf(capture) } },
    ]);
  };

  it('may replace the judgment card with a hand card; the old one is discarded and the new one is read', () => {
    let s = judged(['seat-b'], { 'seat-b': [card('h1', 'peach', 'heart', 2)] });
    expect(askedAbout(s)).toBe('devil');
    expect(s.pendingChoice?.reason).toMatchObject({ targetSeatId: 'seat-c' });
    s = stub.select(stub.use(s), 'h1');
    expect(s.log.find((e) => e.kind === 'JudgmentChangedEvent')).toMatchObject({ judgedSeatId: 'seat-c', card: { instanceId: 'h1' }, replaced: { instanceId: 'j' } });
    expect(ids(s, 'discardPile')).toEqual(['j', 'h1']); // the old card, then the judged one once read
    expect(s.turn.flags).toBeUndefined(); // a heart spares the Capture
    expect(ids(s, 'processing')).toEqual([]);
  });

  it("Don't, or Cancel at the pick, lets the card stand", () => {
    expect(stub.decline(judged(['seat-b'], { 'seat-b': [card('h1', 'peach', 'heart')] })).turn.flags).toEqual({ skipPlay: true });
    expect(stub.cancel(stub.use(judged(['seat-b'], { 'seat-b': [card('h1', 'peach', 'heart')] }))).turn.flags).toEqual({ skipPlay: true });
  });

  it('is not asked without a hand card', () => {
    expect(judged(['seat-b'], {}).pendingChoice).toBeUndefined();
  });

  it('asks in seat order from the judged seat; after a replacement, from the seat after the one that replaced it', () => {
    const hands = { 'seat-b': [card('hb', 'peach', 'heart')], 'seat-d': [card('hd', 'shan', 'diamond')] };
    const s = judged(['seat-b', 'seat-d'], hands);
    expect(s.pendingChoice?.seatId).toBe('seat-d'); // c is judged: d comes before b
    expect(stub.decline(s).pendingChoice?.seatId).toBe('seat-b');
    const replaced = stub.select(stub.use(s), 'hd');
    expect(replaced.pendingChoice?.seatId).toBe('seat-b'); // after d: a (no Devil), then b
    const both = stub.select(stub.use(replaced), 'hb');
    expect(both.log.filter((e) => e.kind === 'JudgmentChangedEvent')).toHaveLength(2);
    expect(both.pendingChoice).toBeUndefined(); // d has no hand card left
  });
});

describe('Zhen Ji — River Goddess', () => {
  // seat-d's turn ends; seat-a's starts.
  const startOfTurn = (drawPile: ReturnType<typeof card>[]) => stub.settle(table({ drawPile }, { generals: { 'seat-a': ['zhen-ji', 'xun-yu'] }, owner: 'seat-d', phase: 'End' }));

  it('judges again and again: each black card to her hand, the first red one discarded', () => {
    let s = startOfTurn([card('b1', 'sha', 'spade'), card('b2', 'shan', 'club'), card('r1', 'peach', 'heart'), card('x', 'sha')]);
    expect(askedAbout(s)).toBe('river-goddess');
    s = stub.use(s);
    expect(askedAbout(s)).toBe('river-goddess');
    s = stub.use(s);
    s = stub.use(s);
    expect(handIds(s, 'seat-a')).toEqual(['b1', 'b2']);
    expect(ids(s, 'discardPile')).toEqual(['r1']);
    expect(s.pendingChoice).toBeUndefined();
  });

  it("Don't ends it", () => {
    let s = stub.use(startOfTurn([card('b1', 'sha', 'spade'), card('b2', 'shan', 'club')]));
    s = stub.decline(s);
    expect(handIds(s, 'seat-a')).toEqual(['b1']);
    expect(s.pendingChoice).toBeUndefined();
  });
});

describe('Zhen Ji — Overturned Country', () => {
  it('uses a black hand card as a Shan', () => {
    let s = stub.play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [card('k', 'wuxie', 'club', 4), card('r', 'peach', 'heart')] }, { owner: 'seat-b', generals: { 'seat-a': ['zhen-ji', 'xun-yu'] } }), 's1', 'seat-a');
    s = stub.convert(s, 'seat-a', 'overturned-country');
    expect(s.pendingSelection?.eligibleIds).toEqual(['k']);
    s = stub.select(s, 'k');
    expect(hp(s, 'seat-a')).toBe(4);
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent' && e.seatId === 'seat-a')).toMatchObject({ card: { as: 'shan', physical: [{ instanceId: 'k' }], via: { abilityId: 'overturned-country' } } });
  });

  it('is not offered in her own Play Phase', () => {
    const s = table({ 'seat-a:hand': [card('k', 'wuxie', 'club')] }, { generals: { 'seat-a': ['zhen-ji', 'xun-yu'] } });
    expect(stub.legal(s, 'seat-a').some((a) => a.kind === 'UseConversionAction')).toBe(false);
  });
});
