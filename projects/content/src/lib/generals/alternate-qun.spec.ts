import type { GameState, QueueItem } from 'engine';
import { getActiveSeatId, redactStateForSeat, skillsInPlay } from 'engine';
import { seatDistance } from '../shared/queries';
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
  const strike = (worn: ReturnType<typeof card>[], own: ReturnType<typeof card>[] = [], general = 'alternate:pan-feng', revealed = true) =>
    h.pass(h.play(table({ 'seat-a:hand': [card('s1', 'sha', 'heart', 7)], 'seat-a:equip': own, 'seat-b:equip': worn }, { generals: { 'seat-a': [general, 'filler-jia-xu', revealed] } }), 's1', 'seat-b'));
  const crossbow = card('cb', 'crossbow', 'club', 1);
  const armor = card('bs', 'black-shield', 'spade', 2);
  const seatOf = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!;
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

  // Real chains: a Fire Attack hits its target directly (Sha damage), then passes along the chain (chained, never Sha damage).
  it('a Fire Attack damaging its target directly asks; the damage it passes along the chain does not', () => {
    const t = table({ 'seat-a:hand': [card('s1', 'fire-attack', 'heart', 7)], 'seat-b:equip': [crossbow], 'seat-c:equip': [armor] }, { generals: at('seat-a', 'alternate:pan-feng') });
    const chained = { ...t, seats: t.seats.map((x) => (x.id === 'seat-b' || x.id === 'seat-c' ? { ...x, chained: true as const } : x)) };
    const first = h.pass(h.play(chained, 's1', 'seat-b'));
    expect(askedAbout(first)).toBe(id);
    expect(first.pendingChoice).toMatchObject({ reason: { targetSeatId: 'seat-b' } });
    const s = h.decline(first);
    expect(s.log.filter((e) => e.kind === 'DamageDealtEvent')).toHaveLength(2);
    expect(hp(s, 'seat-c')).toBeLessThan(4);
    expect(askedAbout(s)).toBeNull();
  });

  it('a plain Fire Attack on a seat asks', () => {
    const t = table({ 'seat-a:hand': [card('s1', 'fire-attack', 'heart', 7)], 'seat-b:equip': [crossbow] }, { generals: at('seat-a', 'alternate:pan-feng') });
    expect(askedAbout(h.pass(h.play(t, 's1', 'seat-b')))).toBe(id);
  });

  // A hand-built chained hit that still carries the Sha cause.
  it('is not asked for a chained hit carrying the Sha’s cause', () => {
    const t = table({ 'seat-c:equip': [crossbow] }, { generals: at('seat-a', 'alternate:pan-feng') });
    const used = { as: 'sha', colour: 'black' as const, physical: [{ definitionId: 'sha', instanceId: 's1', suit: 'spade' as const, rank: 7 }] };
    const s = h.run(t, [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-c' }, amount: 1, nature: 'normal', chained: true, cause: { card: used, cardInstanceId: 's1', aimedAt: 'seat-b' } } }]);
    expect(askedAbout(s)).toBeNull();
  });

  // The ask is a step run after the damage settles, so a dying round (Kingdom War mode) comes first.
  const hk = harness(kwMode);
  const dying = (hand: ReturnType<typeof card>[] = []) =>
    hk.pass(hk.play(table({ 'seat-a:hand': [card('s1', 'sha', 'heart', 7)], 'seat-b:equip': [crossbow], 'seat-b:hand': hand }, { generals: at('seat-a', 'alternate:pan-feng'), hp: { 'seat-b': 1 } }), 's1', 'seat-b'));
  const finish = (s: GameState) => {
    for (let i = 0; i < 8 && s.pendingResponse; i++) s = hk.pass(s);
    return s;
  };

  it('a victim left at 0 HP goes through its dying round first; saved by a Peach, it is then asked and can lose its card', () => {
    const dyingNow = dying([card('pc', 'peach', 'heart', 3)]);
    expect(dyingNow.pendingResponse?.reason).toMatchObject({ kind: 'dying', seatId: 'seat-b' });
    expect(askedAbout(dyingNow)).toBeNull();
    const asked = hk.respond(dyingNow, 'pc');
    expect(hp(asked, 'seat-b')).toBe(1);
    expect(askedAbout(asked)).toBe(id);
    const s = hk.choose(hk.choose(hk.use(asked), 'cb'), 'move-card');
    expect(zone(s, 'seat-a:equip')).toEqual(['cb']);
    expect(zone(s, 'seat-b:equip')).toEqual([]);
  });

  it('a victim who then dies is not asked, and nothing breaks', () => {
    const s = finish(dying());
    expect(seatOf(s, 'seat-b').eliminated).toBe(true);
    expect(askedAbout(s)).toBeNull();
    expect(s.pendingChoice ?? null).toBeNull();
    expect(zone(s, 'seat-a:equip')).toEqual([]);
  });

  it('a Sha with two targets (Sky Scorcher) asks once for each damaged seat', () => {
    const t = table({ 'seat-a:hand': [card('s1', 'sha', 'heart', 7)], 'seat-a:equip': [card('sk', 'sky-scorcher', 'diamond', 12)], 'seat-b:equip': [crossbow], 'seat-c:equip': [armor] }, { generals: at('seat-a', 'alternate:pan-feng') });
    let s = h.pass(h.play(t, 's1', 'seat-b', 'seat-c'));
    expect(s.pendingChoice).toMatchObject({ reason: { targetSeatId: 'seat-b' } });
    s = h.pass(h.decline(s));
    expect(s.pendingChoice).toMatchObject({ reason: { targetSeatId: 'seat-c' } });
    expect(askedAbout(h.decline(s))).toBeNull();
  });

  it('a hidden Pan Feng is asked once: using it reveals her and goes straight to the pick', () => {
    const s = strike([crossbow], [], 'alternate:pan-feng', false);
    expect(askedAbout(s)).toBe(id);
    const used = h.use(s);
    expect(seatOf(used, 'seat-a').generals!.main.revealed).toBe(true);
    expect(used.pendingChoice).toMatchObject({ verb: 'pick', reason: { targetSeatId: 'seat-b' } });
    expect(used.pendingChoice!.options.map((o) => o.id)).toEqual(['cb']);
    const done = h.choose(h.choose(used, 'cb'), 'move-card');
    expect(zone(done, 'seat-a:equip')).toEqual(['cb']);
    expect(done.pendingChoice ?? null).toBeNull();
  });

  it('a hidden Pan Feng declining stays hidden and changes nothing', () => {
    const done = h.decline(strike([crossbow], [], 'alternate:pan-feng', false));
    expect(seatOf(done, 'seat-a').generals!.main.revealed).toBe(false);
    expect(zone(done, 'seat-b:equip')).toEqual(['cb']);
    expect(done.pendingChoice ?? null).toBeNull();
  });

  it('a hidden Pan Feng whose victim dies in its dying round is not asked, and stays hidden', () => {
    const t = table({ 'seat-a:hand': [card('s1', 'sha', 'heart', 7)], 'seat-b:equip': [crossbow] }, { generals: { 'seat-a': ['alternate:pan-feng', 'filler-jia-xu', false] }, hp: { 'seat-b': 1 } });
    const s = finish(hk.pass(hk.play(t, 's1', 'seat-b')));
    expect(seatOf(s, 'seat-b').eliminated).toBe(true);
    expect(askedAbout(s)).toBeNull();
    expect(seatOf(s, 'seat-a').generals!.main.revealed).toBe(false);
  });

  it('a hidden Pan Feng whose victim is saved is asked once, after the dying round', () => {
    const t = table({ 'seat-a:hand': [card('s1', 'sha', 'heart', 7)], 'seat-b:equip': [crossbow], 'seat-b:hand': [card('pc', 'peach', 'heart', 3)] }, { generals: { 'seat-a': ['alternate:pan-feng', 'filler-jia-xu', false] }, hp: { 'seat-b': 1 } });
    const dyingNow = hk.pass(hk.play(t, 's1', 'seat-b'));
    expect(askedAbout(dyingNow)).toBeNull();
    const asked = hk.respond(dyingNow, 'pc');
    expect(askedAbout(asked)).toBe(id);
    const used = hk.use(asked);
    expect(seatOf(used, 'seat-a').generals!.main.revealed).toBe(true);
    expect(used.pendingChoice).toMatchObject({ verb: 'pick', reason: { targetSeatId: 'seat-b' } });
    expect(used.pendingChoice!.options.map((o) => o.id)).toEqual(['cb']);
  });

  it('a Default General has no such skill', () => {
    expect(askedAbout(strike([crossbow], [], 'filler-xu-huang'))).toBeNull();
  });
});

