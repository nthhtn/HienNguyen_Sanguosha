import type { GameState, GeneralOwner } from 'engine';
import { redactStateForSeat } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, kwMode, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, general: string): TableOptions['generals'] => ({ [seatId]: [general, 'filler-meng-huo', true] });
const pile = Array.from({ length: 12 }, (_, i) => card(`d${i}`, 'shan', 'spade'));
const hit = (amount: number) => [
  { kind: 'DamageEffect' as const, damage: { source: null, target: { kind: 'seat' as const, seatId: 'seat-a' }, amount, nature: 'normal' as const, cause: {} } },
];
const xunYu = (general: string, own: Record<string, ReturnType<typeof card>[]> = {}, maxHp: Record<string, number> = {}) =>
  table({ drawPile: pile, ...own }, { generals: at('seat-a', general), maxHp });

describe('Kingdom Wars Xun Yu, Eternal Loyalty', () => {
  it('draws up to a max HP of 4 (3 cards from 1)', () => {
    let s = h.run(xunYu('kingdomWars:xun-yu', { 'seat-b:hand': [card('x', 'shan')] }), hit(1));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(4);
  });

  it('never draws above 5 cards with a max HP of 6', () => {
    let s = h.run(xunYu('kingdomWars:xun-yu', {}, { 'seat-b': 6 }), hit(1));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(5);
  });

  it('draws nothing when the hand is already at 5 with a max HP of 6', () => {
    const five = ['k1', 'k2', 'k3', 'k4', 'k5'].map((id) => card(id, 'shan', 'heart'));
    let s = h.run(xunYu('kingdomWars:xun-yu', { 'seat-b:hand': five }, { 'seat-b': 6 }), hit(1));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(5);
    expect(s.log.some((e) => e.kind === 'CardsDrawnEvent')).toBe(false);
  });

  it('asks once per point of damage', () => {
    let s = h.run(xunYu('kingdomWars:xun-yu', {}, { 'seat-b': 6, 'seat-c': 6 }), hit(2));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(5);
    s = h.choose(h.use(s), 'seat-c');
    expect(handIds(s, 'seat-c')).toHaveLength(5);
    expect(s.pendingChoice).toBeUndefined();
  });

  it('leaves Dynasty Wars Xun Yu drawing to a max HP of 6', () => {
    let s = h.run(xunYu('xun-yu', {}, { 'seat-b': 6 }), hit(1));
    s = h.choose(h.use(s), 'seat-b');
    expect(handIds(s, 'seat-b')).toHaveLength(6);
  });
});

