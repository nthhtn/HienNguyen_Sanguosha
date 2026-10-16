import { createGame, redactStateForSeat, skillsInPlay } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, kwMode, registry, table, TableOptions } from './skills.testing';
import { seatGender } from '../shared/gender';
import { kingdomWarMode } from '../modes/kingdomWar';
import { buildContentRegistry } from '../registry';

const h = harness();
const hk = harness(kwMode);
const at = (seatId: string, main: string, deputy = 'filler-xu-huang', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const inPlay = (s: ReturnType<typeof table>, seatId: string) => skillsInPlay(s, seatId, registry).map((x) => x.skill.id);
const shaDamage = (source: string | null, target: string, amount = 1) => ({
  kind: 'DamageEffect' as const,
  damage: {
    source: source ? { kind: 'seat' as const, seatId: source } : null, target: { kind: 'seat' as const, seatId: target }, amount, nature: 'normal' as const,
    cause: { card: { as: 'sha', colour: 'black' as const, physical: [card('sx', 'sha')] } },
  },
});

describe('Cai Wenji — Lament', () => {
  // seat-a is Cai Wenji and holds k1; seat-c's Sha hurts seat-b; the judgment card is `top`.
  const hurt = (top: 'heart' | 'diamond' | 'club' | 'spade', cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    h.run(table({ 'seat-a:hand': [card('k1', 'shan', 'heart', 2)], 'seat-c:hand': [card('c1', 'shan', 'heart', 3), card('c2', 'shan', 'heart', 4), card('c3', 'shan', 'heart', 5)], drawPile: [card('j', 'shan', top, 6), card('d2', 'shan', 'heart', 7), card('d3', 'shan', 'heart', 8)], ...cards }, { generals: at('seat-a', 'cai-wenji'), ...o }), [shaDamage('seat-c', 'seat-b')]);
  const lament = (top: Parameters<typeof hurt>[0], cards?: Parameters<typeof hurt>[1], o?: TableOptions) => h.select(h.use(hurt(top, cards, o)), 'k1');

  it('heart: the victim recovers 1 HP', () => {
    const s = lament('heart');
    expect(askedAbout(hurt('heart'))).toBe('lament');
    expect(hp(s, 'seat-b')).toBe(4);
    expect(ids(s, 'discardPile')).toEqual(expect.arrayContaining(['k1', 'j']));
  });

  it('diamond: the victim draws 2 cards', () => {
    expect(handIds(lament('diamond'), 'seat-b')).toEqual(['d2', 'd3']);
  });

  it('club: the source discards 2 cards of its choice', () => {
    let s = lament('club');
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-c', min: 2, max: 2 });
    s = h.select(s, 'c1', 'c2');
    expect(handIds(s, 'seat-c')).toEqual(['c3']);
  });

  it('spade: the source turns over', () => {
    expect(lament('spade').seats.find((x) => x.id === 'seat-c')!.faceDown).toBe(true);
  });

  it('works for any seat’s damage by a Sha, but not for damage from anything else; Don’t does nothing', () => {
    const plain = h.run(table({ 'seat-a:hand': [card('k1', 'shan')] }, { generals: at('seat-a', 'cai-wenji') }), [
      { kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-c' }, target: { kind: 'seat', seatId: 'seat-b' }, amount: 1, nature: 'normal' } },
    ]);
    expect(askedAbout(plain)).toBeNull();
    expect(ids(h.decline(hurt('heart')), 'discardPile')).toEqual([]);
  });

  it('with no source the club and spade results do nothing', () => {
    const s = h.select(h.use(h.run(table({ 'seat-a:hand': [card('k1', 'shan')], drawPile: [card('j', 'shan', 'club', 6)] }, { generals: at('seat-a', 'cai-wenji') }), [shaDamage(null, 'seat-b')])), 'k1');
    expect(s.pendingSelection).toBeUndefined();
  });

  it('if the card is gone by the time he pays (spent in a dying round), nothing is asked or discarded', () => {
    const owner = { kind: 'general' as const, seatId: 'seat-a', slot: 'main' as const, skillId: 'lament' };
    const s = h.run(table({}, { generals: at('seat-a', 'cai-wenji') }), [{ kind: 'SkillStepEffect', owner, step: 'pay', data: { victim: 'seat-b', source: 'seat-c' } }]);
    expect(s.pendingSelection).toBeUndefined();
  });

  it('is not asked with no card to discard', () => {
    expect(askedAbout(hurt('heart', { 'seat-a:hand': [] }))).toBeNull();
  });
});

describe('Cai Wenji — Heartbroken', () => {
  // seat-a is Cai Wenji at 1 HP; seat-c kills her.
  const killed = (o: TableOptions = {}, source: string | null = 'seat-c') => {
    let s = hk.run(table({}, { generals: { 'seat-a': ['cai-wenji', 'filler-xu-huang', true], 'seat-c': ['filler-jiang-wei', 'filler-xu-huang', true] }, hp: { 'seat-a': 1 }, kingdoms: { 'seat-a': 'Qun' }, ...o }), [shaDamage(source, 'seat-a')]);
    for (let i = 0; i < 6 && s.pendingResponse; i++) s = hk.pass(s);
    return s;
  };

  it('the killer loses all its skills for the rest of the game', () => {
    const s = killed({ generals: { 'seat-a': ['cai-wenji', 'filler-xu-huang', true], 'seat-c': ['zhang-he', 'liu-shan', true] } });
    expect(s.seats.find((x) => x.id === 'seat-a')!.eliminated).toBe(true);
    expect(s.seats.find((x) => x.id === 'seat-c')!.silenced).toBe(true);
    expect(inPlay(s, 'seat-c')).toEqual([]);
    // Gained skills too.
    const gained = { ...s, seats: s.seats.map((x) => (x.id === 'seat-c' ? { ...x, gainedSkills: [{ slot: 'main' as const, skillId: 'astrology' }] } : x)) };
    expect(inPlay(gained, 'seat-c')).toEqual([]);
  });

  it('silences the killer when Zuo Ci holds Heartbroken as his chosen Form', () => {
    const base = table({}, { generals: { 'seat-a': ['zuo-ci', 'filler-xu-huang', true], 'seat-c': ['zhang-he', 'liu-shan', true] }, hp: { 'seat-a': 1 } });
    const withForm = { ...base, seats: base.seats.map((x) => (x.id === 'seat-a' ? { ...x, forms: { slot: 'main' as const, held: ['cai-wenji'], chosen: { generalId: 'cai-wenji', skillId: 'heartbroken' } } } : x)) };
    let s = hk.run(withForm, [shaDamage('seat-c', 'seat-a')]);
    for (let i = 0; i < 6 && s.pendingResponse; i++) s = hk.pass(s);
    expect(s.seats.find((x) => x.id === 'seat-a')!.eliminated).toBe(true);
    expect(s.seats.find((x) => x.id === 'seat-c')!.silenced).toBe(true);
  });

  it('nothing happens when she dies with no killer, or by her own hand', () => {
    expect(killed({}, null).seats.some((x) => x.silenced)).toBe(false);
    expect(killed({}, 'seat-a').seats.some((x) => x.silenced)).toBe(false);
  });

  it('does not silence a killer who is already out', () => {
    const base = table({}, { generals: at('seat-a', 'cai-wenji'), hp: { 'seat-a': 1 }, kingdoms: { 'seat-a': 'Qun' } });
    let s = hk.run({ ...base, seats: base.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) }, [shaDamage('seat-c', 'seat-a')]);
    for (let i = 0; i < 6 && s.pendingResponse; i++) s = hk.pass(s);
    expect(s.seats.find((x) => x.id === 'seat-a')!.eliminated).toBe(true);
    expect(s.seats.find((x) => x.id === 'seat-c')!.silenced).toBeUndefined();
  });
});

describe('Zuo Ci — Incarnation', () => {
  // Zuo Ci holds Zhou Yu and Da Qiao as Forms.
  const withForms = (o: TableOptions = {}, extra: object = {}) => {
    const s = table({ drawPile: Array.from({ length: 4 }, (_, i) => card(`d${i + 1}`, 'shan', 'heart', i + 1)) }, { generals: at('seat-a', 'zuo-ci'), owner: 'seat-d', phase: 'End', ...o });
    return { ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, forms: { slot: 'main' as const, held: ['zhou-yu', 'da-qiao'] }, ...extra } : x)) };
  };

  it('at the start of his turn he may choose a skill of a Form; it turns face up and he holds the skill', () => {
    let s = h.settle(withForms());
    expect(askedAbout(s)).toBe('incarnation');
    s = h.use(s);
    expect(s.pendingChoice).toMatchObject({ secret: true });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(expect.arrayContaining(['zhou-yu/brave-gesture', 'zhou-yu/sow-revolt']));
    s = h.choose(s, 'zhou-yu/brave-gesture');
    expect(s.seats[0].forms?.chosen).toEqual({ generalId: 'zhou-yu', skillId: 'brave-gesture' });
    expect(inPlay(s, 'seat-a')).toContain('brave-gesture');
    expect(s.log).toContainEqual({ kind: 'FormChosenEvent', seatId: 'seat-a', generalId: 'zhou-yu', skillId: 'brave-gesture' });
  });

  it('also at the end of his turn, and the previous Form’s skill is replaced', () => {
    const chosen = { chosen: { generalId: 'zhou-yu', skillId: 'brave-gesture' } };
    const s = h.settle(withForms({ owner: 'seat-a', phase: 'Play' }, { forms: { slot: 'main', held: ['zhou-yu', 'da-qiao'], ...chosen } }));
    const ended = h.act(s, { kind: 'EndPhaseAction', seatId: 'seat-a' });
    expect(askedAbout(ended)).toBe('incarnation');
    expect(h.use(ended).pendingChoice!.options.map((o) => o.id)).not.toContain('zhou-yu/brave-gesture');
  });

  it('the Form’s gender replaces his own', () => {
    const s = h.choose(h.use(h.settle(withForms())), 'da-qiao/displace');
    expect(seatGender(s, 'seat-a', registry)).toBe('female');
  });

  it('Lord, awakening and limited skills are never offered', () => {
    const s = h.use(h.settle({ ...withForms(), seats: withForms().seats.map((x) => (x.id === 'seat-a' ? { ...x, forms: { slot: 'main' as const, held: ['jiang-wei', 'liu-shan', 'jia-xu'] } } : x)) }));
    const offered = s.pendingChoice!.options.map((o) => o.id);
    expect(offered).toEqual(expect.arrayContaining(['jiang-wei/instigate', 'liu-shan/pleasure']));
    for (const banned of ['jiang-wei/follow-the-master', 'liu-shan/seem-foolish', 'jia-xu/upheaval']) expect(offered).not.toContain(banned);
  });

  it('not asked with no Form to choose from', () => {
    expect(askedAbout(h.settle(withForms({}, { forms: undefined })))).toBeNull();
  });

  it('revealing him for any other reason offers the first choice', () => {
    const s = withForms({ generals: at('seat-a', 'zuo-ci', 'filler-xu-huang', false) });
    expect(askedAbout(h.run(s, [{ kind: 'RevealGeneralEffect', seatId: 'seat-a', slot: 'main' }]))).toBe('incarnation');
  });

  it('other seats never see a spare General: not while he is hidden, and only as hidden cards once he is shown (Review Focus 3)', () => {
    const shown = withForms();
    expect(redactStateForSeat(shown, 'seat-b').seats[0].forms?.held).toEqual(['hidden', 'hidden']);
    expect(redactStateForSeat(shown, 'seat-a').seats[0].forms?.held).toEqual(['zhou-yu', 'da-qiao']);
    const hidden = withForms({ generals: at('seat-a', 'zuo-ci', 'filler-xu-huang', false) });
    expect(redactStateForSeat(hidden, 'seat-b').seats[0].forms).toBeUndefined();
  });
});