describe('Alternate Tian Feng, Deathly Counsel', () => {
  const id = 'alternate:deathly-counsel';
  const zone = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
  const lose = (extra: Record<string, ReturnType<typeof card>[]> = {}, revealed = true) =>
    h.run(table({ 'seat-a:hand': [card('x1', 'shan')], ...extra }, { generals: { 'seat-a': ['alternate:tian-feng', 'filler-jia-xu', revealed] } }), [
      { kind: 'MoveCardEffect', cardInstanceId: 'x1', toZoneId: 'discardPile' },
    ]);

  it('is asked when his last hand card leaves; declining changes nothing', () => {
    const s = lose({ 'seat-b:hand': [card('b1', 'sha')] });
    expect(askedAbout(s)).toBe(id);
    const done = h.decline(s);
    expect(zone(done, 'seat-b:hand')).toEqual(['b1']);
  });

  it('discards a card from another seat’s hand', () => {
    let s = h.choose(h.use(lose({ 'seat-b:hand': [card('b1', 'sha')] })), 'seat-b');
    expect(s.pendingChoice!.options.map((o) => o.shows.kind)).toEqual(['hidden-hand']);
    s = h.choose(s, 'hand');
    expect(zone(s, 'seat-b:hand')).toEqual([]);
    expect(zone(s, 'discardPile')).toContain('b1');
    expect(s.pendingChoice ?? null).toBeNull();
  });

  it('discards a card from another seat’s equipment area, and never offers the judgment area', () => {
    let s = h.choose(h.use(lose({ 'seat-b:equip': [card('cb', 'crossbow', 'club', 1)], 'seat-b:judgment': [card('le', 'indulgence', 'heart', 6)] })), 'seat-b');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['cb']);
    s = h.choose(s, 'cb');
    expect(zone(s, 'discardPile')).toContain('cb');
    expect(zone(s, 'seat-b:judgment')).toEqual(['le']);
  });

  it('only offers seats that have a hand or equipment card', () => {
    const s = h.use(lose({ 'seat-b:hand': [card('b1', 'sha')], 'seat-c:judgment': [card('le', 'indulgence', 'heart', 6)] }));
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b']);
  });

  it('is not asked when no other seat has such a card (a judgment card does not count, nor his own)', () => {
    expect(askedAbout(lose({ 'seat-c:judgment': [card('le', 'indulgence', 'heart', 6)] }))).toBeNull();
  });

  it('is not asked while he still has hand cards', () => {
    const t = table({ 'seat-a:hand': [card('x1', 'shan'), card('x2', 'shan')], 'seat-b:hand': [card('b1', 'sha')] }, { generals: at('seat-a', 'alternate:tian-feng') });
    expect(askedAbout(h.run(t, [{ kind: 'MoveCardEffect', cardInstanceId: 'x1', toZoneId: 'discardPile' }]))).toBeNull();
  });

  it('a hidden Tian Feng is asked too, and using it reveals him', () => {
    const s = lose({ 'seat-b:hand': [card('b1', 'sha')] }, false);
    expect(askedAbout(s)).toBe(id);
    const used = h.use(s);
    expect(used.seats.find((x) => x.id === 'seat-a')!.generals!.main.revealed).toBe(true);
  });

  // One effect can take the whole hand in one step (the kill penalty's DiscardZoneEffect): one ask.
  const wholeHand = () =>
    h.run(
      table(
        { 'seat-a:hand': [card('x1', 'shan'), card('x2', 'shan'), card('x3', 'shan')], 'seat-b:hand': [card('b1', 'sha')], 'seat-c:hand': [card('c1', 'sha')], 'seat-d:hand': [card('d1', 'sha')] },
        { generals: at('seat-a', 'alternate:tian-feng') }
      ),
      [{ kind: 'DiscardZoneEffect', zoneId: 'seat-a:hand' }]
    );

  it('asks once when one effect discards his whole hand; declining ends it', () => {
    const s = wholeHand();
    expect(askedAbout(s)).toBe(id);
    const done = h.decline(s);
    expect(askedAbout(done)).toBeNull();
    expect(done.pendingChoice ?? null).toBeNull();
    expect(['seat-b', 'seat-c', 'seat-d'].map((x) => zone(done, `${x}:hand`).length)).toEqual([1, 1, 1]);
  });

  it('asks once when one effect discards his whole hand; using it discards one card only', () => {
    const done = h.choose(h.choose(h.use(wholeHand()), 'seat-b'), 'hand');
    expect(askedAbout(done)).toBeNull();
    expect(done.pendingChoice ?? null).toBeNull();
    expect(['seat-b', 'seat-c', 'seat-d'].map((x) => zone(done, `${x}:hand`).length)).toEqual([0, 1, 1]);
  });

  it('is asked when the last card is played (a Sha)', () => {
    const t = table({ 'seat-a:hand': [card('s1', 'sha', 'heart', 7)], 'seat-c:hand': [card('c1', 'sha')] }, { generals: at('seat-a', 'alternate:tian-feng') });
    const s = h.play(t, 's1', 'seat-b');
    expect(askedAbout(s.pendingResponse ? h.pass(s) : s)).toBe(id);
  });
});