describe('Kingdom Wars Guo Jia, Bequeathed Strategy', () => {
  const id = 'kingdomWars:bequeathed-strategy';
  const top = Array.from({ length: 8 }, (_, i) => card(`p${i}`, 'shan', 'heart', i + 1));
  const guoJia = (general: string, drawPile = top) => table({ drawPile }, { generals: at('seat-a', general) });
  const dmg = (amount: number) => [
    { kind: 'DamageEffect' as const, damage: { source: null, target: { kind: 'seat' as const, seatId: 'seat-a' }, amount, nature: 'normal' as const, cause: {} } },
  ];
  const pileIds = (s: GameState) => ids(s, 'drawPile');

  it('asks per point; Use shows only him the top 2 cards (no draw), then he gives one to B and the other to himself', () => {
    let s = h.run(guoJia('kingdomWars:guo-jia'), dmg(1));
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
    let s = h.choose(h.use(h.run(guoJia('kingdomWars:guo-jia'), dmg(1))), 'p0');
    s = h.choose(h.choose(s, 'seat-c'), 'seat-c');
    expect(handIds(s, 'seat-c')).toEqual(['p0', 'p1']);
  });

  it('asks again per point of damage, with fresh top cards', () => {
    let s = h.run(guoJia('kingdomWars:guo-jia'), dmg(2));
    s = h.choose(h.choose(h.choose(h.use(s), 'p0'), 'seat-b'), 'seat-b');
    expect(askedAbout(s)).toBe(id);
    s = h.use(s);
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['p2', 'p3']);
  });

  it('declining leaves the draw pile intact and nobody draws', () => {
    const s = h.decline(h.run(guoJia('kingdomWars:guo-jia'), dmg(1)));
    expect(pileIds(s)).toEqual(top.map((c) => c.instanceId));
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(s.pendingChoice).toBeUndefined();
  });

  it('does not offer a dead recipient', () => {
    const dead = guoJia('kingdomWars:guo-jia');
    const s0 = { ...dead, seats: dead.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) };
    const s = h.choose(h.use(h.run(s0, dmg(1))), 'p0');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-a', 'seat-b', 'seat-d']);
  });

  it('with 1 card in the pile he gives that one; with none nothing happens', () => {
    let s = h.use(h.run(guoJia('kingdomWars:guo-jia', [top[0]]), dmg(1)));
    expect(s.pendingChoice!.options.map((o) => o.id)).toContain('seat-b'); // straight to who gets it
    s = h.choose(s, 'seat-b');
    expect(handIds(s, 'seat-b')).toEqual(['p0']);
    expect(s.pendingChoice).toBeUndefined();
    s = h.use(h.run(guoJia('kingdomWars:guo-jia', []), dmg(1)));
    expect(s.pendingChoice).toBeUndefined();
  });

  it('the log says only that he used it', () => {
    const s = h.choose(h.choose(h.choose(h.use(h.run(guoJia('kingdomWars:guo-jia'), dmg(1))), 'p0'), 'seat-b'), 'seat-c');
    expect(abilityLog(s)).toHaveLength(1);
    const picks = s.log.filter((e) => e.kind === 'ChoiceMadeEvent' && e.reason.kind === 'ability' && e.reason.abilityId === id && e.shows.kind !== 'use');
    expect(picks).toHaveLength(3);
    expect(picks.every((e) => e.kind === 'ChoiceMadeEvent' && e.secret)).toBe(true);
    expect(JSON.stringify(picks)).not.toContain('"definitionId":"shan"');
  });

  it('only he sees the cards: another seat\'s view shows no options and the pile stays masked', () => {
    const s = h.use(h.run(guoJia('kingdomWars:guo-jia'), dmg(1)));
    const mine = redactStateForSeat(s, 'seat-a');
    expect(mine.pendingChoice!.options.map((o) => (o.shows.kind === 'card' ? o.shows.card.definitionId : null))).toEqual(['shan', 'shan']);
    const other = redactStateForSeat(s, 'seat-b');
    expect(other.pendingChoice!.options).toEqual([]);
    expect(JSON.stringify(other)).not.toContain('"definitionId":"shan"');
  });

  // The card each seat option carries: its id and its face (definitionId), or null.
  const carried = (s: GameState) => s.pendingChoice!.options.map((o) => (o.card ? { id: o.card.instanceId, face: o.card.definitionId } : null));

  it('the first recipient prompt shows Guo Jia the card he is giving, and the other seats nothing', () => {
    const s = h.choose(h.use(h.run(guoJia('kingdomWars:guo-jia'), dmg(1))), 'p1');
    const mine = redactStateForSeat(s, 'seat-a').pendingChoice!;
    expect(mine.options.map((o) => o.id)).toEqual(['seat-a', 'seat-b', 'seat-c', 'seat-d']);
    expect(mine.options.every((o) => o.card?.instanceId === 'p1' && o.card.definitionId === 'shan' && o.card.rank === 2)).toBe(true);
    for (const other of ['seat-b', 'seat-c', 'seat-d']) {
      const seen = redactStateForSeat(s, other).pendingChoice!;
      expect(seen.options).toEqual([]);
      expect(seen.options.some((o) => o.card)).toBe(false);
      expect(redactStateForSeat(s, other).pendingChoice).not.toHaveProperty('card');
    }
  });

  it('the rest card\'s recipient prompt shows only Guo Jia the other card', () => {
    const s = h.choose(h.choose(h.use(h.run(guoJia('kingdomWars:guo-jia'), dmg(1))), 'p1'), 'seat-b');
    expect(carried(s).every((c) => c?.id === 'p0' && c.face === 'shan')).toBe(true);
    const mine = redactStateForSeat(s, 'seat-a').pendingChoice!;
    expect(mine.options.every((o) => o.card?.instanceId === 'p0' && o.card.definitionId === 'shan')).toBe(true);
    const seen = redactStateForSeat(s, 'seat-b').pendingChoice!;
    expect(seen.options).toEqual([]);
    expect(JSON.stringify(seen)).not.toContain('p0');
  });

  it('with 1 card in the pile its recipient prompt shows him that card', () => {
    const s = h.use(h.run(guoJia('kingdomWars:guo-jia', [top[0]]), dmg(1)));
    expect(redactStateForSeat(s, 'seat-a').pendingChoice!.options.every((o) => o.card?.instanceId === 'p0' && o.card.definitionId === 'shan')).toBe(true);
  });

  it('Dynasty Wars Guo Jia still draws 2 in the same scenario', () => {
    const s = h.use(h.run(guoJia('guo-jia'), dmg(1)));
    expect(handIds(s, 'seat-a')).toEqual(['p0', 'p1']);
    expect(askedAbout(s)).toBe('bestowed-rouse');
  });
});

