import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, ids, kwMode, table, TableOptions } from './skills.testing';
import { readyKingdomWarsSkills } from '../kingdomWarsSkills';
import { kingdomWarsGeneralRecords } from '../kingdomWarsGenerals';

const h = harness();
const kw = harness(kwMode);
const at = (seatId: string, general: string): TableOptions['generals'] => ({ [seatId]: [general, 'filler-meng-huo', true] });
const hand = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((id) => card(id, 'shan', 'spade'));
const liuBei = (general: string, combinedHp = 2) => table({ 'seat-a:hand': hand }, { generals: at('seat-a', general), hp: { 'seat-a': combinedHp } });
const give = (s: GameState, skillId: string, to: string, ...cards: string[]) => h.choose(h.select(h.useSkill(s, 'seat-a', skillId), ...cards), to);

describe('Kingdom Wars Liu Bei, Benevolence', () => {
  const alt = (s: GameState, to: string, ...cards: string[]) => give(s, 'kingdomWars:benevolence', to, ...cards);

  it('giving 2 cards in the turn does not heal', () => {
    let s = alt(liuBei('kingdomWars:liu-bei'), 'seat-b', 'k1');
    s = alt(s, 'seat-c', 'k2');
    expect(hp(s, 'seat-a')).toBe(2);
    expect(handIds(s, 'seat-b')).toEqual(['k1']);
  });

  it('giving the 3rd card heals 1', () => {
    let s = alt(liuBei('kingdomWars:liu-bei'), 'seat-b', 'k1', 'k2');
    s = alt(s, 'seat-c', 'k3');
    expect(hp(s, 'seat-a')).toBe(3);
  });

  it('giving 5 cards in total heals once only', () => {
    let s = alt(liuBei('kingdomWars:liu-bei'), 'seat-b', 'k1', 'k2', 'k3');
    expect(hp(s, 'seat-a')).toBe(3);
    s = alt(s, 'seat-c', 'k4', 'k5');
    expect(hp(s, 'seat-a')).toBe(3);
  });

  it('tracks its own counts under its own id, apart from Dynasty Wars Kindness', () => {
    const s = alt(liuBei('kingdomWars:liu-bei'), 'seat-b', 'k1', 'k2');
    const keys = Object.keys(s.turn.abilityUses ?? {});
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key).toContain('kingdomWars:benevolence');
      expect(key).not.toContain('kindness');
    }
  });

  it('is not a Kingdom Wars rule for a Dynasty Wars Liu Bei, who still heals at 2', () => {
    const s = give(liuBei('liu-bei'), 'kindness', 'seat-b', 'k1', 'k2');
    expect(hp(s, 'seat-a')).toBe(3);
  });
});