describe('Alternate Tian Feng, With the Tide', () => {
  const id = 'alternate:with-the-tide';
  const hk = harness(kwMode);
  // seat-a is Tian Feng (Qun). Kingdoms: seat-a and seat-c Qun, seat-b Wei, seat-d Shu, by default.
  const setup = (o: TableOptions = {}, cards: Record<string, ReturnType<typeof card>[]> = {}) =>
    table({ 'drawPile': Array.from({ length: 8 }, (_, i) => card(`d${i + 1}`, 'shan')), ...cards }, {
      generals: { 'seat-a': ['alternate:tian-feng', 'filler-jia-xu', true], ...o.generals },
      kingdoms: { 'seat-a': 'Qun', 'seat-b': 'Wei', 'seat-c': 'Qun', 'seat-d': 'Shu', ...o.kingdoms },
      hp: { 'seat-b': 1, 'seat-c': 1, ...o.hp },
    });
  const hit = (source: string, target: string): QueueItem => ({ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: source }, target: { kind: 'seat', seatId: target }, amount: 1, nature: 'normal', cause: { skillId: 'x' } } });
  const settle = (s: GameState) => {
    for (let i = 0; i < 12 && (s.pendingResponse || (s.pendingChoice && askedAbout(s) === id)); i++) s = s.pendingResponse ? hk.pass(s) : hk.use(s);
    return s;
  };
  const dyingFrom = (source: string, target: string, o: TableOptions = {}) => hk.run(setup(o), [hit(source, target)]);
  // The draw comes as the seat enters dying, before anyone is asked to rescue it.
  // (Kingdom War's own kill reward gives the killer 3 more.)
  const drewD1 = (s: GameState) => handIds(settle(s), 'seat-a').length === 1;

  it('a seat of his Kingdom brings another seat to dying: he draws 1 before any rescue ask', () => {
    const s = dyingFrom('seat-c', 'seat-b');
    expect(s.pendingResponse?.reason).toMatchObject({ kind: 'dying', seatId: 'seat-b' });
    expect(handIds(s, 'seat-a')).toEqual(['d1']);
    expect(drewD1(s)).toBe(true);
  });

  it('as an Ambitionist he draws for no one but himself', () => {
    const t = setup();
    const amb = { ...t, seats: t.seats.map((x) => (x.id === 'seat-a' ? { ...x, allegiance: 'ambitionist' as const } : x)) };
    expect(handIds(hk.run(amb, [hit('seat-c', 'seat-b')]), 'seat-a')).toEqual([]);
    expect(handIds(hk.run(amb, [hit('seat-a', 'seat-b')]), 'seat-a')).toEqual(['d1']);
  });

  it('the card he draws can be the Peach he rescues with', () => {
    const s = hk.run(setup({}, { drawPile: [card('pc', 'peach', 'heart', 3)] }), [hit('seat-c', 'seat-b')]);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a', reason: { kind: 'dying', seatId: 'seat-b' } });
    expect(handIds(s, 'seat-a')).toEqual(['pc']);
    const saved = hk.respond(s, 'pc');
    expect(hp(saved, 'seat-b')).toBe(1);
    expect(saved.seats.find((x) => x.id === 'seat-b')!.eliminated).toBeFalsy();
  });

  it('himself bringing another seat to dying also draws', () => {
    // One more than the same kill by a seat without the skill (Kingdom War's own kill reward is the same).
    const base = handIds(settle(dyingFrom('seat-a', 'seat-b', { generals: { 'seat-a': ['filler-xu-huang', 'filler-dong-zhuo', true] } })), 'seat-a').length;
    expect(handIds(settle(dyingFrom('seat-a', 'seat-b')), 'seat-a')).toHaveLength(base + 1);
  });

  it('draws even when the dying seat is an ally of his Kingdom', () => {
    // Checked as the dying round opens: if the ally dies, Kingdom War's penalty for killing one's own
    // Kingdom then discards his whole hand, the drawn card included.
    const s = dyingFrom('seat-a', 'seat-c');
    expect(s.pendingResponse?.reason).toMatchObject({ kind: 'dying', seatId: 'seat-c' });
    expect(handIds(s, 'seat-a')).toEqual(['d1']);
  });

  it('killing an ally of his Kingdom discards his whole hand in one step: Deathly Counsel asks once', () => {
    let s = hk.run(setup({}, { 'seat-a:hand': [card('x1', 'shan'), card('x2', 'shan')], 'seat-b:hand': [card('b1', 'sha')] }), [hit('seat-a', 'seat-c')]);
    while (s.pendingResponse) s = hk.pass(s);
    expect(s.seats.find((x) => x.id === 'seat-c')!.eliminated).toBe(true);
    expect(handIds(s, 'seat-a')).toEqual([]);
    expect(askedAbout(s)).toBe('alternate:deathly-counsel');
    const done = hk.decline(s);
    expect(askedAbout(done)).toBeNull();
    expect(handIds(done, 'seat-b')).toEqual(['b1']);
  });

  it('damage from another Kingdom does not draw', () => {
    expect(handIds(settle(dyingFrom('seat-d', 'seat-b')), 'seat-a')).toEqual([]);
  });

  it('a source with both Generals hidden does not count', () => {
    const s = settle(dyingFrom('seat-c', 'seat-b', { generals: { 'seat-c': ['filler-xu-huang', 'filler-dong-zhuo', false] } }));
    expect(handIds(s, 'seat-a')).toEqual([]);
  });

  it('damage with no source does not draw', () => {
    const s = hk.run(setup(), [{ kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'seat-b' }, amount: 1, nature: 'normal', cause: { skillId: 'x' } } }]);
    expect(handIds(settle(s), 'seat-a')).toEqual([]);
  });

  it('he himself entering dying draws nothing', () => {
    const s = hk.run(setup({ hp: { 'seat-a': 1 } }), [hit('seat-c', 'seat-a')]);
    expect(handIds(settle(s), 'seat-a')).toEqual([]);
  });

  it('an ally of his Kingdom dying costs him 1 HP; its death reveals it first', () => {
    const s = settle(dyingFrom('seat-b', 'seat-c', { kingdoms: { 'seat-b': 'Qun' } }));
    expect(s.seats.find((x) => x.id === 'seat-c')!.eliminated).toBe(true);
    expect(hp(s, 'seat-a')).toBe(3);
  });

  it('losing his last HP to an ally’s death eliminates him without an engine error', () => {
    const s = settle(dyingFrom('seat-b', 'seat-c', { kingdoms: { 'seat-b': 'Qun' }, hp: { 'seat-a': 1 } }));
    expect(s.seats.filter((x) => x.eliminated).map((x) => x.id).sort()).toEqual(['seat-a', 'seat-c']);
  });

  it('a seat of another Kingdom dying costs him nothing', () => {
    const s = settle(dyingFrom('seat-c', 'seat-b'));
    expect(s.seats.find((x) => x.id === 'seat-b')!.eliminated).toBe(true);
    expect(hp(s, 'seat-a')).toBe(4);
  });

  it('he dying himself costs nothing extra', () => {
    const s = settle(hk.run(setup({ hp: { 'seat-a': 1 } }), [hit('seat-d', 'seat-a')]));
    expect(s.seats.find((x) => x.id === 'seat-a')!.eliminated).toBe(true);
    expect(s.seats.filter((x) => x.eliminated).map((x) => x.id)).toEqual(['seat-a']);
  });

  it('a hidden ally of his Kingdom dying costs him 1 HP once revealed at death', () => {
    const s = settle(dyingFrom('seat-d', 'seat-c', { generals: { 'seat-c': ['filler-xu-huang', 'filler-dong-zhuo', false] } }));
    expect(s.seats.find((x) => x.id === 'seat-c')!.eliminated).toBe(true);
    expect(s.seats.find((x) => x.id === 'seat-c')!.generals!.main.revealed).toBe(true);
    expect(hp(s, 'seat-a')).toBe(3);
  });

  it('a hidden Tian Feng is asked only to reveal, before the rescue asks; using it reveals him and he draws', () => {
    const t = setup({ generals: { 'seat-a': ['alternate:tian-feng', 'filler-jia-xu', false] } });
    const at = hk.run(t, [hit('seat-c', 'seat-b')]);
    expect(askedAbout(at)).toBe(id);
    expect(at.pendingResponse ?? null).toBeNull();
    expect(at.seats[0].generals!.main.revealed).toBe(false);
    expect(handIds(at, 'seat-a')).toEqual([]);
    const done = hk.use(at);
    expect(done.seats[0].generals!.main.revealed).toBe(true);
    expect(handIds(done, 'seat-a')).toEqual(['d1']);
    expect(done.pendingResponse?.reason).toMatchObject({ kind: 'dying', seatId: 'seat-b' });
  });

  it('a hidden Tian Feng who is himself the source is of his own Kingdom: asked to reveal, then draws', () => {
    const t = setup({ generals: { 'seat-a': ['alternate:tian-feng', 'filler-jia-xu', false] } });
    const at = hk.run(t, [hit('seat-a', 'seat-b')]);
    expect(askedAbout(at)).toBe(id);
    expect(at.seats[0].generals!.main.revealed).toBe(false);
    const done = hk.use(at);
    expect(done.seats[0].generals!.main.revealed).toBe(true);
    expect(handIds(done, 'seat-a')).toEqual(['d1']);
  });

  it('a hidden Tian Feng declining stays hidden, draws nothing, and the dying round goes on', () => {
    const t = setup({ generals: { 'seat-a': ['alternate:tian-feng', 'filler-jia-xu', false] } });
    const done = hk.decline(hk.run(t, [hit('seat-c', 'seat-b')]));
    expect(done.seats[0].generals!.main.revealed).toBe(false);
    expect(handIds(done, 'seat-a')).toEqual([]);
    expect(done.pendingResponse?.reason).toMatchObject({ kind: 'dying', seatId: 'seat-b' });
  });
});

describe('Alternate Kong Rong, Celebrity', () => {
  const hk = harness(kwMode);
  const hit = (source: string | null, target = 'seat-a', amount = 2): QueueItem => ({
    kind: 'DamageEffect',
    damage: { source: source ? { kind: 'seat' as const, seatId: source } : null, target: { kind: 'seat', seatId: target }, amount, nature: 'normal', cause: { skillId: 'x' } },
  });
  // Seat-a is Kong Rong; seat-b's Main is revealed, its Deputy is hidden unless told otherwise.
  const setup = (o: { revealed?: boolean; ownRevealed?: boolean; hp?: number } = {}) => {
    const t = table({ drawPile: [card('d1', 'shan')] }, { generals: { 'seat-a': ['alternate:kong-rong', 'filler-jia-xu', o.ownRevealed ?? true] }, hp: { 'seat-a': o.hp ?? 4 }, maxHp: { 'seat-a': 4 } });
    return { ...t, seats: t.seats.map((x) => (x.id === 'seat-b' ? { ...x, generals: { main: x.generals!.main, deputy: { ...x.generals!.deputy, revealed: o.revealed ?? false } } } : x)) };
  };

  it('reduces damage by 1 when the source has a hidden General', () => {
    expect(hp(hk.run(setup(), [hit('seat-b', 'seat-a', 2)]), 'seat-a')).toBe(3);
  });

  it('reduces 1 damage to 0', () => {
    const s = hk.run(setup(), [hit('seat-b', 'seat-a', 1)]);
    expect(hp(s, 'seat-a')).toBe(4);
    expect(s.pendingChoice ?? null).toBeNull();
    expect(s.log.some((e) => e.kind === 'DamageDealtEvent')).toBe(false);
  });

  it('a reduction from 2 to 1 still deals 1 damage', () => {
    const s = hk.run(setup(), [hit('seat-b', 'seat-a', 2)]);
    expect(s.log.filter((e) => e.kind === 'DamageDealtEvent')).toMatchObject([{ damage: { amount: 1 } }]);
  });

  it('a chained hit reduced to 0 does not pass along the chain', () => {
    const t = setup();
    const chained = { ...t, seats: t.seats.map((x) => (x.id === 'seat-a' || x.id === 'seat-c' ? { ...x, chained: true as const } : x)) };
    const fire = { ...hit('seat-b', 'seat-a', 1), damage: { ...(hit('seat-b', 'seat-a', 1) as { damage: object }).damage, nature: 'fire' as const } } as QueueItem;
    const s = hk.run(chained, [fire]);
    expect(hp(s, 'seat-a')).toBe(4);
    expect(hp(s, 'seat-c')).toBe(4);
    expect(s.log.some((e) => e.kind === 'DamageDealtEvent')).toBe(false);
  });

  it('a Sha reduced to 0 does not trigger Pan Feng’s Insanity Axe', () => {
    const t = table(
      { 'seat-b:hand': [card('s1', 'sha', 'heart', 7)], 'seat-a:equip': [card('e1', 'crossbow', 'club', 1)] },
      { generals: { 'seat-a': ['alternate:kong-rong', 'filler-jia-xu', true], 'seat-b': ['alternate:pan-feng', 'filler-dong-zhuo', true] }, owner: 'seat-b' }
    );
    const hidden = { ...t, seats: t.seats.map((x) => (x.id === 'seat-b' ? { ...x, generals: { main: x.generals!.main, deputy: { ...x.generals!.deputy, revealed: false } } } : x)) };
    const s = hk.pass(hk.play(hidden, 's1', 'seat-a'));
    expect(hp(s, 'seat-a')).toBe(4);
    expect(askedAbout(s)).toBeNull();
  });

  it('leaves damage from a fully revealed seat unchanged', () => {
    expect(hp(hk.run(setup({ revealed: true }), [hit('seat-b', 'seat-a', 2)]), 'seat-a')).toBe(2);
  });

  it('leaves damage with no source unchanged', () => {
    expect(hp(hk.run(setup(), [hit(null, 'seat-a', 2)]), 'seat-a')).toBe(2);
  });

  it('does not reduce damage to other seats, and the source seat’s own hidden state is irrelevant', () => {
    expect(hp(hk.run(setup(), [hit('seat-b', 'seat-c', 2)]), 'seat-c')).toBe(2);
    // Kong Rong damaging himself while he is the one hidden: his source is revealed, so no change.
    expect(hp(hk.run(setup({ revealed: true }), [hit('seat-a', 'seat-a', 2)]), 'seat-a')).toBe(2);
  });

  it('a Sha from a seat with a hidden General deals 1 less', () => {
    const t = { ...setup(), turn: { ...setup().turn, ownerSeatId: 'seat-b' } };
    const s = hk.play({ ...t, zones: t.zones.map((z) => (z.id === 'seat-b:hand' ? { ...z, cards: [card('s1', 'sha', 'heart', 7)] } : z)) }, 's1', 'seat-a');
    expect(hp(hk.pass(s), 'seat-a')).toBe(4);
  });

  it('a hidden Kong Rong is asked to reveal; using it reveals him and reduces the damage', () => {
    const s = hk.run(setup({ ownRevealed: false }), [hit('seat-b', 'seat-a', 2)]);
    expect(askedAbout(s)).toBe('alternate:celebrity');
    const done = hk.use(s);
    expect(done.seats[0].generals!.main.revealed).toBe(true);
    expect(hp(done, 'seat-a')).toBe(3);
  });
});

