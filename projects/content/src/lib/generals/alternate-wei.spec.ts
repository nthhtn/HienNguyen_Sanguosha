import type { GameState, GeneralOwner } from 'engine';
import { redactStateForSeat } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, general: string): TableOptions['generals'] => ({ [seatId]: [general, 'filler-meng-huo', true] });
const pile = Array.from({ length: 12 }, (_, i) => card(`d${i}`, 'shan', 'spade'));
const hit = (amount: number) => [
  { kind: 'DamageEffect' as const, damage: { source: null, target: { kind: 'seat' as const, seatId: 'seat-a' }, amount, nature: 'normal' as const, cause: {} } },
];
const xunYu = (general: string, own: Record<string, ReturnType<typeof card>[]> = {}, maxHp: Record<string, number> = {}) =>
  table({ drawPile: pile, ...own }, { generals: at('seat-a', general), maxHp });

describe('Alternate Xun Yu, Eternal Loyalty', () => {
  it('draws up to a max HP of 4 (3 cards from 1)', () => {
    let s = h.run(xunYu('alternate:xun-yu', { 'seat-b:hand': [card('x', 'shan')] }), hit(1));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(4);
  });

  it('never draws above 5 cards with a max HP of 6', () => {
    let s = h.run(xunYu('alternate:xun-yu', {}, { 'seat-b': 6 }), hit(1));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(5);
  });

  it('draws nothing when the hand is already at 5 with a max HP of 6', () => {
    const five = ['k1', 'k2', 'k3', 'k4', 'k5'].map((id) => card(id, 'shan', 'heart'));
    let s = h.run(xunYu('alternate:xun-yu', { 'seat-b:hand': five }, { 'seat-b': 6 }), hit(1));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(5);
    expect(s.log.some((e) => e.kind === 'CardsDrawnEvent')).toBe(false);
  });

  it('asks once per point of damage', () => {
    let s = h.run(xunYu('alternate:xun-yu', {}, { 'seat-b': 6, 'seat-c': 6 }), hit(2));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(5);
    s = h.choose(h.use(s), 'seat-c');
    expect(handIds(s, 'seat-c')).toHaveLength(5);
    expect(s.pendingChoice).toBeUndefined();
  });

  it('leaves Default Xun Yu drawing to a max HP of 6', () => {
    let s = h.run(xunYu('xun-yu', {}, { 'seat-b': 6 }), hit(1));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(6);
  });
});