describe('Kingdom Wars Zhen Ji, Goddess Luo', () => {
  const id = 'kingdomWars:goddess-luo';
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
    let s = startOfTurn('kingdomWars:zhen-ji', [b1, b2, r1, ...rest]);
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

  it('Dynasty Wars Zhen Ji takes each black card at once in the same scenario', () => {
    let s = stub.use(startOfTurn('zhen-ji', [b1, b2, r1, ...rest]));
    expect(handIds(s, 'seat-a')).toEqual(['b1']);
    s = stub.use(stub.use(s));
    expect(handIds(s, 'seat-a')).toEqual(['b1', 'b2']);
    expect(ids(s, 'discardPile')).toEqual(['r1']);
  });

  it('stopping after one black card acquires that one', () => {
    const s = stub.decline(stub.use(startOfTurn('kingdomWars:zhen-ji', [b1, b2, r1, ...rest])));
    expect(handIds(s, 'seat-a')).toEqual(['b1']);
    expect(ids(s, 'seat-a:stash')).toEqual([]);
    expect(ids(s, 'drawPile')[0]).toBe('b2');
    expect(s.pendingChoice).toBeUndefined();
  });

  it('declining at the first ask does nothing', () => {
    const s = stub.decline(startOfTurn('kingdomWars:zhen-ji', [b1, b2, r1, ...rest]));
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(ids(s, 'drawPile')[0]).toBe('b1');
    expect(s.log.some((e) => e.kind === 'JudgmentEvent')).toBe(false);
  });

  it('with no card left to judge, the process ends and she acquires what she holds', () => {
    const s = stub.use(stub.use(startOfTurn('kingdomWars:zhen-ji', [b1])));
    expect(handIds(s, 'seat-a')).toEqual(['b1']);
    expect(s.pendingChoice).toBeUndefined();
  });

  it('a Sima Yi partner cannot replace her next judgment with a held black card (Dynasty Wars can)', () => {
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
    expect(devilPick('kingdomWars:zhen-ji')).toEqual(['h']);
    expect(devilPick('zhen-ji')).toEqual(['h', 'b1']);
  });

  it('if she dies between judgments, the held cards go to the discard pile (Guozhan elimination)', () => {
    const lethal = { kind: 'DamageEffect' as const, damage: { source: null, target: { kind: 'seat' as const, seatId: 'seat-a' }, amount: 1, nature: 'normal' as const, cause: {} } };
    const before = kw.use(startOfTurn('kingdomWars:zhen-ji', [b1, b2, r1, ...rest], { hp: 1, with: kw }));
    expect(ids(before, 'seat-a:stash')).toEqual(['b1']);
    let s = kw.run({ ...before, pendingChoice: undefined }, [lethal, pendingAsk(before)]);
    while (s.pendingResponse) s = kw.pass(s);
    expect(s.seats.find((x) => x.id === 'seat-a')!.eliminated).toBe(true);
    expect(ids(s, 'discardPile')).toContain('b1');
    expect(handIds(s, 'seat-a')).toEqual([]);
    // Dynasty Wars: the black card was already in her hand.
    expect(handIds(kw.use(startOfTurn('zhen-ji', [b1, b2, r1, ...rest], { hp: 1, with: kw })), 'seat-a')).toEqual(['b1']);
  });

  it('if she is out when the process ends, the held cards go to the discard pile, not her hand', () => {
    const before = stub.use(startOfTurn('kingdomWars:zhen-ji', [b1, b2, r1, ...rest]));
    const out = { ...before, pendingChoice: undefined, seats: before.seats.map((x) => (x.id === 'seat-a' ? { ...x, eliminated: true as const } : x)) };
    const s = stub.run(out, [pendingAsk(before)]);
    expect(ids(s, 'discardPile')).toEqual(['b1']);
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(ids(s, 'seat-a:stash')).toEqual([]);
  });
});