describe('Zuo Ci — Incarnation: a Form chosen at Start takes part in that Start (S10)', () => {
  // Zuo Ci holds Zhen Ji (River Goddess: a Start trigger) and Da Qiao as Forms;
  // seat-d's End passes the turn to his Start.
  const startWith = (forms: object) => {
    const s = table({ drawPile: Array.from({ length: 6 }, (_, i) => card(`d${i + 1}`, 'shan', 'heart', i + 1)) }, { generals: at('seat-a', 'zuo-ci'), owner: 'seat-d', phase: 'End' });
    return h.settle({ ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, forms: { slot: 'main' as const, held: ['zhen-ji', 'da-qiao'], ...forms } } : x)) });
  };
  // Answers every ask of his Start: Incarnation picks `pick` (or is declined), the rest are declined.
  // The abilities asked about, in order, until the Start is over.
  const askedThroughStart = (s: ReturnType<typeof table>, pick?: string) => {
    const asked: string[] = [];
    while (s.phase === 'Start' && s.pendingChoice) {
      const about = askedAbout(s);
      if (about) asked.push(about);
      if (about === 'incarnation' && pick) s = h.choose(h.use(s), pick);
      else s = h.decline(s);
    }
    return asked;
  };

  it('a Start-trigger skill chosen at Zuo Ci’s Start fires once at that Start', () => {
    expect(askedThroughStart(startWith({}), 'zhen-ji/river-goddess')).toEqual(['incarnation', 'river-goddess']);
  });

  it('the same skill does not fire twice at a later Start', () => {
    const asked = askedThroughStart(startWith({ chosen: { generalId: 'zhen-ji', skillId: 'river-goddess' } }));
    expect(asked.filter((a) => a === 'river-goddess')).toHaveLength(1);
  });
});