describe('Alternate Guo Jia, Bequeathed Strategy', () => {
  const id = 'alternate:bequeathed-strategy';
  const top = Array.from({ length: 8 }, (_, i) => card(`p${i}`, 'shan', 'heart', i + 1));
  const guoJia = (general: string, drawPile = top) => table({ drawPile }, { generals: at('seat-a', general) });
  const dmg = (amount: number) => [
    { kind: 'DamageEffect' as const, damage: { source: null, target: { kind: 'seat' as const, seatId: 'seat-a' }, amount, nature: 'normal' as const, cause: {} } },
  ];
  const pileIds = (s: GameState) => ids(s, 'drawPile');

  it('asks per point; Use shows only him the top 2 cards (no draw), then he gives one to B and the other to himself', () => {
    let s = h.run(guoJia('alternate:guo-jia'), dmg(1));
    expect(askedAbout(s)).toBe(id);
    s = h.use(s);
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(pileIds(s).slice(0, 2)).toEqual(['p0', 'p1']);
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', secret: true });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['p0', 'p1']);
    expect(s.pendingChoice!.options.map((o) => o.shows)).toEqual([{ kind: 'card', card: top[0] }, { kind: 'card', card: top[1] }]);
    s = h.choose(s, 'p1');
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', secret: true });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a', 'seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-b');
    expect(handIds(s, 'seat-b')).toEqual(['p1']);
    // The remaining card goes to a seat of his choice, himself included.
    expect(s.pendingChoice!.options.map((o) => o.id)).toContain('seat-a');
    s = h.choose(s, 'seat-a');
    expect(handIds(s, 'seat-a')).toEqual(['p0']);
    expect(pileIds(s)[0]).toBe('p2');
    expect(s.pendingChoice).toBeUndefined();
  });

  it('may give both cards to the same player', () => {
    let s = h.choose(h.use(h.run(guoJia('alternate:guo-jia'), dmg(1))), 'p0');
    s = h.choose(h.choose(s, 'seat-c'), 'seat-c');
    expect(handIds(s, 'seat-c')).toEqual(['p0', 'p1']);
  });

  it('asks again per point of damage, with fresh top cards', () => {
    let s = h.run(guoJia('alternate:guo-jia'), dmg(2));
    s = h.choose(h.choose(h.choose(h.use(s), 'p0'), 'seat-b'), 'seat-b');
    expect(askedAbout(s)).toBe(id);
    s = h.use(s);
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['p2', 'p3']);
  });

  it('declining leaves the draw pile intact and nobody draws', () => {
    const s = h.decline(h.run(guoJia('alternate:guo-jia'), dmg(1)));
    expect(pileIds(s)).toEqual(top.map((c) => c.instanceId));
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(s.pendingChoice).toBeUndefined();
  });

  it('does not offer a dead recipient', () => {
    const dead = guoJia('alternate:guo-jia');
    const s0 = { ...dead, seats: dead.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) };
    const s = h.choose(h.use(h.run(s0, dmg(1))), 'p0');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a', 'seat-b', 'seat-d']);
  });

  it('with 1 card in the pile he gives that one; with none nothing happens', () => {
    let s = h.use(h.run(guoJia('alternate:guo-jia', [top[0]]), dmg(1)));
    expect(s.pendingChoice!.options.map((o) => o.id)).toContain('seat-b'); // straight to who gets it
    s = h.choose(s, 'seat-b');
    expect(handIds(s, 'seat-b')).toEqual(['p0']);
    expect(s.pendingChoice).toBeUndefined();
    s = h.use(h.run(guoJia('alternate:guo-jia', []), dmg(1)));
    expect(s.pendingChoice).toBeUndefined();
  });

  it('the log says only that he used it', () => {
    const s = h.choose(h.choose(h.choose(h.use(h.run(guoJia('alternate:guo-jia'), dmg(1))), 'p0'), 'seat-b'), 'seat-c');
    expect(abilityLog(s)).toHaveLength(1);
    expect(s.log.filter((e) => e.kind === 'ChoiceMadeEvent' && e.reason.kind === 'ability' && e.reason.abilityId === id && e.shows.kind !== 'use').every((e) => e.kind === 'ChoiceMadeEvent' && e.secret)).toBe(true);
  });

  it('only he sees the cards: another seat\'s view shows no options and the pile stays masked', () => {
    const s = h.use(h.run(guoJia('alternate:guo-jia'), dmg(1)));
    const mine = redactStateForSeat(s, 'seat-a');
    expect(mine.pendingChoice!.options.map((o) => (o.shows.kind === 'card' ? o.shows.card.definitionId : null))).toEqual(['shan', 'shan']);
    const other = redactStateForSeat(s, 'seat-b');
    expect(other.pendingChoice!.options).toEqual([]);
    expect(JSON.stringify(other)).not.toContain('"definitionId":"shan"');
  });

  it('Default Guo Jia still draws 2 in the same scenario', () => {
    let s = h.use(h.run(guoJia('guo-jia'), dmg(1)));
    expect(handIds(s, 'seat-a')).toEqual(['p0', 'p1']);
    expect(askedAbout(s)).toBe('bestowed-rouse');
  });
});