describe('Kingdom Wars Yue Jin, Dauntless', () => {
  const id = 'kingdomWars:dauntless';
  // Yue Jin is seat-a; the turn is seat-b's, in its Play Phase: ending it reaches the End Phase.
  const endTurn = (s: GameState) => h.act(s, { kind: 'EndPhaseAction', seatId: s.turn.ownerSeatId });
  const yue = (o: { hand?: ReturnType<typeof card>[]; victimHand?: ReturnType<typeof card>[]; victimEquip?: ReturnType<typeof card>[]; owner?: string; hp?: number } = {}) =>
    table(
      { 'seat-a:hand': o.hand ?? [card('b1', 'shan', 'heart'), card('t1', 'dismantle', 'spade')], 'seat-b:hand': o.victimHand ?? [], 'seat-b:equip': o.victimEquip ?? [] },
      { generals: at('seat-a', 'kingdomWars:yue-jin'), phase: 'Play', owner: o.owner ?? 'seat-b', hp: { 'seat-b': o.hp ?? 4 } }
    );
  const pickBasic = (s: GameState) => h.select(h.use(endTurn(s)), 'b1');
  const sword = card('e1', 'crossbow', 'diamond', 1);
  const horse = card('e2', 'ice-sword', 'spade', 2);

  it('is asked in another seat’s End Phase, and only while she holds a Basic hand card', () => {
    expect(askedAbout(endTurn(yue()))).toBe(id);
    expect(askedAbout(endTurn(yue({ hand: [card('t1', 'dismantle', 'spade')] })))).toBeNull();
    expect(askedAbout(endTurn(yue({ hand: [] })))).toBeNull();
  });

  it('is not asked in her own End Phase', () => {
    expect(askedAbout(endTurn(yue({ owner: 'seat-a' })))).toBeNull();
  });

  it('declining does nothing', () => {
    const s = h.decline(endTurn(yue()));
    expect(hp(s, 'seat-b')).toBe(4);
    expect(handIds(s, 'seat-a')).toHaveLength(2);
  });

  it('only a Basic card of her hand can be discarded', () => {
    const s = h.use(endTurn(yue()));
    expect(s.pendingSelection!.eligibleIds).toEqual(['b1']);
  });

  it('a victim with no Equipment card takes 1 damage from her, without a choice', () => {
    const s = pickBasic(yue({ victimHand: [card('v1', 'shan', 'heart')] }));
    expect(ids(s, 'discardPile')).toContain('b1');
    expect(hp(s, 'seat-b')).toBe(3);
    expect(s.pendingSelection).toBeFalsy();
    expect(s.log.some((e) => e.kind === 'DamageDealtEvent' && e.damage.source?.kind === 'seat' && e.damage.source.seatId === 'seat-a')).toBe(true);
  });

  it('the victim may discard an Equipment card from hand, taking no damage', () => {
    let s = pickBasic(yue({ victimHand: [card('v1', 'shan', 'heart'), horse], victimEquip: [sword] }));
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-b', eligibleIds: ['e2', 'e1'] });
    s = h.select(s, 'e2');
    expect(ids(s, 'discardPile')).toContain('e2');
    expect(hp(s, 'seat-b')).toBe(4);
  });

  it('the victim may discard a worn Equipment card, taking no damage', () => {
    const s = h.select(pickBasic(yue({ victimEquip: [sword] })), 'e1');
    expect(ids(s, 'discardPile')).toContain('e1');
    expect(ids(s, 'seat-b:equip')).toEqual([]);
    expect(hp(s, 'seat-b')).toBe(4);
  });

  it('the victim declining takes 1 damage and keeps the card', () => {
    const s = h.cancel(pickBasic(yue({ victimEquip: [sword] })));
    expect(hp(s, 'seat-b')).toBe(3);
    expect(ids(s, 'seat-b:equip')).toEqual(['e1']);
  });

  it('a hidden Yue Jin is asked too (using the skill reveals her)', () => {
    const t = yue();
    const hidden = { ...t, seats: t.seats.map((x) => (x.id === 'seat-a' ? { ...x, generals: { main: { ...x.generals!.main, revealed: false }, deputy: { ...x.generals!.deputy, revealed: false } } } : x)) };
    expect(askedAbout(endTurn(hidden))).toBe(id);
  });
});
