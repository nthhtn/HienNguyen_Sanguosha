import type { GameState } from 'engine';
import { getActiveSeatId, redactStateForSeat, skillsInPlay } from 'engine';
import { askedAbout, card, handIds, harness, hp, kwMode, registry, table, TableOptions } from './skills.testing';
import { readyAlternateSkills } from '../alternateSkills';
import { alternateGeneralRecords } from '../alternateGenerals';

const h = harness();
const at = (seatId: string, general: string): TableOptions['generals'] => ({ [seatId]: [general, 'filler-jia-xu', true] });
const offered = (s: GameState, seatId: string, skillId: string) =>
  h.legal(s, seatId).some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === skillId);

describe('Alternate Diao Chan, Seed of Animosity', () => {
  const id = 'alternate:seed-of-animosity';
  // Seat-a discards k; seat-c Duels seat-b. Wuxie and Wuxie Kingdom sit in the other seats' hands.
  const sow = (general: string) =>
    table(
      { 'seat-a:hand': [card('k', 'shan')], 'seat-c:hand': [card('wx', 'wuxie', 'spade')], 'seat-d:hand': [card('wg', 'wuxie-guo', 'spade')] },
      { generals: at('seat-a', general) }
    );
  const duelled = (general: string, skillId: string) => h.choose(h.choose(h.select(h.useSkill(sow(general), 'seat-a', skillId), 'k'), 'seat-b'), 'seat-c');

  it('the Duel it makes is never offered a Wuxie or Wuxie Kingdom answer and resolves', () => {
    const s = duelled('alternate:diao-chan', id);
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ card: { as: 'duel', noWuxie: true } });
    expect(s.pendingResponse?.reason?.kind).not.toBe('wuxie');
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    expect(hp(h.pass(s), 'seat-b')).toBe(3);
  });

  it('Default Diao Chan offers Wuxie on the same Duel', () => {
    const s = duelled('diao-chan', 'sow-discord');
    expect(s.pendingResponse?.reason).toMatchObject({ kind: 'wuxie' });
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ card: { as: 'duel' } });
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).not.toMatchObject({ card: { noWuxie: true } });
  });

  it('a Duel played normally still offers Wuxie', () => {
    const s = h.play(table({ 'seat-a:hand': [card('du', 'duel')], 'seat-c:hand': [card('wx', 'wuxie', 'spade')] }, { generals: at('seat-a', 'alternate:diao-chan') }), 'du', 'seat-b');
    expect(s.pendingResponse?.reason).toMatchObject({ kind: 'wuxie' });
  });

  it('still needs two other male seats, discards a card, and is once per turn', () => {
    const girls = { 'seat-c': ['filler-zhu-rong', 'filler-sun-jian'], 'seat-d': ['filler-cai-wenji', 'filler-sun-jian'] } as NonNullable<TableOptions['generals']>;
    expect(offered(table({ 'seat-a:hand': [card('k', 'shan')] }, { generals: { ...at('seat-a', 'alternate:diao-chan'), ...girls } }), 'seat-a', id)).toBe(false);
    const s = h.select(h.useSkill(sow('alternate:diao-chan'), 'seat-a', id), 'k');
    expect(handIds(s, 'seat-a')).toEqual([]);
    const done = h.pass(h.choose(h.choose(s, 'seat-b'), 'seat-c'));
    expect(offered(done, 'seat-a', id)).toBe(false);
  });
});

describe('Alternate Diao Chan, Envious Moon', () => {
  const id = 'alternate:envious-moon';
  const end = (general: string) => h.act(table({ drawPile: [card('d1', 'shan')] }, { generals: at('seat-a', general) }), { kind: 'EndPhaseAction', seatId: 'seat-a' });

  it('asks whether to draw 1; accepting draws 1', () => {
    const s = end('alternate:diao-chan');
    expect(askedAbout(s)).toBe(id);
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(handIds(h.use(s), 'seat-a')).toEqual(['d1']);
  });

  it('declining draws nothing', () => {
    expect(handIds(h.decline(end('alternate:diao-chan')), 'seat-a')).toEqual([]);
  });

  it('Default Diao Chan draws 1 without asking', () => {
    const s = end('diao-chan');
    expect(askedAbout(s)).toBeNull();
    expect(handIds(s, 'seat-a')).toEqual(['d1']);
  });
});

