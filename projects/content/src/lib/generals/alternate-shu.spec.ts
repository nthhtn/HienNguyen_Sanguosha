import type { GameState } from 'engine';
import { askedAbout, card, handIds, harness, hp, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, general: string): TableOptions['generals'] => ({ [seatId]: [general, 'filler-meng-huo', true] });
const hand = ['k1', 'k2', 'k3', 'k4', 'k5', 'k6'].map((id) => card(id, 'shan', 'spade'));
const liuBei = (general: string, combinedHp = 2) => table({ 'seat-a:hand': hand }, { generals: at('seat-a', general), hp: { 'seat-a': combinedHp } });
const give = (s: GameState, skillId: string, to: string, ...cards: string[]) => h.choose(h.select(h.useSkill(s, 'seat-a', skillId), ...cards), to);

describe('Alternate Liu Bei, Benevolence', () => {
  const alt = (s: GameState, to: string, ...cards: string[]) => give(s, 'alternate:benevolence', to, ...cards);

  it('giving 2 cards in the turn does not heal', () => {
    let s = alt(liuBei('alternate:liu-bei'), 'seat-b', 'k1');
    s = alt(s, 'seat-c', 'k2');
    expect(hp(s, 'seat-a')).toBe(2);
    expect(handIds(s, 'seat-b')).toEqual(['k1']);
  });

  it('giving the 3rd card heals 1', () => {
    let s = alt(liuBei('alternate:liu-bei'), 'seat-b', 'k1', 'k2');
    s = alt(s, 'seat-c', 'k3');
    expect(hp(s, 'seat-a')).toBe(3);
  });

  it('giving 5 cards in total heals once only', () => {
    let s = alt(liuBei('alternate:liu-bei'), 'seat-b', 'k1', 'k2', 'k3');
    expect(hp(s, 'seat-a')).toBe(3);
    s = alt(s, 'seat-c', 'k4', 'k5');
    expect(hp(s, 'seat-a')).toBe(3);
  });

  it('tracks its own counts under its own id, apart from Default Kindness', () => {
    const s = alt(liuBei('alternate:liu-bei'), 'seat-b', 'k1', 'k2');
    const keys = Object.keys(s.turn.abilityUses ?? {});
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(key).toContain('alternate:benevolence');
      expect(key).not.toContain('kindness');
    }
  });

  it('is not an Alternate rule for a Default Liu Bei, who still heals at 2', () => {
    const s = give(liuBei('liu-bei'), 'kindness', 'seat-b', 'k1', 'k2');
    expect(hp(s, 'seat-a')).toBe(3);
  });
});