describe('Kingdom Wars Zhu Rong, Fearsome Blade', () => {
  const rong = (general: string, sha = 'sha', chained: string[] = []) => {
    const t = table(
      { 'seat-a:hand': [card('s1', sha), card('c9', 'sha', 'heart', 9)], 'seat-b:hand': [card('b5', 'sha', 'heart', 5)], 'seat-c:hand': [card('d5', 'sha', 'heart', 5)] },
      { generals: at('seat-a', general) },
    );
    return { ...t, seats: t.seats.map((x) => (chained.includes(x.id) ? { ...x, chained: true as const } : x)) };
  };
  const hitB = (general: string, sha?: string, chained?: string[]) => h.pass(h.play(rong(general, sha, chained), 's1', 'seat-b'));
  it('her Slash damaging its target offers the compete', () => {
    expect(askedAbout(hitB('kingdomWars:zhu-rong'))).toBe('kingdomWars:fearsome-blade');
  });

  // Dynasty Wars behaves the same here: chained damage is never Slash damage. This does not show the variant's difference.
  it('chained damage reaching another seat is not offered the compete', () => {
    const first = hitB('kingdomWars:zhu-rong', 'fire-attack', ['seat-b', 'seat-c']);
    expect(askedAbout(first)).toBe('kingdomWars:fearsome-blade'); // for seat-b, the seat aimed at
    expect(first.pendingChoice).toMatchObject({ seatId: 'seat-a' });
    const s = h.decline(first);
    expect(hp(s, 'seat-c')).toBeLessThan(4);
    expect(s.log.filter((e) => e.kind === 'DamageDealtEvent')).toHaveLength(2);
    expect(askedAbout(s)).toBeNull();
  });

  it('records the seat the Slash was aimed at on the damage it deals', () => {
    const s = hitB('kingdomWars:zhu-rong');
    expect(s.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { cause: { aimedAt: 'seat-b' } } });
  });

  // Non-chained Slash damage on seat-c, from a Slash aimed elsewhere (a redirect): where the variant differs from Dynasty Wars.
  const strikeC = (general: string, aimedAt?: string) => {
    const sha = card('s1', 'sha');
    const used = { as: 'sha', colour: 'black' as const, physical: [{ definitionId: 'sha', instanceId: 's1', suit: 'spade' as const, rank: 7 }] };
    return h.run(rong(general), [
      { kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-c' }, amount: 1, nature: 'normal', cause: { card: used, cardInstanceId: sha.instanceId, ...(aimedAt ? { aimedAt } : {}) } } },
    ]);
  };

  it('is not offered for damage on a seat the Slash was not aimed at; Dynasty Wars is', () => {
    expect(askedAbout(strikeC('kingdomWars:zhu-rong', 'seat-b'))).toBeNull();
    expect(askedAbout(strikeC('zhu-rong', 'seat-b'))).toBe('intense-edge');
  });

  it('is not offered when the cause records no aimed seat; Dynasty Wars is', () => {
    expect(askedAbout(strikeC('kingdomWars:zhu-rong'))).toBeNull();
    expect(askedAbout(strikeC('zhu-rong'))).toBe('intense-edge');
  });

  it('is offered for damage on the seat the Slash was aimed at', () => {
    expect(askedAbout(strikeC('kingdomWars:zhu-rong', 'seat-c'))).toBe('kingdomWars:fearsome-blade');
  });

  it('Dynasty Wars Zhu Rong keeps her own id and still competes', () => {
    expect(askedAbout(hitB('zhu-rong'))).toBe('intense-edge');
  });
});