describe('Alternate Jia Xu, Behind the Curtain', () => {
  const id = 'alternate:behind-the-curtain';
  const zone = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
  const aimed = (s: GameState) =>
    h.legal(s, 'seat-b').flatMap((a) => (a.kind === 'PlayCardAction' && a.targets[0]?.seatId === 'seat-a' ? [a.cardInstanceId] : []));
  // Seat-b's turn: a black and a red Duel and a black Capture; seat-c holds a Wuxie; seat-a is Jia Xu.
  const tools = (general: string) =>
    table(
      {
        'seat-b:hand': [card('bl', 'duel', 'spade', 5), card('rd', 'duel', 'heart', 5), card('bc', 'capture', 'club', 6)],
        'seat-c:hand': [card('wx', 'wuxie', 'spade')],
      },
      { owner: 'seat-b', generals: at('seat-a', general) }
    );
  const noEffect = (s: GameState, cardId: string) =>
    s.log.filter((e) => e.kind === 'AbilityUsedEvent' && e.abilityId === id && e.outcome === 'no-effect' && e.targetSeatId === 'seat-b' && e.cardId === cardId);

  it('can be chosen by black Tools (Default: only by red ones)', () => {
    expect(aimed(tools('jia-xu'))).toEqual(['rd']);
    expect(aimed(tools('alternate:jia-xu'))).toEqual(['bl', 'rd', 'bc']);
  });

  it('a black Duel at him is cancelled: no Wuxie asked for, no one damaged', () => {
    const s = h.play(tools('alternate:jia-xu'), 'bl', 'seat-a');
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-a')).toBe(4);
    expect(hp(s, 'seat-b')).toBe(4);
    expect(noEffect(s, 'duel')).toHaveLength(1);
  });

  it('a black Capture at him is cancelled: not placed, discarded', () => {
    const s = h.play(tools('alternate:jia-xu'), 'bc', 'seat-a');
    expect(zone(s, 'seat-a:judgment')).toEqual([]);
    expect(zone(s, 'discardPile')).toContain('bc');
    expect(noEffect(s, 'capture')).toHaveLength(1);
  });

  it('a red Duel at him goes ahead', () => {
    expect(h.play(tools('alternate:jia-xu'), 'rd', 'seat-a').pendingResponse?.reason).toMatchObject({ kind: 'wuxie' });
  });
});