describe('Alternate Kong Rong, Comity', () => {
  const id = 'alternate:comity';
  const zone = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
  const kong = (cards: Record<string, ReturnType<typeof card>[]>, o: TableOptions = {}) =>
    table(cards, { generals: { 'seat-a': ['alternate:kong-rong', 'filler-jia-xu', true] }, ...o });
  const discard = (s: GameState, cardInstanceId: string) => h.act(s, { kind: 'DiscardCardAction', seatId: 'seat-a', cardInstanceId });
  const five = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6'].map((n) => card(n, 'shan', 'heart'));

  it('asks once for a Discard Phase discard of 2 cards, and giving puts both in the chosen seat’s hand', () => {
    let s = discard(kong({ 'seat-a:hand': five }, { phase: 'Discard' }), 'x1');
    expect(askedAbout(s)).toBeNull();
    s = discard(s, 'x2');
    expect(askedAbout(s)).toBe(id);
    s = h.choose(h.use(s), 'seat-c');
    expect(zone(s, 'seat-c:hand')).toEqual(['x1', 'x2']);
    expect(zone(s, 'discardPile')).toEqual([]);
    expect(zone(s, 'seat-a:hand')).toHaveLength(4);
    expect(s.pendingChoice ?? null).toBeNull();
  });

  it('declining leaves them in the discard pile', () => {
    const s = h.decline(discard(discard(kong({ 'seat-a:hand': five }, { phase: 'Discard' }), 'x1'), 'x2'));
    expect(zone(s, 'discardPile')).toEqual(['x1', 'x2']);
    expect(zone(s, 'seat-c:hand')).toEqual([]);
  });

  it('does not offer himself as the receiver', () => {
    const s = h.use(discard(discard(kong({ 'seat-a:hand': five }, { phase: 'Discard' }), 'x1'), 'x2'));
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
  });

  it('a Sha he plays is not asked', () => {
    const s = h.play(kong({ 'seat-a:hand': [card('s1', 'sha', 'heart', 7)] }), 's1', 'seat-b');
    expect(askedAbout(s.pendingResponse ? h.pass(s) : s)).toBeNull();
  });

  it('asks when a worn card is lost to Dismantle, and giving it puts it in the seat’s hand', () => {
    const t = kong({ 'seat-a:equip': [card('e1', 'crossbow', 'club', 1)], 'seat-b:hand': [card('t1', 'break', 'spade')] }, { owner: 'seat-b' });
    let s = h.play(t, 't1', 'seat-a');
    while (s.pendingResponse) s = h.pass(s);
    expect(s.pendingChoice!.seatId).toBe('seat-b');
    s = h.choose(s, 'e1');
    expect(askedAbout(s)).toBe(id);
    s = h.choose(h.use(s), 'seat-d');
    expect(zone(s, 'seat-d:hand')).toEqual(['e1']);
    expect(zone(s, 'discardPile')).toContain('t1');
    expect(zone(s, 'discardPile')).not.toContain('e1');
  });

  it('asks when a worn card is replaced by new Equipment, and giving it puts it in the seat’s hand', () => {
    const t = kong({ 'seat-a:equip': [card('e1', 'crossbow', 'club', 1)], 'seat-a:hand': [card('e2', 'ice-sword', 'spade', 2)] });
    const s = h.play(t, 'e2');
    expect(askedAbout(s)).toBe(id);
    const done = h.choose(h.use(s), 'seat-c');
    expect(zone(done, 'seat-c:hand')).toEqual(['e1']);
    expect(zone(done, 'seat-a:equip')).toEqual(['e2']);
  });

  it('asks only once when one effect discards the whole hand', () => {
    const run = () => h.run(kong({ 'seat-a:hand': five.slice(0, 3) }), [{ kind: 'DiscardZoneEffect', zoneId: 'seat-a:hand' }]);
    const declined = h.decline(run());
    expect(askedAbout(declined)).toBeNull();
    expect(zone(declined, 'discardPile')).toEqual(['x1', 'x2', 'x3']);
    const given = h.choose(h.use(run()), 'seat-b');
    expect(askedAbout(given)).toBeNull();
    expect(zone(given, 'seat-b:hand')).toEqual(['x1', 'x2', 'x3']);
  });

  it('asks once for a skill-cost discard of several cards', () => {
    const s = h.run(kong({ 'seat-a:hand': five }), [
      { kind: 'MoveCardEffect', cardInstanceId: 'x1', toZoneId: 'discardPile' },
      { kind: 'MoveCardEffect', cardInstanceId: 'x2', toZoneId: 'discardPile' },
      { kind: 'MoveCardEffect', cardInstanceId: 'x3', toZoneId: 'discardPile' },
    ]);
    expect(askedAbout(s)).toBe(id);
    const done = h.choose(h.use(s), 'seat-b');
    expect(zone(done, 'seat-b:hand')).toEqual(['x1', 'x2', 'x3']);
    expect(done.pendingChoice ?? null).toBeNull();
  });

  it('is not asked for cards another seat discards', () => {
    const s = h.run(kong({ 'seat-b:hand': five }), [{ kind: 'MoveCardEffect', cardInstanceId: 'x1', toZoneId: 'discardPile' }]);
    expect(askedAbout(s)).toBeNull();
  });

  it('with every other seat dead, nothing is asked', () => {
    const t = kong({ 'seat-a:hand': five });
    const dead = { ...t, seats: t.seats.map((x) => (x.id === 'seat-a' ? x : { ...x, eliminated: true })) };
    const s = h.run(dead, [{ kind: 'MoveCardEffect', cardInstanceId: 'x1', toZoneId: 'discardPile' }]);
    expect(askedAbout(s)).toBeNull();
    expect(zone(s, 'discardPile')).toEqual(['x1']);
  });

  it('a hidden Kong Rong is asked too, and using it reveals him', () => {
    const t = table({ 'seat-a:hand': five }, { generals: { 'seat-a': ['alternate:kong-rong', 'filler-jia-xu', false] } });
    const s = h.run(t, [{ kind: 'MoveCardEffect', cardInstanceId: 'x1', toZoneId: 'discardPile' }]);
    expect(askedAbout(s)).toBe(id);
    expect(h.use(s).seats[0].generals!.main.revealed).toBe(true);
  });
});