describe('Kingdom Wars Huang Yueying, Assembling Wisdom', () => {
  const id = 'kingdomWars:assembling-wisdom';
  const pile = Array.from({ length: 4 }, (_, i) => card(`p${i + 1}`, 'shan', 'heart', i + 1));
  const drawn = (s: GameState) => s.log.flatMap((e) => (e.kind === 'CardsDrawnEvent' ? [e.cardInstanceIds.length] : []));
  // Pang Tong is the Deputy so Shackle can convert a club into Chains.
  const yueying = (general: string, hands: Record<string, ReturnType<typeof card>[]>, owner?: string) =>
    table({ ...hands, drawPile: pile }, { ...(owner ? { owner } : {}), generals: { 'seat-a': [general, 'pang-tong', true] } });
  const asChains = (s: GameState) => {
    const t = h.legal(s, 'seat-a').find((a) => a.kind === 'UseConversionAction' && a.via.conversionId === 'shackle-chains' && a.pickTargets);
    if (t?.kind !== 'UseConversionAction') throw new Error('no Chains template');
    const { pickTargets: _pick, ...use } = t;
    return h.select(h.act(s, { ...use, targets: [{ kind: 'seat' as const, seatId: 'seat-b' }] }), 'c1');
  };
  const chains = (general: string) => asChains(yueying(general, { 'seat-a:hand': [card('c1', 'sha', 'club', 4)] }));

  it('a real Draw Two asks, and drawing takes 1 more', () => {
    const s = h.play(yueying('kingdomWars:huang-yueying', { 'seat-a:hand': [card('dt', 'draw-two', 'heart', 7)] }), 'dt');
    expect(askedAbout(s)).toBe(id);
    expect(drawn(h.use(s))).toEqual([1, 2]);
  });

  it('Chains converted from a club by Shackle does not draw; Dynasty Wars Huang Yueying is asked', () => {
    const alt = chains('kingdomWars:huang-yueying');
    expect(alt.pendingChoice).toBeUndefined();
    expect(drawn(alt)).toEqual([]);
    expect(askedAbout(chains('huang-yueying'))).toBe('gathering-wisdom');
  });

  it('a real Wuxie she plays still draws', () => {
    let s = h.play(yueying('kingdomWars:huang-yueying', { 'seat-b:hand': [card('st', 'steal', 'spade', 3)], 'seat-a:hand': [card('wx', 'wuxie', 'spade', 11)] }, 'seat-b'), 'st', 'seat-a');
    s = h.respond(s, 'wx');
    expect(askedAbout(s)).toBe(id);
  });

  it('a Chains Recast does not draw', () => {
    const s = h.play(yueying('kingdomWars:huang-yueying', { 'seat-a:hand': [card('ch', 'chains', 'club', 10)] }), 'ch');
    expect(s.pendingChoice).toBeUndefined();
    expect(drawn(s)).toEqual([1]);
  });

  it('Genius resolves to Dynasty Wars wondrous-talent: a Tool beyond distance', () => {
    const ranged = (general: string) => h.legal(yueying(general, { 'seat-a:hand': [card('st', 'steal', 'spade', 3)], 'seat-c:hand': [card('x', 'shan')] }), 'seat-a').some((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 'st' && a.targets.some((t) => t.kind === 'seat' && t.seatId === 'seat-c'));
    expect(ranged('huang-yueying')).toBe(true);
    expect(ranged('kingdomWars:huang-yueying')).toBe(true);
  });
});

describe('Kingdom Wars Zhuge Liang, Empty City', () => {
  const id = 'kingdomWars:empty-city';
  const targets = (s: GameState, cardId: string) =>
    h.legal(s, s.turn.ownerSeatId).flatMap((a) => (a.kind === 'PlayCardAction' && a.cardInstanceId === cardId ? [a.targets[0]?.seatId] : []));
  // Seat-a holds two Slashes and a Duel; seat-c holds a Wuxie; seat-b is Zhuge Liang, with `held` in hand.
  const attack = (general: string, held: ReturnType<typeof card>[] = [], more: Record<string, ReturnType<typeof card>[]> = {}) =>
    table(
      { 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha'), card('du', 'duel', 'spade', 1)], 'seat-c:hand': [card('wx', 'wuxie', 'spade')], 'seat-b:hand': held, ...more },
      { generals: at('seat-b', general) }
    );
  const noEffect = (s: GameState, cardId: string) =>
    s.log.filter((e) => e.kind === 'AbilityUsedEvent' && e.abilityId === id && e.outcome === 'no-effect' && e.targetSeatId === 'seat-a' && e.cardId === cardId);

  it('with no hand cards he can be chosen for a Slash, which is cancelled yet counts toward the Slash limit', () => {
    expect(targets(attack('zhuge-liang'), 's1')).not.toContain('seat-b'); // Dynasty Wars: not even offered
    const t = attack('kingdomWars:zhuge-liang');
    expect(targets(t, 's1')).toContain('seat-b');
    const s = h.play(t, 's1', 'seat-b');
    expect(s.pendingResponse).toBeNull(); // no Shan asked for
    expect(hp(s, 'seat-b')).toBe(4);
    expect(noEffect(s, 'sha')).toHaveLength(1);
    expect(s.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toContain('s1');
    expect(targets(s, 's2')).toEqual([]); // the Slash was used
  });

  it('a Duel at him is wasted: no Wuxie is asked for and no one is damaged', () => {
    expect(targets(attack('zhuge-liang'), 'du')).not.toContain('seat-b');
    const s = h.play(attack('kingdomWars:zhuge-liang'), 'du', 'seat-b');
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
    expect(hp(s, 'seat-a')).toBe(4);
    expect(noEffect(s, 'duel')).toHaveLength(1);
  });

  it('with a hand card he is hit normally, as Dynasty Wars', () => {
    for (const general of ['kingdomWars:zhuge-liang', 'zhuge-liang']) {
      const sha = h.play(attack(general, [card('x', 'peach', 'heart')]), 's1', 'seat-b');
      expect(sha.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
      expect(hp(h.pass(sha), 'seat-b')).toBe(3);
      const duel = h.play(attack(general, [card('x', 'peach', 'heart')]), 'du', 'seat-b');
      expect(duel.pendingResponse?.reason).toMatchObject({ kind: 'wuxie' });
    }
  });

  it('a cancelled Slash is no hit for its user’s Slash-on-target skills (Iron Cavalry)', () => {
    const cavalry = (held: ReturnType<typeof card>[]) =>
      table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': held }, { generals: { ...at('seat-a', 'ma-chao'), ...at('seat-b', 'kingdomWars:zhuge-liang') } });
    const empty = h.play(cavalry([]), 's1', 'seat-b');
    expect(askedAbout(empty)).toBeNull();
    expect(empty.pendingResponse).toBeNull();
    expect(hp(empty, 'seat-b')).toBe(4);
    expect(askedAbout(h.play(cavalry([card('x', 'peach', 'heart')]), 's1', 'seat-b'))).toBe('iron-cavalry');
  });

  it('a Slash moved onto him (Displace) is cancelled too', () => {
    const displaced = (general: string) =>
      table(
        { 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('k', 'shan', 'heart')] },
        { generals: { ...at('seat-b', 'da-qiao'), ...at('seat-c', general) } }
      );
    // Dynasty Wars: no seat to move it to, so Da Qiao isn't asked.
    expect(askedAbout(h.play(displaced('zhuge-liang'), 's1', 'seat-b'))).toBeNull();
    let s = h.play(displaced('kingdomWars:zhuge-liang'), 's1', 'seat-b');
    expect(askedAbout(s)).toBe('displace');
    s = h.choose(h.select(h.use(s), 'k'), 'seat-c');
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-c')).toBe(4);
    expect(s.log.some((e) => e.kind === 'AbilityUsedEvent' && e.abilityId === id && e.outcome === 'no-effect')).toBe(true);
  });

  it('hidden, he is asked whether to reveal him to cancel the Slash', () => {
    const s = h.play(table({ 'seat-a:hand': [card('s1', 'sha')] }, { generals: { 'seat-b': ['kingdomWars:zhuge-liang', 'filler-meng-huo', false] } }), 's1', 'seat-b');
    expect(askedAbout(s)).toBe(id);
    const used = h.use(s);
    expect(used.seats[1].generals!.main.revealed).toBe(true);
    expect(used.pendingResponse).toBeNull();
    expect(h.decline(s).pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
  });
});

describe('Kingdom Wars Gan Fu Ren', () => {
  const gan = (o: { hp?: number; hand?: ReturnType<typeof card>[]; kingdoms?: TableOptions['kingdoms']; hidden?: string[]; phase?: 'Play' | 'End'; owner?: string } = {}) => {
    const t = table(
      { drawPile: ['d1', 'd2', 'd3', 'd4'].map((id) => card(id, 'shan')), 'seat-a:hand': o.hand ?? [] },
      { generals: at('seat-a', 'kingdomWars:gan-fu-ren'), hp: { 'seat-a': o.hp ?? 1 }, kingdoms: o.kingdoms ?? { 'seat-a': 'Shu', 'seat-b': 'Shu', 'seat-c': 'Shu', 'seat-d': 'Wei' }, phase: o.phase, owner: o.owner }
    );
    const hide = new Set(o.hidden ?? []);
    return { ...t, seats: t.seats.map((x) => (hide.has(x.id) ? { ...x, generals: { main: { ...x.generals!.main, revealed: false }, deputy: { ...x.generals!.deputy, revealed: false } } } : x)) };
  };
  const healOf = (s: GameState, amount: number) => h.run(s, [{ kind: 'HealEffect' as const, target: { kind: 'seat' as const, seatId: 'seat-a' }, amount }]);

  describe('Prudence', () => {
    const id = 'kingdomWars:prudence';
    it('is asked once per point regained, each time picking a seat of her Kingdom other than her', () => {
      let s = healOf(gan(), 2);
      expect(askedAbout(s)).toBe(id);
      s = h.use(s);
      expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c']);
      s = h.choose(s, 'seat-b');
      expect(handIds(s, 'seat-b')).toHaveLength(1);
      expect(askedAbout(s)).toBe(id);
      s = h.choose(h.use(s), 'seat-c');
      expect(handIds(s, 'seat-c')).toHaveLength(1);
      expect(s.pendingChoice).toBeFalsy();
    });

    it('an Ambitionist has no one to pick, so is not asked', () => {
      const t = gan();
      const s = healOf({ ...t, seats: t.seats.map((x) => (x.id === 'seat-a' ? { ...x, allegiance: 'ambitionist' as const } : x)) }, 1);
      expect(s.pendingChoice).toBeFalsy();
    });

    it('declining draws nothing', () => {
      const s = h.decline(healOf(gan(), 1));
      expect(handIds(s, 'seat-b')).toEqual([]);
      expect(s.pendingChoice).toBeFalsy();
    });

    it('never offers a seat with both Generals hidden', () => {
      const s = h.use(healOf(gan({ hidden: ['seat-b'] }), 1));
      expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-c']);
    });

    it('hidden, she is still asked; Use reveals her and the pick draws', () => {
      // Never revealed, so the seat's own Kingdom is still 'hidden': hers is her General's (Shu).
      const t = gan({ hidden: ['seat-a'] });
      let s = healOf({ ...t, seats: t.seats.map((x) => (x.id === 'seat-a' ? { ...x, kingdom: 'hidden' as const } : x)) }, 1);
      expect(askedAbout(s)).toBe(id);
      s = h.use(s);
      expect(s.seats[0].generals!.main.revealed).toBe(true);
      expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c']);
      s = h.choose(s, 'seat-b');
      expect(handIds(s, 'seat-b')).toHaveLength(1);
    });

    it('hidden with no exposed seat of her Kingdom, she is not asked', () => {
      expect(askedAbout(healOf(gan({ hidden: ['seat-a', 'seat-b', 'seat-c'] }), 1))).toBeNull();
    });

    it('asks nothing with no one to pick', () => {
      expect(askedAbout(healOf(gan({ kingdoms: { 'seat-a': 'Shu', 'seat-b': 'Wei', 'seat-c': 'Wu', 'seat-d': 'Qun' } }), 1))).toBeNull();
      expect(askedAbout(healOf(gan({ hidden: ['seat-b', 'seat-c'] }), 1))).toBeNull();
    });
  });

  describe('Divine Wisdom', () => {
    const id = 'kingdomWars:divine-wisdom';
    const startOfTurn = (hand: ReturnType<typeof card>[], hp: number) => h.settle(gan({ hand, hp, phase: 'End', owner: 'seat-d' }));
    const cards = (n: number) => Array.from({ length: n }, (_, i) => card(`k${i}`, 'shan', 'spade'));

    it('3 cards at HP 3: discards all and heals 1', () => {
      let s = startOfTurn(cards(3), 3);
      expect(askedAbout(s)).toBe(id);
      s = h.use(s);
      expect(handIds(s, 'seat-a')).toEqual([]);
      expect(hp(s, 'seat-a')).toBe(4);
    });

    it('2 cards at HP 3: discards both and does not heal', () => {
      const s = h.use(startOfTurn(cards(2), 3));
      expect(handIds(s, 'seat-a')).toEqual([]);
      expect(hp(s, 'seat-a')).toBe(3);
    });

    it('declining keeps the hand', () => {
      const s = h.decline(startOfTurn(cards(3), 3));
      expect(handIds(s, 'seat-a')).toHaveLength(3);
    });

    it('an empty hand is not asked', () => {
      expect(askedAbout(startOfTurn([], 3))).not.toBe(id);
    });
  });
});

describe('Kingdom Wars Pang Tong, Resurrection', () => {
  const id = 'kingdomWars:resurrection';
  const pile = Array.from({ length: 8 }, (_, i) => card(`d${i}`, 'shan', 'heart', i + 1));
  const hit = (seatId: string, amount: number) => ({
    kind: 'DamageEffect' as const,
    damage: { source: null, target: { kind: 'seat' as const, seatId }, amount, nature: 'normal' as const, cause: {} },
  });
  // Seat-a, face down and Chained, at 1 HP with a hand card, equipment and a judgment card.
  const pangTong = (general: string, o: TableOptions = {}) => {
    const t = table(
      { 'seat-a:hand': [card('x', 'sha')], 'seat-a:equip': [card('e', 'black-pommel', 'spade', 6)], 'seat-a:judgment': [card('j', 'capture', 'spade', 6)], drawPile: pile },
      { generals: at('seat-a', general), hp: { 'seat-a': 1 }, ...o }
    );
    return { ...t, seats: t.seats.map((x) => (x.id === 'seat-a' ? { ...x, faceDown: true as const, chained: true as const } : x)) };
  };

  it('on entering dying: discard every card, draw 3, recover to 3 HP, turn face up and unchained; no dying round', () => {
    let s = kw.run(pangTong('kingdomWars:pang-tong'), [hit('seat-a', 2)]);
    expect(askedAbout(s)).toBe(id);
    s = kw.use(s);
    expect(ids(s, 'discardPile').sort()).toEqual(['e', 'j', 'x']);
    expect(handIds(s, 'seat-a')).toEqual(['d0', 'd1', 'd2']);
    expect(hp(s, 'seat-a')).toBe(3);
    expect(s.seats[0].faceDown).toBeUndefined();
    expect(s.seats[0].chained).toBeFalsy();
    expect(s.pendingResponse).toBeNull();
    expect(abilityLog(s)).toContainEqual(expect.objectContaining({ abilityId: id, outcome: 'reborn' }));
  });

  it('recovers at most to his max HP', () => {
    expect(hp(kw.use(kw.run(pangTong('kingdomWars:pang-tong', { maxHp: { 'seat-a': 2 } }), [hit('seat-a', 2)])), 'seat-a')).toBe(2);
  });

  it('once per game: the second time the dying round goes ahead', () => {
    let s = kw.use(kw.run(pangTong('kingdomWars:pang-tong'), [hit('seat-a', 2)]));
    s = kw.run(s, [hit('seat-a', 3)]);
    expect(askedAbout(s)).toBeNull();
    expect(s.pendingResponse?.reason).toEqual({ kind: 'dying', seatId: 'seat-a' });
  });

  it('Dynasty Wars Pang Tong in the same state stays Chained', () => {
    const s = kw.use(kw.run(pangTong('pang-tong'), [hit('seat-a', 2)]));
    expect(s.seats[0].faceDown).toBeUndefined();
    expect(s.seats[0].chained).toBe(true);
  });

  it('is what Kingdom Wars Pang Tong plays for 涅槃, beside Dynasty Wars Shackle', () => {
    expect(readyKingdomWarsSkills(kingdomWarsGeneralRecords().find((g) => g.id === 'pang-tong')!).map((x) => x.id)).toEqual(['shackle', id]);
  });
});