describe('Alternate Cai Wenji, Sorrow', () => {
  const hk = harness(kwMode);
  const shaDamage = (source: string | null) => ({
    kind: 'DamageEffect' as const,
    damage: {
      source: source ? { kind: 'seat' as const, seatId: source } : null, target: { kind: 'seat' as const, seatId: 'seat-a' }, amount: 1, nature: 'normal' as const,
      cause: { card: { as: 'sha', colour: 'black' as const, physical: [card('sx', 'sha')] } },
    },
  });
  // seat-a is Cai Wenji at 1 HP; `source`'s Slash kills her. The killer seat-c is Zhang He (Main) and Liu Shan (Deputy).
  const killed = (cai: string, o: { source?: string | null; revealed?: boolean; patch?: (s: GameState) => GameState } = {}) => {
    const base = table({}, {
      generals: { 'seat-a': [cai, 'filler-xu-huang', true], 'seat-c': ['zhang-he', 'liu-shan', o.revealed ?? true] },
      hp: { 'seat-a': 1 }, kingdoms: { 'seat-a': 'Qun' },
    });
    let s = hk.run((o.patch ?? ((x) => x))(base), [shaDamage(o.source === undefined ? 'seat-c' : o.source)]);
    for (let i = 0; i < 6 && s.pendingResponse; i++) s = hk.pass(s);
    return s;
  };
  const slots = (s: GameState, seatId = 'seat-c') => skillsInPlay(s, seatId, registry, true).map((x) => `${x.owner.slot}:${x.skill.id}`);
  const seat = (s: GameState, id: string) => s.seats.find((x) => x.id === id)!;
  const before = slots(table({}, { generals: { 'seat-c': ['zhang-he', 'liu-shan', true] } }));

  it('her player, though out, chooses Main or Deputy of the killer, secretly; the killer is asked nothing', () => {
    const s = killed('alternate:cai-wenji');
    expect(seat(s, 'seat-a').eliminated).toBe(true);
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', secret: true, reason: { kind: 'ability', abilityId: 'alternate:sorrow', targetSeatId: 'seat-c' } });
    expect(s.pendingChoice!.options.map((o) => [o.id, o.shows])).toEqual([
      ['main', { kind: 'label', text: 'Main General' }],
      ['deputy', { kind: 'label', text: 'Deputy General' }],
    ]);
    expect(getActiveSeatId(s)).toBe('seat-a');
    expect(hk.legal(s, 'seat-a').map((a) => a.kind)).toEqual(['ChooseOptionAction', 'ChooseOptionAction']);
    expect(hk.legal(s, 'seat-c')).toEqual([]);
    expect(seat(s, 'seat-c').silencedSlots).toBeUndefined();
  });

  it('picking Main removes the killer’s Main skills for good; the Deputy’s still work', () => {
    expect(before.some((x) => x.startsWith('main:'))).toBe(true);
    expect(before.some((x) => x.startsWith('deputy:'))).toBe(true);
    const s = hk.choose(killed('alternate:cai-wenji'), 'main');
    expect(seat(s, 'seat-c').silencedSlots).toEqual(['main']);
    expect(seat(s, 'seat-c').silenced).toBeUndefined();
    expect(slots(s)).toEqual(before.filter((x) => x.startsWith('deputy:')));
    expect(s.log).toContainEqual({ kind: 'SeatSilencedEvent', seatId: 'seat-c', slot: 'main' });
    expect(s.log).toContainEqual(expect.objectContaining({ kind: 'AbilityUsedEvent', outcome: 'silenced-main', targetSeatId: 'seat-c' }));
  });

  it('picking Deputy removes the Deputy’s skills; the Main’s still work', () => {
    const s = hk.choose(killed('alternate:cai-wenji'), 'deputy');
    expect(seat(s, 'seat-c').silencedSlots).toEqual(['deputy']);
    expect(slots(s)).toEqual(before.filter((x) => x.startsWith('main:')));
  });

  it('Default Cai Wenji, in the same scene, asks nothing and silences the whole seat', () => {
    const s = killed('cai-wenji');
    expect(s.pendingChoice).toBeUndefined();
    expect(seat(s, 'seat-c').silenced).toBe(true);
    expect(seat(s, 'seat-c').silencedSlots).toBeUndefined();
    expect(slots(s)).toEqual([]);
  });

  it('with both of the killer’s Generals hidden, the choice names neither and reveals nothing', () => {
    const asked = killed('alternate:cai-wenji', { revealed: false });
    expect(asked.pendingChoice!.options.map((o) => o.id)).toEqual(['main', 'deputy']);
    const names = /zhang-he|liu-shan/;
    expect(JSON.stringify(asked.pendingChoice)).not.toMatch(names);
    expect(JSON.stringify(redactStateForSeat(asked, 'seat-a').pendingChoice)).not.toMatch(names);
    for (const viewer of ['seat-b', 'seat-c']) expect(redactStateForSeat(asked, viewer).pendingChoice!.options).toEqual([]);
    const s = hk.choose(asked, 'deputy');
    expect(seat(s, 'seat-c').generals!.main.revealed).toBe(false);
    expect(seat(s, 'seat-c').generals!.deputy.revealed).toBe(false);
    expect(s.log.some((e) => e.kind === 'GeneralRevealedEvent' && e.seatId === 'seat-c')).toBe(false);
    expect(s.log.find((e) => e.kind === 'ChoiceMadeEvent' && e.seatId === 'seat-a')).toMatchObject({ secret: true });
    for (const viewer of ['seat-b', 'seat-d']) expect(JSON.stringify(redactStateForSeat(s, viewer))).not.toMatch(names);
    // The hidden Deputy's skills are no longer offered (nor would they reveal it); the Main's are.
    expect(slots(s).every((x) => x.startsWith('main:'))).toBe(true);
    expect(slots(s).length).toBeGreaterThan(0);
  });

  it('no killer, her own hand, or a killer already out: no choice and no silencing', () => {
    const quiet = (s: GameState) => {
      expect(s.pendingChoice).toBeUndefined();
      expect(s.seats.some((x) => x.silenced || x.silencedSlots)).toBe(false);
    };
    quiet(killed('alternate:cai-wenji', { source: null }));
    quiet(killed('alternate:cai-wenji', { source: 'seat-a' }));
    quiet(killed('alternate:cai-wenji', { patch: (b) => ({ ...b, seats: b.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) }) }));
  });

  it('a killer that already lost one General’s skills is offered only the other', () => {
    const s = killed('alternate:cai-wenji', { patch: (b) => ({ ...b, seats: b.seats.map((x) => (x.id === 'seat-c' ? { ...x, silencedSlots: ['main' as const] } : x)) }) });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['deputy']);
  });

  it('Dirge is Default’s Lament', () => {
    expect(readyAlternateSkills(alternateGeneralRecords().find((g) => g.id === 'cai-wenji')!).map((x) => x.id)).toEqual(['lament', 'alternate:sorrow']);
  });
});