describe('Alternate Zhu Rong, Fearsome Blade', () => {
  const rong = (general: string, sha = 'sha', chained: string[] = []) => {
    const t = table(
      { 'seat-a:hand': [card('s1', sha), card('c9', 'sha', 'heart', 9)], 'seat-b:hand': [card('b5', 'sha', 'heart', 5)], 'seat-c:hand': [card('d5', 'sha', 'heart', 5)] },
      { generals: at('seat-a', general) },
    );
    return { ...t, seats: t.seats.map((x) => (chained.includes(x.id) ? { ...x, chained: true as const } : x)) };
  };
  const hitB = (general: string, sha?: string, chained?: string[]) => h.pass(h.play(rong(general, sha, chained), 's1', 'seat-b'));
  it('her Slash damaging its target offers the compete', () => {
    expect(askedAbout(hitB('alternate:zhu-rong'))).toBe('alternate:fearsome-blade');
  });

  // Default behaves the same here: chained damage is never Slash damage. This does not show the variant's difference.
  it('chained damage reaching another seat is not offered the compete', () => {
    const first = hitB('alternate:zhu-rong', 'fire-attack', ['seat-b', 'seat-c']);
    expect(askedAbout(first)).toBe('alternate:fearsome-blade'); // for seat-b, the seat aimed at
    expect(first.pendingChoice).toMatchObject({ seatId: 'seat-a' });
    const s = h.decline(first);
    expect(hp(s, 'seat-c')).toBeLessThan(4);
    expect(s.log.filter((e) => e.kind === 'DamageDealtEvent')).toHaveLength(2);
    expect(askedAbout(s)).toBeNull();
  });

  it('records the seat the Slash was aimed at on the damage it deals', () => {
    const s = hitB('alternate:zhu-rong');
    expect(s.log.find((e) => e.kind === 'DamageDealtEvent')).toMatchObject({ damage: { cause: { aimedAt: 'seat-b' } } });
  });

  // Non-chained Slash damage on seat-c, from a Slash aimed elsewhere (a redirect): where the variant differs from Default.
  const strikeC = (general: string, aimedAt?: string) => {
    const sha = card('s1', 'sha');
    const used = { as: 'sha', colour: 'black' as const, physical: [{ definitionId: 'sha', instanceId: 's1', suit: 'spade' as const, rank: 7 }] };
    return h.run(rong(general), [
      { kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-c' }, amount: 1, nature: 'normal', cause: { card: used, cardInstanceId: sha.instanceId, ...(aimedAt ? { aimedAt } : {}) } } },
    ]);
  };

  it('is not offered for damage on a seat the Slash was not aimed at; Default is', () => {
    expect(askedAbout(strikeC('alternate:zhu-rong', 'seat-b'))).toBeNull();
    expect(askedAbout(strikeC('zhu-rong', 'seat-b'))).toBe('intense-edge');
  });

  it('is not offered when the cause records no aimed seat; Default is', () => {
    expect(askedAbout(strikeC('alternate:zhu-rong'))).toBeNull();
    expect(askedAbout(strikeC('zhu-rong'))).toBe('intense-edge');
  });

  it('is offered for damage on the seat the Slash was aimed at', () => {
    expect(askedAbout(strikeC('alternate:zhu-rong', 'seat-c'))).toBe('alternate:fearsome-blade');
  });

  it('Default Zhu Rong keeps her own id and still competes', () => {
    expect(askedAbout(hitB('zhu-rong'))).toBe('intense-edge');
  });
});

describe('Alternate Huang Yueying, Assembling Wisdom', () => {
  const id = 'alternate:assembling-wisdom';
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
    const s = h.play(yueying('alternate:huang-yueying', { 'seat-a:hand': [card('dt', 'draw-two', 'heart', 7)] }), 'dt');
    expect(askedAbout(s)).toBe(id);
    expect(drawn(h.use(s))).toEqual([1, 2]);
  });

  it('Chains converted from a club by Shackle does not draw; Default Huang Yueying is asked', () => {
    const alt = chains('alternate:huang-yueying');
    expect(alt.pendingChoice).toBeUndefined();
    expect(drawn(alt)).toEqual([]);
    expect(askedAbout(chains('huang-yueying'))).toBe('gathering-wisdom');
  });

  it('a real Wuxie she plays still draws', () => {
    let s = h.play(yueying('alternate:huang-yueying', { 'seat-b:hand': [card('st', 'steal', 'spade', 3)], 'seat-a:hand': [card('wx', 'wuxie', 'spade', 11)] }, 'seat-b'), 'st', 'seat-a');
    s = h.respond(s, 'wx');
    expect(askedAbout(s)).toBe(id);
  });

  it('a Chains Recast does not draw', () => {
    const s = h.play(yueying('alternate:huang-yueying', { 'seat-a:hand': [card('ch', 'chains', 'club', 10)] }), 'ch');
    expect(s.pendingChoice).toBeUndefined();
    expect(drawn(s)).toEqual([1]);
  });

  it('Genius resolves to Default wondrous-talent: a Tool beyond distance', () => {
    const ranged = (general: string) => h.legal(yueying(general, { 'seat-a:hand': [card('st', 'steal', 'spade', 3)], 'seat-c:hand': [card('x', 'shan')] }), 'seat-a').some((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 'st' && a.targets.some((t) => t.kind === 'seat' && t.seatId === 'seat-c'));
    expect(ranged('huang-yueying')).toBe(true);
    expect(ranged('alternate:huang-yueying')).toBe(true);
  });
});