describe('Zuo Ci — Incarnation: a Form chosen at End takes part in that End (S10)', () => {
  // Diao Chan's Eclipse the Moon draws 1 at the start of its owner's End Phase.
  it('a Form skill with an End trigger chosen at End fires exactly once at that End', () => {
    const s = table({ drawPile: Array.from({ length: 6 }, (_, i) => card(`d${i + 1}`, 'shan', 'heart', i + 1)) }, { generals: at('seat-a', 'zuo-ci'), owner: 'seat-a', phase: 'Play' });
    const base = { ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, forms: { slot: 'main' as const, held: ['diao-chan', 'da-qiao'] } } : x)) };
    const before = handIds(base, 'seat-a').length;
    let ended = h.act(h.settle(base), { kind: 'EndPhaseAction', seatId: 'seat-a' });
    expect(askedAbout(ended)).toBe('incarnation');
    ended = h.choose(h.use(ended), 'diao-chan/eclipse-the-moon');
    while (ended.phase === 'End' && ended.pendingChoice) ended = h.decline(ended);
    expect(handIds(ended, 'seat-a').length - before).toBe(1);
  });
});

describe('Zuo Ci — Incarnation: nothing about the Forms is readable before he answers', () => {
  it('the ask other seats can see names no spare General, and neither does the secret choice for them', () => {
    const base = table({}, { generals: at('seat-a', 'zuo-ci'), owner: 'seat-d', phase: 'End' });
    const s0 = { ...base, seats: base.seats.map((x) => (x.id === 'seat-a' ? { ...x, forms: { slot: 'main' as const, held: ['zhou-yu', 'da-qiao'] } } : x)) };
    const asked = h.settle(s0);
    expect(asked.pendingChoice?.reason).toMatchObject({ abilityId: 'incarnation' });
    expect(JSON.stringify(redactStateForSeat(asked, 'seat-b'))).not.toMatch(/zhou-yu|da-qiao|brave-gesture|displace/);
    const chosen = h.use(asked);
    expect(JSON.stringify(redactStateForSeat(chosen, 'seat-b'))).not.toMatch(/zhou-yu|da-qiao|brave-gesture|displace/);
  });
});