describe('Alternate Ma Teng', () => {
  const horse = 'alternate:horsemanship';
  const id = 'alternate:call-of-valour';
  const six = (o: TableOptions = {}, cards: Record<string, ReturnType<typeof card>[]> = {}) =>
    table({ drawPile: Array.from({ length: 30 }, (_, i) => card(`d${i}`, 'shan')), ...cards }, { seats: 6, generals: at('seat-a', 'alternate:ma-teng'), ...o });
  const hands = (s: GameState) => Object.fromEntries(s.seats.map((x) => [x.id, handIds(s, x.id).length]));

  it('Horsemanship: his distance to others is 1 less, never below 1', () => {
    const s = six();
    expect(skillsInPlay(s, 'seat-a', registry, true).map((x) => x.skill.id)).toContain(horse);
    expect(seatDistance(s, 'seat-a', 'seat-b', registry)).toBe(1);
    expect(seatDistance(s, 'seat-a', 'seat-d', registry)).toBe(2);
    expect(seatDistance(s, 'seat-d', 'seat-a', registry)).toBe(3);
  });

  it('Call of Valour: every exposed seat of his Kingdom draws 3; a hidden seat does not', () => {
    const kingdoms = { 'seat-a': 'Qun', 'seat-b': 'Qun', 'seat-c': 'Qun', 'seat-d': 'Qun', 'seat-e': 'Wei', 'seat-f': 'Shu' } as const;
    const s = h.useSkill(six({ kingdoms, generals: { ...at('seat-a', 'alternate:ma-teng'), 'seat-d': ['filler-xu-huang', 'filler-dong-zhuo', false] } }), 'seat-a', id);
    expect(hands(s)).toEqual({ 'seat-a': 3, 'seat-b': 3, 'seat-c': 3, 'seat-d': 0, 'seat-e': 0, 'seat-f': 0 });
    expect(handIds(s, 'seat-a')).toEqual(['d0', 'd1', 'd2']);
  });

  const healed = (kingdoms: NonNullable<TableOptions['kingdoms']>, hp = 3) => hp_(h.useSkill(six({ kingdoms, hp: { 'seat-a': hp } }), 'seat-a', id));
  const hp_ = (s: GameState) => hp(s, 'seat-a');
  const qun = (n: number) => Object.fromEntries(['seat-a', 'seat-b', 'seat-c', 'seat-d', 'seat-e', 'seat-f'].map((x, i) => [x, i < n ? 'Qun' : i < n + 2 ? 'Wei' : 'Shu'])) as NonNullable<TableOptions['kingdoms']>;

  it('as an Ambitionist he is a group of one: only he draws 3, and he heals', () => {
    const kingdoms = { 'seat-a': 'Qun', 'seat-b': 'Qun', 'seat-c': 'Qun', 'seat-d': 'Qun', 'seat-e': 'Wei', 'seat-f': 'Shu' } as const;
    const t = six({ kingdoms, hp: { 'seat-a': 3 }, generals: at('seat-a', 'alternate:ma-teng') });
    const s = h.useSkill({ ...t, seats: t.seats.map((x) => (x.id === 'seat-a' ? { ...x, allegiance: 'ambitionist' as const } : x)) }, 'seat-a', id);
    expect(hands(s)).toEqual({ 'seat-a': 3, 'seat-b': 0, 'seat-c': 0, 'seat-d': 0, 'seat-e': 0, 'seat-f': 0 });
    expect(hp_(s)).toBe(4);
  });

  it('heals 1 when his Kingdom is the smallest, a tie included; not when larger', () => {
    expect(healed({ ...qun(1), 'seat-b': 'Wei', 'seat-c': 'Wei', 'seat-d': 'Shu', 'seat-e': 'Shu', 'seat-f': 'Shu' })).toBe(4);
    expect(healed({ ...qun(2), 'seat-c': 'Wei', 'seat-d': 'Wei', 'seat-e': 'Shu', 'seat-f': 'Shu' })).toBe(4);
    expect(healed({ ...qun(3), 'seat-d': 'Wei', 'seat-e': 'Wei', 'seat-f': 'Shu' })).toBe(3);
  });

  it('at full HP healing does nothing and does not error', () => {
    const s = h.useSkill(six({ kingdoms: qun(1) }), 'seat-a', id);
    expect(hp_(s)).toBe(4);
    expect(handIds(s, 'seat-a')).toHaveLength(3);
  });

  it('is once per game, including on a later turn, and only in the Play Phase', () => {
    const s = h.useSkill(six({ kingdoms: qun(1) }), 'seat-a', id);
    expect(offered(s, 'seat-a', id)).toBe(false);
    expect(offered({ ...s, turn: { ...s.turn, turnNumber: 9 } }, 'seat-a', id)).toBe(false);
    expect(offered(six({ phase: 'Draw' }), 'seat-a', id)).toBe(false);
    expect(offered(six({ owner: 'seat-b' }), 'seat-a', id)).toBe(false);
    expect(offered(six(), 'seat-a', id)).toBe(true);
  });

  it('a hidden Ma Teng may use it, which reveals him, and counts as his Kingdom', () => {
    const t = six({ kingdoms: { 'seat-a': 'hidden' as never, 'seat-b': 'Wei', 'seat-c': 'Wei', 'seat-d': 'Shu', 'seat-e': 'Shu', 'seat-f': 'Shu' }, generals: { 'seat-a': ['alternate:ma-teng', 'filler-jia-xu', false] } });
    const s = h.useSkill(t, 'seat-a', id);
    expect(s.seats[0].generals!.main.revealed).toBe(true);
    expect(handIds(s, 'seat-a')).toHaveLength(3);
  });
});