describe('Alternate Pan Feng, Insanity Axe', () => {
  const id = 'alternate:insanity-axe';
  const zone = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
  // seat-a (Pan Feng) plays Sha s1 at seat-b, who has no Dodge; seat-b wears `worn`, seat-a `own`.
  const strike = (worn: ReturnType<typeof card>[], own: ReturnType<typeof card>[] = [], general = 'alternate:pan-feng') =>
    h.pass(h.play(table({ 'seat-a:hand': [card('s1', 'sha', 'heart', 7)], 'seat-a:equip': own, 'seat-b:equip': worn }, { generals: at('seat-a', general) }), 's1', 'seat-b'));
  const crossbow = card('cb', 'crossbow', 'club', 1);
  const armor = card('bs', 'black-shield', 'spade', 2);
  const labelOf = (s: GameState, optionId: string) => s.pendingChoice!.options.find((o) => o.id === optionId)?.shows;

  it('is asked after her Sha damages a seat wearing a card, and declining changes nothing', () => {
    const s = strike([crossbow]);
    expect(askedAbout(s)).toBe(id);
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a' });
    const done = h.decline(s);
    expect(zone(done, 'seat-b:equip')).toEqual(['cb']);
    expect(zone(done, 'seat-a:equip')).toEqual([]);
  });

  it('moves the picked card into her empty slot', () => {
    let s = h.choose(h.use(strike([crossbow, armor])), 'cb');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['move-card', 'discard-card']);
    expect(labelOf(s, 'move-card')).toMatchObject({ kind: 'label' });
    s = h.choose(s, 'move-card');
    expect(zone(s, 'seat-a:equip')).toEqual(['cb']);
    expect(zone(s, 'seat-b:equip')).toEqual(['bs']);
    expect(s.pendingChoice ?? null).toBeNull();
  });

  it('can instead discard the picked card', () => {
    const s = h.choose(h.choose(h.use(strike([crossbow, armor])), 'bs'), 'discard-card');
    expect(zone(s, 'seat-b:equip')).toEqual(['cb']);
    expect(zone(s, 'seat-a:equip')).toEqual([]);
    expect(zone(s, 'discardPile')).toContain('bs');
  });

  it('with her slot full, a move replaces it: her old card goes to the discard pile', () => {
    const old = card('ss', 'serpent-spear', 'spade', 12);
    const s = h.choose(h.choose(h.use(strike([crossbow], [old])), 'cb'), 'move-card');
    expect(zone(s, 'seat-a:equip')).toEqual(['cb']);
    expect(zone(s, 'discardPile')).toContain('ss');
    expect(zone(s, 'seat-b:equip')).toEqual([]);
  });

  it('only replaces a card in the matching slot', () => {
    const old = card('ss', 'serpent-spear', 'spade', 12);
    const s = h.choose(h.choose(h.use(strike([armor], [old])), 'bs'), 'move-card');
    expect(zone(s, 'seat-a:equip').sort()).toEqual(['bs', 'ss']);
    expect(zone(s, 'discardPile')).not.toContain('ss');
  });

  it('is not asked when the victim wears nothing', () => {
    expect(askedAbout(strike([]))).toBeNull();
  });

  it('is not asked for damage that is not from a Sha (a Duel)', () => {
    const t = table({ 'seat-a:hand': [card('du', 'duel')], 'seat-b:equip': [crossbow] }, { generals: at('seat-a', 'alternate:pan-feng') });
    const s = h.pass(h.play(t, 'du', 'seat-b'));
    expect(hp(s, 'seat-b')).toBe(3);
    expect(askedAbout(s)).toBeNull();
  });

  it('is not asked for damage from a skill', () => {
    const t = table({ 'seat-b:equip': [crossbow] }, { generals: at('seat-a', 'alternate:pan-feng') });
    const s = h.run(t, [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-b' }, amount: 1, nature: 'normal', cause: { skillId: 'x' } } }]);
    expect(askedAbout(s)).toBeNull();
  });

  it('is not asked when another seat’s Sha does the damage', () => {
    const t = table({ 'seat-c:hand': [card('s1', 'sha', 'heart', 7)], 'seat-b:equip': [crossbow] }, { generals: at('seat-a', 'alternate:pan-feng'), owner: 'seat-c' });
    expect(askedAbout(h.pass(h.play(t, 's1', 'seat-b')))).toBeNull();
  });

  // The damage a Sha passes along a chain is its own damage event, marked chained: never Sha damage.
  it('is not asked for damage a Sha’s hit passes along a chain', () => {
    const t = table({ 'seat-c:equip': [crossbow] }, { generals: at('seat-a', 'alternate:pan-feng') });
    const used = { as: 'sha', colour: 'black' as const, physical: [{ definitionId: 'sha', instanceId: 's1', suit: 'spade' as const, rank: 7 }] };
    const s = h.run(t, [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-c' }, amount: 1, nature: 'normal', chained: true, cause: { card: used, cardInstanceId: 's1', aimedAt: 'seat-b' } } }]);
    expect(askedAbout(s)).toBeNull();
  });

  it('is not asked when the Sha leaves the victim dying', () => {
    const t = table({ 'seat-a:hand': [card('s1', 'sha', 'heart', 7)], 'seat-b:equip': [crossbow] }, { generals: at('seat-a', 'alternate:pan-feng'), hp: { 'seat-b': 1 } });
    expect(askedAbout(h.pass(h.play(t, 's1', 'seat-b')))).toBeNull();
  });

  it('a Default General has no such skill', () => {
    expect(askedAbout(strike([crossbow], [], 'filler-xu-huang'))).toBeNull();
  });
});