describe('seatGender when silenced', () => {
  it('a silenced Zuo Ci has lost his Form’s gender', () => {
    const t = table({}, { generals: at('seat-a', 'zuo-ci') });
    const s = { ...t, seats: t.seats.map((x) => (x.id === 'seat-a' ? { ...x, silenced: true as const, forms: { slot: 'main' as const, held: ['da-qiao'], chosen: { generalId: 'da-qiao', skillId: 'displace' } } } : x)) };
    expect(seatGender(s, 'seat-a', registry)).toBe('male'); // Zuo Ci's own
  });
});

describe('Zuo Ci — New Life', () => {
  it('each point of damage deals him one more Form from the pool', () => {
    const s = table({}, { generals: at('seat-a', 'zuo-ci') });
    const withPool = { ...s, spareGenerals: ['zhou-yu', 'da-qiao', 'lu-xun'], seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, forms: { slot: 'main' as const, held: ['guan-yu'] } } : x)) };
    const out = h.run(withPool, [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-b' }, target: { kind: 'seat', seatId: 'seat-a' }, amount: 2, nature: 'normal' } }]);
    expect(out.seats[0].forms?.held).toEqual(['guan-yu', 'zhou-yu', 'da-qiao']);
    expect(out.spareGenerals).toEqual(['lu-xun']);
  });

  it('an empty pool adds nothing', () => {
    const out = h.run({ ...table({}, { generals: at('seat-a', 'zuo-ci') }), spareGenerals: [] }, [{ kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'seat-a' }, amount: 1, nature: 'normal' } }]);
    expect(out.seats[0].forms).toBeUndefined();
  });
});

describe('Kingdom War deals Zuo Ci his Forms', () => {
  it('a seat that chose a General with spare Generals to deal is dealt them; others are not', () => {
    const trigger = kingdomWarMode.triggers.find((t) => t.point === 'after:GeneralsChosenEvent')!;
    const chosen = table({}, { generals: at('seat-a', 'zuo-ci') });
    const event = { kind: 'GeneralsChosenEvent', seatId: 'seat-a' };
    expect(trigger.condition(chosen, event, undefined, registry)).toBe(true);
    expect(trigger.effect(chosen, event, undefined, registry)).toEqual([{ kind: 'DealSpareGeneralsEffect', seatId: 'seat-a', slot: 'main', count: 2 }]);
    expect(trigger.condition(chosen, { kind: 'GeneralsChosenEvent', seatId: 'seat-b' }, undefined, registry)).toBe(false);
  });

  it('Zuo Ci is never in the spare pool', () => {
    for (let seed = 1; seed <= 10; seed++) {
      expect(createGame(kingdomWarMode, buildContentRegistry(), ['seat-0', 'seat-1', 'seat-2'], seed).spareGenerals).not.toContain('zuo-ci');
    }
  });
});