describe('Alternate Ji Ling, Double Edged', () => {
  const id = 'alternate:double-edged';
  // Six seats; seat-a (Ji Ling) enters his Play Phase (no Draw). Seat-d is 3 away. He competes with 'k' (K).
  const start = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    h.settle(table({ 'seat-a:hand': [card('k', 'shan', 'spade', 13)], 'seat-d:hand': [card('x', 'peach', 'heart', 5)], ...cards }, { seats: 6, phase: 'Draw', flags: { skipDraw: true }, generals: at('seat-a', 'alternate:ji-ling'), ...o }));
  // Use it, pick `foe`, show `mine` then the foe's `theirs`.
  const compete = (s: GameState, foe = 'seat-d', mine = 'k', theirs = 'x') => h.select(h.select(h.select(h.use(s), foe), mine), theirs);
  const pile = (s: GameState) => s.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId);

  it('at the start of his Play Phase he is asked; he picks a seat with a hand card to compete with', () => {
    const s = start({ 'seat-b:hand': [card('y', 'shan')] });
    expect(askedAbout(s)).toBe(id);
    expect(h.use(s).pendingSelection).toMatchObject({ of: 'seats', eligibleIds: ['seat-b', 'seat-d'] });
  });

  it('a win against a seat 3 away: Sha at it with no range limit, damage when it has no Shan', () => {
    const s = compete(start());
    expect(seatDistance(s, 'seat-a', 'seat-d', registry)).toBe(3);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-d', allowedCardIds: ['shan'] });
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ seatId: 'seat-a', card: { as: 'sha', physical: [] }, targets: [{ seatId: 'seat-d' }] });
    const done = h.pass(s);
    expect(hp(done, 'seat-d')).toBe(3);
    expect(done.phase).toBe('Play');
    expect(done.turn.ownerSeatId).toBe('seat-a');
  });

  it('both competing cards are discarded', () => {
    expect(pile(compete(start()))).toEqual(expect.arrayContaining(['k', 'x']));
  });

  it('a Shan answers it', () => {
    const s = compete(start({ 'seat-d:hand': [card('x', 'peach', 'heart', 5), card('n', 'shan')] }));
    const done = h.respond(s, 'n');
    expect(hp(done, 'seat-d')).toBe(4);
  });

  it('Armor applies: Eight Trigrams dodges it on red; Wood Armor stops it; Black Shield does not stop a Sha with no colour', () => {
    const trigrams = compete(start({ 'seat-d:equip': [card('et', 'eight-trigrams', 'spade', 2)], drawPile: [card('j', 'peach', 'heart', 9)] }));
    expect(askedAbout(trigrams)).toBe('eight-trigrams');
    expect(hp(h.use(trigrams), 'seat-d')).toBe(4);
    const wood = compete(start({ 'seat-d:equip': [card('wa', 'wood-armor', 'spade', 2)] }));
    expect(wood.pendingResponse).toBeNull();
    expect(hp(wood, 'seat-d')).toBe(4);
    const shield = compete(start({ 'seat-d:equip': [card('bs', 'black-shield', 'spade', 2)] }));
    expect(hp(h.pass(shield), 'seat-d')).toBe(3);
  });

  it('Wine does not apply to it and is not spent', () => {
    const s = h.pass(compete(start({}, { flags: { skipDraw: true, wine: true } })));
    expect(hp(s, 'seat-d')).toBe(3);
    expect(s.turn.flags?.['wine']).toBe(true);
  });

  it('it does not count toward his one-Sha limit: he then plays his own Sha, and only one', () => {
    let s = h.pass(compete(start({ 'seat-a:hand': [card('k', 'shan', 'spade', 13), card('s1', 'sha'), card('s2', 'sha')] })));
    expect(s.turn.cardPlays?.['sha'] ?? 0).toBe(0);
    expect(h.legal(s, 'seat-a').some((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 's1')).toBe(true);
    s = h.pass(h.play(s, 's1', 'seat-b'));
    expect(hp(s, 'seat-b')).toBe(3);
    expect(h.legal(s, 'seat-a').some((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 's2')).toBe(false);
  });

  it('a win against an exposed seat offers the loser and the living exposed seats of its Kingdom, never himself', () => {
    const kingdoms = { 'seat-a': 'Qun', 'seat-b': 'Qun', 'seat-c': 'Wu', 'seat-d': 'Qun', 'seat-e': 'Wei', 'seat-f': 'Qun' } as const;
    const generals = { ...at('seat-a', 'alternate:ji-ling'), 'seat-f': ['filler-xu-huang', 'filler-dong-zhuo', false] } as NonNullable<TableOptions['generals']>;
    const s = compete(start({}, { seats: 6, phase: 'Draw', flags: { skipDraw: true }, kingdoms, generals }));
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-d', 'seat-b']);
    const shot = h.choose(s, 'seat-b');
    expect(shot.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    expect(hp(h.pass(shot), 'seat-b')).toBe(3);
  });

  it('a hidden loser has no Kingdom: the Sha goes at the loser with no pick', () => {
    const kingdoms = { 'seat-a': 'Qun', 'seat-b': 'Qun', 'seat-c': 'Wu', 'seat-d': 'Qun', 'seat-e': 'Wei', 'seat-f': 'Qun' } as const;
    const generals = { ...at('seat-a', 'alternate:ji-ling'), 'seat-d': ['filler-xu-huang', 'filler-dong-zhuo', false] } as NonNullable<TableOptions['generals']>;
    const s = compete(start({}, { seats: 6, phase: 'Draw', flags: { skipDraw: true }, kingdoms, generals }));
    expect(s.pendingChoice).toBeFalsy();
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-d' });
  });

  it('a tie ends his Play Phase', () => {
    const s = compete(start({ 'seat-d:hand': [card('x', 'peach', 'heart', 13)] }));
    expect(s.log.some((e) => e.kind === 'PhaseChangedEvent' && e.seatId === 'seat-a' && e.phase === 'Discard')).toBe(true);
    expect(s.turn.ownerSeatId).toBe('seat-b');
    expect(s.log.some((e) => e.kind === 'CardPlayedEvent')).toBe(false);
  });

  it('a loss ends his Play Phase', () => {
    const s = compete(start({ 'seat-a:hand': [card('k', 'shan', 'spade', 2)] }));
    expect(s.turn.ownerSeatId).toBe('seat-b');
    expect(hp(s, 'seat-d')).toBe(4);
    expect(pile(s)).toEqual(expect.arrayContaining(['k', 'x']));
  });

  it('declining leaves his Play Phase as it is', () => {
    const s = h.decline(start());
    expect(s.phase).toBe('Play');
    expect(s.turn.ownerSeatId).toBe('seat-a');
  });

  it('is not asked when no other seat has a hand card, or when he has none', () => {
    expect(askedAbout(start({ 'seat-d:hand': [] }))).toBeNull();
    expect(askedAbout(start({ 'seat-a:hand': [] }))).toBeNull();
  });

  it('a hidden Ji Ling is asked, and using it reveals him', () => {
    const s = start({}, { seats: 6, phase: 'Draw', flags: { skipDraw: true }, generals: { 'seat-a': ['alternate:ji-ling', 'filler-jia-xu', false] } });
    expect(askedAbout(s)).toBe(id);
    expect(h.use(s).seats[0].generals!.main.revealed).toBe(true);
  });

  it('a loser gone before the Sha is picked: the Sha goes at a living seat of its Kingdom, or nowhere, with no error', () => {
    const kingdoms = { 'seat-a': 'Wei', 'seat-b': 'Qun', 'seat-c': 'Wu', 'seat-d': 'Qun', 'seat-e': 'Wei', 'seat-f': 'Shu' } as const;
    const before = h.select(h.select(h.use(start({}, { seats: 6, phase: 'Draw', flags: { skipDraw: true }, kingdoms })), 'seat-d'), 'k');
    const gone = (s: GameState): GameState => ({ ...s, seats: s.seats.map((x) => (x.id === 'seat-d' ? { ...x, eliminated: true } : x)) });
    const s = h.select(gone(before), 'x');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    const alone = h.select(gone(h.select(h.select(h.use(start()), 'seat-d'), 'k')), 'x');
    expect(alone.pendingResponse).toBeNull();
    expect(alone.phase).toBe('Play');
  });
});

describe('Alternate Zou Shi, Femme Fatale', () => {
  const id = 'alternate:femme-fatale';
  const seatOf = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!;
  // `seatId`'s General in `slot` turned face down (or up).
  const setRevealed = (s: GameState, seatId: string, slot: 'main' | 'deputy', revealed: boolean): GameState => ({
    ...s,
    seats: s.seats.map((x) => (x.id === seatId ? { ...x, generals: { ...x.generals!, [slot]: { ...x.generals![slot], revealed } } } : x)),
  });
  // Seat-a is Zou Shi (exposed unless said); seat-b is a hidden Zhao Yun (Main) and Sima Yi (Deputy), with a Sha in hand.
  // `owner` takes the turn: seat-a's Sha (or seat-c's) at seat-b.
  const scene = (o: { zouShi?: boolean; owner?: string } = {}) =>
    table(
      { 'seat-a:hand': [card('sa', 'sha'), card('xa', 'shan')], 'seat-c:hand': [card('sc', 'sha'), card('xc', 'shan')], 'seat-b:hand': [card('sb', 'sha')] },
      { generals: { 'seat-a': ['alternate:zou-shi', 'filler-jia-xu', o.zouShi ?? true], 'seat-b': ['zhao-yun', 'sima-yi', false] }, owner: o.owner ?? 'seat-a' }
    );
  const shaAtB = (s: GameState) => h.play(s, s.turn.ownerSeatId === 'seat-a' ? 'sa' : 'sc', 'seat-b');
  const conversions = (s: GameState) => h.legal(s, 'seat-b').filter((a) => a.kind === 'UseConversionAction');

  it('a hidden Zou Shi may use it in her Play Phase to expose her General, at no other cost', () => {
    const s0 = scene({ zouShi: false });
    expect(offered(s0, 'seat-a', id)).toBe(true);
    const s = h.useSkill(s0, 'seat-a', id);
    expect(seatOf(s, 'seat-a').generals!.main.revealed).toBe(true);
    expect(seatOf(s, 'seat-a').generals!.deputy.revealed).toBe(false);
    expect(handIds(s, 'seat-a')).toEqual(['sa', 'xa']);
    expect(hp(s, 'seat-a')).toBe(4);
    expect(s.pendingChoice ?? s.pendingSelection ?? s.pendingResponse ?? null).toBeNull();
    expect(s.log.some((e) => e.kind === 'GeneralRevealedEvent' && e.seatId === 'seat-a' && e.slot === 'main')).toBe(true);
    expect(offered(s, 'seat-a', id)).toBe(false);
  });

  it('is not offered once exposed, nor outside her Play Phase', () => {
    expect(offered(scene(), 'seat-a', id)).toBe(false);
    expect(offered({ ...scene({ zouShi: false }), phase: 'Discard' }, 'seat-a', id)).toBe(false);
    expect(offered(scene({ zouShi: false, owner: 'seat-c' }), 'seat-a', id)).toBe(false);
  });

  it('during her turn another seat may not expose by a conversion (skill use) or a trigger ask', () => {
    const s = shaAtB(scene());
    expect(s.pendingResponse?.respondingSeatId).toBe('seat-b');
    expect(conversions(s)).toEqual([]);
    const hit = h.pass(s);
    expect(hp(hit, 'seat-b')).toBe(3);
    expect(askedAbout(hit)).toBeNull();
    expect(seatOf(hit, 'seat-b').generals!.deputy.revealed).toBe(false);
  });

  it('in another seat’s turn the same seat may expose by a conversion or a trigger ask', () => {
    const s = shaAtB(scene({ owner: 'seat-c' }));
    expect(conversions(s).length).toBeGreaterThan(0);
    const hit = h.pass(s);
    expect(askedAbout(hit)).toBe('feedback');
    expect(seatOf(h.use(hit), 'seat-b').generals!.deputy.revealed).toBe(true);
  });

  it('in another seat’s turn, its Start-window reveal and a Roar reveal-on-use go ahead', () => {
    const start = setRevealed(
      { ...table({}, { generals: { 'seat-a': ['alternate:zou-shi', 'filler-jia-xu', true], 'seat-b': ['zhang-fei', 'filler-dong-zhuo', false] }, owner: 'seat-b', phase: 'Start' }) },
      'seat-b', 'main', false
    );
    const windowOpen: GameState = { ...start, turn: { ...start.turn, startWindow: true } };
    const revealed = h.act(windowOpen, { kind: 'ConfirmRevealsAction', seatId: 'seat-b', slots: ['main'] });
    expect(seatOf(revealed, 'seat-b').generals!.main.revealed).toBe(true);
    // Seat-b's Play Phase: a second Sha is played through the hidden Roar, which reveals Zhang Fei.
    const play = table({ 'seat-b:hand': [card('s1', 'sha'), card('s2', 'sha')] }, { generals: { 'seat-a': ['alternate:zou-shi', 'filler-jia-xu', true], 'seat-b': ['zhang-fei', 'filler-dong-zhuo', false] }, owner: 'seat-b' });
    const once = h.pass(h.play(play, 's1', 'seat-c'));
    const twice = h.play(once, 's2', 'seat-c');
    expect(seatOf(twice, 'seat-b').generals!.main.revealed).toBe(true);
  });

  it('during her turn another seat’s hidden Roar is not in play, even to be revealed on use', () => {
    const s = table({}, { generals: { 'seat-a': ['alternate:zou-shi', 'filler-jia-xu', true], 'seat-b': ['zhang-fei', 'filler-dong-zhuo', false] } });
    expect(skillsInPlay(s, 'seat-b', registry, true).map((x) => x.skill.id)).toEqual([]);
    expect(skillsInPlay(setRevealed(s, 'seat-a', 'main', false), 'seat-b', registry, true).map((x) => x.skill.id)).toEqual(['roar']);
  });

  it('hidden at her turn start, she blocks nothing until she exposes; then the block holds', () => {
    const hidden = scene({ zouShi: false });
    expect(conversions(shaAtB(hidden)).length).toBeGreaterThan(0);
    const exposed = shaAtB(h.useSkill(hidden, 'seat-a', id));
    expect(conversions(exposed)).toEqual([]);
    expect(askedAbout(h.pass(exposed))).toBeNull();
  });

  it('does not block her own seat: her hidden Deputy’s Roar reveals on use during her turn', () => {
    const s0 = setRevealed(
      table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha')] }, { generals: { 'seat-a': ['alternate:zou-shi', 'zhang-fei', true] } }),
      'seat-a', 'deputy', false
    );
    const twice = h.play(h.pass(h.play(s0, 's1', 'seat-b')), 's2', 'seat-b');
    expect(seatOf(twice, 'seat-a').generals!.deputy.revealed).toBe(true);
  });
});

describe('Alternate Zou Shi, Impetus for Conflicts', () => {
  const id = 'alternate:impetus-for-conflicts';
  const seatOf = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!;
  // Seat-a is Zou Shi with two Equipment cards in hand; seat-b is Zhang Fei (Main) and Ma Chao (Deputy), both exposed;
  // seat-c has its Deputy hidden.
  const scene = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: { zouShi?: boolean } = {}): GameState => {
    const s = table(
      { 'seat-a:hand': [card('e1', 'red-hare'), card('e2', 'eight-trigrams'), card('k', 'shan')], ...cards },
      { generals: { 'seat-a': ['alternate:zou-shi', 'filler-jia-xu', o.zouShi ?? true], 'seat-b': ['zhang-fei', 'ma-chao', true], 'seat-c': ['sima-yi', 'filler-dong-zhuo', true] } }
    );
    return { ...s, seats: s.seats.map((x) => (x.id === 'seat-c' ? { ...x, generals: { ...x.generals!, deputy: { ...x.generals!.deputy, revealed: false } } } : x)) };
  };
  const hide = (s: GameState, cardId: string, seatId: string, slot: 'main' | 'deputy') => h.choose(h.select(h.select(h.useSkill(s, 'seat-a', id), cardId), seatId), slot);
  const inPlay = (s: GameState, seatId: string) => skillsInPlay(s, seatId, registry).map((x) => x.skill.id);
  const pile = (s: GameState) => s.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId);

  it('needs an Equipment card, in hand or worn', () => {
    expect(offered(scene({ 'seat-a:hand': [card('k', 'shan')] }), 'seat-a', id)).toBe(false);
    expect(offered(scene(), 'seat-a', id)).toBe(true);
    expect(offered(scene({ 'seat-a:hand': [], 'seat-a:equip': [card('w', 'red-hare')] }), 'seat-a', id)).toBe(true);
  });

  it('offers only her Equipment cards, then only other seats with both Generals exposed', () => {
    const s = h.useSkill(scene({ 'seat-a:equip': [card('w', 'axe')] }), 'seat-a', id);
    expect(s.pendingSelection).toMatchObject({ of: 'cards', min: 1, max: 1 });
    expect([...s.pendingSelection!.eligibleIds].sort()).toEqual(['e1', 'e2', 'w']);
    const seats = h.select(s, 'e1');
    expect(seats.pendingSelection).toMatchObject({ of: 'seats' });
    expect(seats.pendingSelection!.eligibleIds).toEqual(['seat-b', 'seat-d']);
  });

  it('is not offered when no other seat has both Generals exposed', () => {
    const s = scene();
    const hidden: GameState = { ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? x : { ...x, generals: { ...x.generals!, main: { ...x.generals!.main, revealed: false } } })) };
    expect(offered(hidden, 'seat-a', id)).toBe(false);
  });

  it('discards the card and hides the picked General, which names both Generals to pick from', () => {
    const picking = h.select(h.select(h.useSkill(scene(), 'seat-a', id), 'e1'), 'seat-b');
    expect(picking.pendingChoice?.options.map((o) => [o.id, o.shows])).toEqual([
      ['main', { kind: 'general', generalId: 'zhang-fei' }],
      ['deputy', { kind: 'general', generalId: 'ma-chao' }],
    ]);
    const s = h.choose(picking, 'main');
    expect(pile(s)).toEqual(['e1']);
    expect(seatOf(s, 'seat-b').generals!.main.revealed).toBe(false);
    expect(seatOf(s, 'seat-b').generals!.deputy.revealed).toBe(true);
    expect(s.log.filter((e) => e.kind === 'GeneralHiddenEvent')).toEqual([{ kind: 'GeneralHiddenEvent', seatId: 'seat-b', slot: 'main' }]);
    expect(s.log.some((e) => e.kind === 'AbilityUsedEvent' && e.abilityId === id && e.targetSeatId === 'seat-b')).toBe(true);
  });

  it('cancelling the first pick costs nothing and does not count a use', () => {
    const s = h.cancel(h.useSkill(scene(), 'seat-a', id));
    expect(handIds(s, 'seat-a')).toEqual(['e1', 'e2', 'k']);
    expect(s.log.some((e) => e.kind === 'AbilityUsedEvent')).toBe(false);
    expect(offered(s, 'seat-a', id)).toBe(true);
  });

  it('hiding the Main: the Deputy’s skills keep working, the Main’s are gone, and the Kingdom stays the Deputy’s', () => {
    expect(inPlay(scene(), 'seat-b')).toEqual(['roar', 'horsemanship', 'iron-cavalry']);
    const s = hide(scene(), 'e1', 'seat-b', 'main');
    expect(inPlay(s, 'seat-b')).toEqual(['horsemanship', 'iron-cavalry']);
    expect(seatDistance(s, 'seat-b', 'seat-d', registry)).toBe(1);
    expect(redactStateForSeat(s, 'seat-c').seats.find((x) => x.id === 'seat-b')!.kingdom).toBe('Shu');
  });

  it('can be used twice in one phase, on two seats; a seat with a General hidden is not offered again', () => {
    const once = hide(scene(), 'e1', 'seat-b', 'main');
    expect(offered(once, 'seat-a', id)).toBe(true);
    expect(h.select(h.useSkill(once, 'seat-a', id), 'e2').pendingSelection!.eligibleIds).toEqual(['seat-d']);
    const s = hide(once, 'e2', 'seat-d', 'deputy');
    expect(pile(s)).toEqual(['e1', 'e2']);
    expect(seatOf(s, 'seat-d').generals!.deputy.revealed).toBe(false);
    expect(s.log.flatMap((e) => (e.kind === 'AbilityUsedEvent' && e.abilityId === id && e.targetSeatId ? [e.targetSeatId] : []))).toEqual(['seat-b', 'seat-d']);
  });

  it('a seat with both Generals hidden again shows no General to others, and has no skill in play', () => {
    // Impetus always leaves the target one exposed General (it needs both exposed): the second hiding is applied directly.
    const once = hide(scene(), 'e1', 'seat-b', 'main');
    const s = h.run(once, [{ kind: 'HideGeneralEffect', seatId: 'seat-b', slot: 'deputy' }]);
    const view = redactStateForSeat(s, 'seat-c');
    const seen = view.seats.find((x) => x.id === 'seat-b')!;
    expect(seen.kingdom).toBe('hidden');
    expect(seen.generals).toEqual({ main: { generalDefinitionId: 'hidden', revealed: false }, deputy: { generalDefinitionId: 'hidden', revealed: false } });
    expect(JSON.stringify(view)).not.toMatch(/zhang-fei|ma-chao/);
    expect(inPlay(s, 'seat-b')).toEqual([]);
  });

  it('a hidden Zou Shi may use it, which exposes her', () => {
    const s = hide(scene({}, { zouShi: false }), 'e1', 'seat-b', 'deputy');
    expect(seatOf(s, 'seat-a').generals!.main.revealed).toBe(true);
    expect(seatOf(s, 'seat-b').generals!.deputy.revealed).toBe(false);
  });

  it('the hidden General can be exposed again outside her turn, not during it', () => {
    // Seat-c is Sima Yi (Main) and exposed; Zou Shi hides Sima Yi, then her Sha damages seat-c.
    const base = table(
      { 'seat-a:hand': [card('e1', 'axe'), card('sa', 'sha'), card('k', 'shan')], 'seat-a:equip': [card('m', 'red-hare')], 'seat-d:hand': [card('sd', 'sha'), card('xd', 'shan')] },
      { generals: { 'seat-a': ['alternate:zou-shi', 'filler-jia-xu', true], 'seat-c': ['sima-yi', 'filler-dong-zhuo', true] } }
    );
    const hidden = hide(base, 'e1', 'seat-c', 'main');
    expect(seatOf(hidden, 'seat-c').generals!.main.revealed).toBe(false);
    const hit = h.pass(h.play(hidden, 'sa', 'seat-c'));
    expect(hp(hit, 'seat-c')).toBe(3);
    expect(askedAbout(hit)).toBeNull();
    // Seat-d's turn: its Sha damages seat-c, whose hidden Sima Yi is asked for Feedback and exposed again.
    const dTurn: GameState = { ...hidden, turn: { ...hidden.turn, ownerSeatId: 'seat-d' } };
    const asked = h.pass(h.play(dTurn, 'sd', 'seat-c'));
    expect(askedAbout(asked)).toBe('feedback');
    expect(seatOf(h.use(asked), 'seat-c').generals!.main.revealed).toBe(true);
    // Or seat-c's own Start window.
    const start: GameState = { ...hidden, phase: 'Start', turn: { ...hidden.turn, ownerSeatId: 'seat-c', startWindow: true } };
    const shown = h.act(start, { kind: 'ConfirmRevealsAction', seatId: 'seat-c', slots: ['main'] });
    expect(seatOf(shown, 'seat-c').generals!.main.revealed).toBe(true);
  });

  it('during her turn, an ask already queued for a General she hid is skipped by the reveal block (no engine error, the skill does nothing)', () => {
    const s = hide(scene(), 'e1', 'seat-b', 'main');
    const owner = { kind: 'general' as const, seatId: 'seat-b', slot: 'main' as const, skillId: 'roar' };
    const next = h.run(s, [{ kind: 'AskUseEffect', owner, abilityId: 'roar', effects: [{ kind: 'DrawCardsEffect', seatId: 'seat-b', count: 5 }] }]);
    expect(next.pendingChoice).toBeFalsy();
    expect(handIds(next, 'seat-b')).toEqual([]);
  });

  it('Zou Shi holds both skills', () => {
    expect(registry.generals.get('alternate:zou-shi')!.skills.map((x) => x.id)).toEqual(['alternate:femme-fatale', id]);
  });
});