describe('Alternate Zhen Ji, Goddess Luo', () => {
  const id = 'alternate:goddess-luo';
  const stub = harness();
  const kw = harness(kwMode);
  type H = ReturnType<typeof harness>;
  // seat-d's turn ends; seat-a's starts, with `general` beside `partner`.
  const startOfTurn = (general: string, drawPile: ReturnType<typeof card>[], o: { partner?: string; hand?: ReturnType<typeof card>[]; hp?: number; with?: H } = {}) =>
    (o.with ?? stub).settle(
      table({ drawPile, 'seat-a:hand': o.hand ?? [] }, { generals: { 'seat-a': [general, o.partner ?? 'filler-xun-yu'] }, owner: 'seat-d', phase: 'End', hp: { 'seat-a': o.hp ?? 4 } })
    );
  const b1 = card('b1', 'sha', 'spade', 3);
  const b2 = card('b2', 'shan', 'club', 4);
  const r1 = card('r1', 'peach', 'heart', 5);
  const rest = [card('x1', 'shan', 'diamond', 6), card('x2', 'shan', 'diamond', 7), card('x3', 'shan', 'diamond', 8)];
  // The pending ask rebuilt as an effect, so a death can be queued before it (she dies between judgments).
  const pendingAsk = (s: GameState) => {
    const choice = s.pendingChoice!;
    const reason = choice.reason as Extract<typeof choice.reason, { kind: 'ability' }>;
    const effects = (optionId: string) => choice.options.find((o) => o.id === optionId)!.effects;
    return { kind: 'AskUseEffect' as const, owner: reason.owner as GeneralOwner, abilityId: reason.abilityId, effects: effects('use'), otherwise: effects('decline') };
  };

  it('two black cards then a red: the blacks wait off her hand, then she acquires both; the red is discarded', () => {
    let s = startOfTurn('alternate:zhen-ji', [b1, b2, r1, ...rest]);
    expect(askedAbout(s)).toBe(id);
    s = stub.use(s);
    expect(askedAbout(s)).toBe(id);
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(ids(s, 'seat-a:stash')).toEqual(['b1']);
    s = stub.use(s);
    expect(handIds(s, 'seat-a')).toEqual([]);
    s = stub.use(s);
    expect(handIds(s, 'seat-a')).toEqual(['b1', 'b2']);
    expect(ids(s, 'discardPile')).toEqual(['r1']);
    expect(ids(s, 'seat-a:stash')).toEqual([]);
    expect(ids(s, 'processing')).toEqual([]);
    expect(s.pendingChoice).toBeUndefined();
  });

  it('Default Zhen Ji takes each black card at once in the same scenario', () => {
    let s = stub.use(startOfTurn('zhen-ji', [b1, b2, r1, ...rest]));
    expect(handIds(s, 'seat-a')).toEqual(['b1']);
    s = stub.use(stub.use(s));
    expect(handIds(s, 'seat-a')).toEqual(['b1', 'b2']);
    expect(ids(s, 'discardPile')).toEqual(['r1']);
  });

  it('stopping after one black card acquires that one', () => {
    const s = stub.decline(stub.use(startOfTurn('alternate:zhen-ji', [b1, b2, r1, ...rest])));
    expect(handIds(s, 'seat-a')).toEqual(['b1']);
    expect(ids(s, 'seat-a:stash')).toEqual([]);
    expect(ids(s, 'drawPile')[0]).toBe('b2');
    expect(s.pendingChoice).toBeUndefined();
  });

  it('declining at the first ask does nothing', () => {
    const s = stub.decline(startOfTurn('alternate:zhen-ji', [b1, b2, r1, ...rest]));
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(ids(s, 'drawPile')[0]).toBe('b1');
    expect(s.log.some((e) => e.kind === 'JudgmentEvent')).toBe(false);
  });

  it('with no card left to judge, the process ends and she acquires what she holds', () => {
    const s = stub.use(stub.use(startOfTurn('alternate:zhen-ji', [b1])));
    expect(handIds(s, 'seat-a')).toEqual(['b1']);
    expect(s.pendingChoice).toBeUndefined();
  });

  it('a Sima Yi partner cannot replace her next judgment with a held black card (Default can)', () => {
    const h = card('h', 'peach', 'heart', 9);
    // Use, decline Devil on b1, judge again: Devil asks on b2; Use opens the hand-card pick.
    const devilPick = (general: string) => {
      let s = startOfTurn(general, [b1, b2, r1, ...rest], { partner: 'sima-yi', hand: [h] });
      s = stub.use(s);
      expect(askedAbout(s)).toBe('devil');
      s = stub.use(stub.decline(s));
      expect(askedAbout(s)).toBe('devil');
      return stub.use(s).pendingSelection?.eligibleIds;
    };
    expect(devilPick('alternate:zhen-ji')).toEqual(['h']);
    expect(devilPick('zhen-ji')).toEqual(['h', 'b1']);
  });

  it('if she dies between judgments, the held cards go to the discard pile (Kingdom War elimination)', () => {
    const lethal = { kind: 'DamageEffect' as const, damage: { source: null, target: { kind: 'seat' as const, seatId: 'seat-a' }, amount: 1, nature: 'normal' as const, cause: {} } };
    const before = kw.use(startOfTurn('alternate:zhen-ji', [b1, b2, r1, ...rest], { hp: 1, with: kw }));
    expect(ids(before, 'seat-a:stash')).toEqual(['b1']);
    let s = kw.run({ ...before, pendingChoice: undefined }, [lethal, pendingAsk(before)]);
    while (s.pendingResponse) s = kw.pass(s);
    expect(s.seats.find((x) => x.id === 'seat-a')!.eliminated).toBe(true);
    expect(ids(s, 'discardPile')).toContain('b1');
    expect(handIds(s, 'seat-a')).toEqual([]);
    // Default: the black card was already in her hand.
    expect(handIds(kw.use(startOfTurn('zhen-ji', [b1, b2, r1, ...rest], { hp: 1, with: kw })), 'seat-a')).toEqual(['b1']);
  });

  it('if she is out when the process ends, the held cards go to the discard pile, not her hand', () => {
    const before = stub.use(startOfTurn('alternate:zhen-ji', [b1, b2, r1, ...rest]));
    const out = { ...before, pendingChoice: undefined, seats: before.seats.map((x) => (x.id === 'seat-a' ? { ...x, eliminated: true as const } : x)) };
    const s = stub.run(out, [pendingAsk(before)]);
    expect(ids(s, 'discardPile')).toEqual(['b1']);
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(ids(s, 'seat-a:stash')).toEqual([]);
  });
});