describe('Alternate Jia Xu, Descend into Chaos', () => {
  const id = 'alternate:descend-into-chaos';
  const mount = [...registry.cards.values()].find((c) => c.equipSlot === 'defensiveMount')!.id;
  const start = (general: string, skillId: string, cards: Parameters<typeof table>[0] = {}, o: TableOptions = {}) =>
    h.useSkill(table(cards, { generals: at('seat-a', general), ...o }), 'seat-a', skillId);
  const optionsOfB = (s: GameState) => s.pendingChoice!.options.map((o) => o.id);
  // Five seats; seat-b wears a Trident Glaive (range 3): seat-c and seat-a are at distance 1, seat-d and seat-e at 2.
  const five = { 'seat-b:equip': [card('tg', 'trident-glaive')] };

  it('offers only the nearest seats, however far the attack range reaches, and a tie offers both', () => {
    const s = start('alternate:jia-xu', id, five, { seats: 5 });
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-b' });
    expect(optionsOfB(s)).toEqual(['seat-c', 'seat-a', 'pass']);
    expect(s.seats[0].marks).toEqual({ 'upheaval-used': 1 });
  });

  it('Default Jia Xu offers every seat in range on the same table', () => {
    const s = start('jia-xu', 'upheaval', five, { seats: 5 });
    expect(optionsOfB(s)).toEqual(['seat-c', 'seat-d', 'seat-e', 'seat-a', 'pass']);
  });

  it('opens the pick even when only one seat is nearest', () => {
    const s = start('alternate:jia-xu', id, {}, { seats: 2 });
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-b' });
    expect(optionsOfB(s)).toEqual(['seat-a', 'pass']);
  });

  it('skips a nearest seat a Sha cannot target (empty-handed Default Zhuge Liang) for the next nearest', () => {
    // seat-a rides a defensive mount (distance 2 from seat-b); seat-c is the one nearest seat, but untargetable.
    const s = start('alternate:jia-xu', id, { 'seat-a:equip': [card('m', mount)] }, { generals: { ...at('seat-a', 'alternate:jia-xu'), 'seat-c': ['zhuge-liang', 'filler-jia-xu', true] } });
    expect(optionsOfB(s)).toEqual(['seat-d', 'seat-a', 'pass']);
  });

  it('a seat whose nearest seat is beyond its attack range may still pick it, and a Sha at it is played as any Sha', () => {
    // Four seats; seat-a and seat-c ride defensive mounts, so every other seat is at distance 2: all three tie, none within range 1.
    let s = start('alternate:jia-xu', id, { 'seat-a:equip': [card('m1', mount)], 'seat-c:equip': [card('m2', mount)], 'seat-b:hand': [card('s1', 'sha')] });
    expect(optionsOfB(s)).toEqual(['seat-c', 'seat-d', 'seat-a', 'pass']);
    s = h.respond(h.choose(s, 'seat-c'), 's1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', allowedCardIds: ['shan'] });
  });

  it('passing loses 1 HP and moves on; it is once per game', () => {
    const s = h.choose(start('alternate:jia-xu', id), 'pass');
    expect(hp(s, 'seat-b')).toBe(3);
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-c' });
    const t = table({}, { generals: at('seat-a', 'alternate:jia-xu') });
    const used = { ...t, seats: t.seats.map((x) => (x.id === 'seat-a' ? { ...x, marks: { 'upheaval-used': 1 } } : x)) };
    expect(offered(t, 'seat-a', id)).toBe(true);
    expect(offered(used, 'seat-a', id)).toBe(false);
  });

  it('is what Alternate Jia Xu plays for 乱武', () => {
    expect(readyAlternateSkills(alternateGeneralRecords().find((g) => g.id === 'jia-xu')!).map((x) => x.id)).toContain(id);
  });
});

describe('Alternate Zhang Jiao, Lightning Strike', () => {
  const id = 'alternate:lightning-strike';
  const general = (name: string): TableOptions['generals'] => ({ 'seat-a': [name, 'filler-zuo-ci'] });
  // Seat-b Slashes seat-a, who plays a Dodge; the pick is the next thing asked.
  const dodged = (name: string, judged = card('j', 'sha', 'spade', 5)) => {
    const s = h.play(table({ 'seat-b:hand': [card('s1', 'sha')], 'seat-a:hand': [card('n1', 'shan')], drawPile: [judged] }, { owner: 'seat-b', generals: general(name) }), 's1', 'seat-a');
    return h.use(h.respond(s, 'n1'));
  };

  it('is asked after he plays a Dodge, and he can pick any living seat except himself', () => {
    const s = dodged('alternate:zhang-jiao');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
  });

  it('a spade on the seat he picks deals it 2 thunder damage with no source; anything else does nothing', () => {
    const struck = h.choose(dodged('alternate:zhang-jiao'), 'seat-b');
    expect(hp(struck, 'seat-b')).toBe(2);
    expect(struck.log.filter((e) => e.kind === 'DamageDealtEvent').at(-1)).toMatchObject({ damage: { source: null, amount: 2, nature: 'thunder' } });
    expect(hp(h.choose(dodged('alternate:zhang-jiao', card('j', 'sha', 'heart', 5)), 'seat-b'), 'seat-b')).toBe(4);
  });

  it('Default Zhang Jiao may still pick himself', () => {
    expect(dodged('zhang-jiao').pendingChoice!.options.map((o) => o.id)).toContain('seat-a');
  });

  it('is what Alternate Zhang Jiao plays for 雷击, beside Default Dark Magic', () => {
    expect(readyAlternateSkills(alternateGeneralRecords().find((g) => g.id === 'zhang-jiao')!).map((x) => x.id)).toEqual([id, 'dark-magic']);
  });
});
