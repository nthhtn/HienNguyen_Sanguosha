import { skillsInPlay } from 'engine';
import { askedAbout, card, handIds, harness, hp, ids, registry, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, main: string, deputy = 'filler-xu-huang', revealed = true): TableOptions['generals'] => ({ [seatId]: [main, deputy, revealed] });
const hand = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => card(`${prefix}${i + 1}`, 'shan', 'heart', i + 1));
const inPlay = (s: ReturnType<typeof table>, seatId: string) => skillsInPlay(s, seatId, registry).map((x) => x.skill.id);

describe('Liu Shan — Pleasure', () => {
  const sha = (o: TableOptions = {}, extra: Record<string, ReturnType<typeof card>[]> = {}) =>
    table({ 'seat-a:hand': [card('s1', 'sha', 'spade'), card('k1', 'shan', 'heart', 2), card('t1', 'draw-two', 'club')], ...extra }, { generals: at('seat-b', 'liu-shan'), ...o });

  it('a Slash used on him costs its user another Basic hand card; paying lets the Slash go on', () => {
    let s = h.play(sha(), 's1', 'seat-b');
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', of: 'cards', eligibleIds: ['k1'], min: 1, max: 1 });
    s = h.select(s, 'k1');
    expect(ids(s, 'discardPile')).toContain('k1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' }); // the Dodge window
  });

  it('cancelling the payment means the Slash has no effect', () => {
    const s = h.cancel(h.play(sha(), 's1', 'seat-b'));
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
    expect(s.log.some((e) => e.kind === 'AbilityUsedEvent' && e.outcome === 'no-effect')).toBe(true);
  });

  it('with no other Basic card the Slash has no effect at once; the Slash card itself does not count', () => {
    const s = h.play(sha({}, { 'seat-a:hand': [card('s1', 'sha', 'spade'), card('t1', 'draw-two', 'club')] }), 's1', 'seat-b');
    expect(s.pendingSelection).toBeUndefined();
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
  });

  it('does not touch a Slash at another seat, or a Slash used by Liu Shan', () => {
    expect(h.play(sha(), 's1', 'seat-d').pendingSelection).toBeUndefined();
  });

  it('is off while Liu Shan is hidden', () => {
    expect(h.play(sha({ generals: at('seat-b', 'liu-shan', 'filler-xu-huang', false) }), 's1', 'seat-b').pendingSelection).toBeUndefined();
  });
});

describe('Liu Shan — Decentralization', () => {
  const setup = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    table({ 'seat-a:hand': hand('a', 3), ...cards }, { generals: at('seat-a', 'liu-shan'), phase: 'Draw', ...o });
  const entering = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) => h.settle(setup(cards, o));

  it('may skip his Play Phase; at the end of his turn he discards a hand card and gives another seat an extra turn', () => {
    let s = entering();
    expect(askedAbout(s)).toBe('decentralization');
    s = h.use(s); // Play ends; Discard and End follow
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', of: 'cards', min: 1, max: 1 });
    s = h.select(s, 'a1');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(s.turn.ownerSeatId).toBe('seat-c');
    expect(s.turn.resumeAfterSeatId).toBe('seat-a');
    expect(handIds(s, 'seat-a')).toEqual(['a2', 'a3']);
  });

  it('after the extra turn the order resumes after Liu Shan, not after the extra seat (Review Focus 4)', () => {
    let s = h.choose(h.select(h.use(entering()), 'a1'), 'seat-c');
    expect(s.turn.ownerSeatId).toBe('seat-c');
    s = h.act(s, { kind: 'EndPhaseAction', seatId: 'seat-c' });
    expect(s.turn.ownerSeatId).toBe('seat-b');
  });

  it('a face-down extra seat turns up and passes its turn; the order still resumes after Liu Shan', () => {
    const t = setup();
    const down = { ...t, seats: t.seats.map((x) => (x.id === 'seat-c' ? { ...x, faceDown: true as const } : x)) };
    const s = h.choose(h.select(h.use(h.settle(down)), 'a1'), 'seat-c');
    expect(s.turn.ownerSeatId).toBe('seat-b');
    expect(s.seats.find((x) => x.id === 'seat-c')!.faceDown).toBeUndefined();
  });

  it('with no hand cards he discards nothing but still gives the extra turn', () => {
    let s = h.use(entering({ 'seat-a:hand': [] }));
    expect(s.pendingSelection).toBeUndefined();
    expect(s.pendingChoice).toBeDefined();
    s = h.choose(s, 'seat-b');
    expect(s.turn.ownerSeatId).toBe('seat-b');
  });

  it('Don’t keeps his Play Phase, and nothing happens at his turn end', () => {
    const s = h.decline(entering());
    expect(s.phase).toBe('Play');
    expect(s.turn.flags?.['decentralization']).toBeUndefined();
  });
});

describe('Liu Shan — Seem Foolish', () => {
  it('is a Lord skill, so it is never in play', () => {
    expect(inPlay(table({}, { generals: at('seat-a', 'liu-shan') }), 'seat-a')).not.toContain('seem-foolish');
  });
});

describe('Jiang Wei — Instigate', () => {
  const play = (cards: Record<string, ReturnType<typeof card>[]> = {}, o: TableOptions = {}) =>
    table({ 'seat-a:hand': hand('a', 1), 'seat-b:hand': [card('bs', 'sha', 'spade'), card('bx', 'shan', 'heart', 3)], ...cards }, { generals: at('seat-a', 'jiang-wei'), ...o });

  it('picks a seat with him in its Slash range; it must Slash him', () => {
    let s = h.useSkill(play(), 'seat-a', 'instigate');
    expect(s.pendingSelection).toMatchObject({ of: 'seats', eligibleIds: ['seat-b', 'seat-d'], min: 1, max: 1 });
    s = h.select(s, 'seat-b');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['sha'] });
    s = h.respond(s, 'bs');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a' }); // Jiang Wei's Dodge window
  });

  it('if it does not, Jiang Wei discards one of its cards', () => {
    let s = h.pass(h.select(h.useSkill(play({ 'seat-b:equip': [card('w', 'crossbow', 'club')] }), 'seat-a', 'instigate'), 'seat-b'));
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', verb: 'discard' });
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['hand', 'w']);
    s = h.choose(s, 'w');
    expect(ids(s, 'discardPile')).toEqual(['w']);
  });

  it('once per turn, and not offered when no seat has him in range', () => {
    const s = h.pass(h.select(h.useSkill(play(), 'seat-a', 'instigate'), 'seat-b'));
    const done = h.choose(s, 'hand');
    expect(h.legal(done, 'seat-a').some((a) => a.kind === 'UseSkillAction' && a.owner.kind === 'general' && a.owner.skillId === 'instigate')).toBe(false);
    const far = table({}, { generals: at('seat-a', 'jiang-wei'), seats: 6, kingdoms: {} });
    // seat-d is 3 away from seat-a in a 6-seat ring: only its neighbours (seat-b, seat-f) have him in range 1.
    expect(h.useSkill(far, 'seat-a', 'instigate').pendingSelection!.eligibleIds).toEqual(['seat-b', 'seat-f']);
  });
});

describe('Jiang Wei — Follow the Master', () => {
  const turnStart = (o: TableOptions = {}) =>
    h.settle(table({ 'seat-a:hand': [], drawPile: hand('d', 4) }, { generals: at('seat-a', 'jiang-wei'), owner: 'seat-d', phase: 'End', hp: { 'seat-a': 3 }, ...o }));

  it('at the start of his turn with no hand: recover 1 HP or draw 2, then max HP −1 and Astrology is gained', () => {
    let s = turnStart();
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['recover', 'draw']);
    s = h.choose(s, 'recover');
    expect(s.seats[0]).toMatchObject({ combinedHp: 3, maxCombinedHp: 3 });
    expect(inPlay(s, 'seat-a')).toContain('astrology');
    expect(s.seats[0].marks?.['awakened:follow-the-master']).toBe(1);
  });

  it('the draw option draws 2', () => {
    const s = h.choose(turnStart(), 'draw');
    expect(handIds(s, 'seat-a')).toHaveLength(2);
  });

  it('at full HP only the draw is offered, and with a hand he does not awaken', () => {
    expect(turnStart({ hp: { 'seat-a': 4 } }).pendingChoice).toBeUndefined();
    expect(handIds(turnStart({ hp: { 'seat-a': 4 } }), 'seat-a')).toHaveLength(2);
    const held = h.settle(table({ 'seat-a:hand': hand('a', 1) }, { generals: at('seat-a', 'jiang-wei'), owner: 'seat-d', phase: 'End' }));
    expect(held.seats[0].maxCombinedHp).toBe(4);
  });

  it('awakens once: the next turn with an empty hand does nothing', () => {
    let s = h.choose(turnStart(), 'draw');
    s = h.settle({ ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, maxCombinedHp: 3 } : x)), zones: s.zones.map((z) => (z.id === 'seat-a:hand' ? { ...z, cards: [] } : z)), turn: { ...s.turn, ownerSeatId: 'seat-d' }, phase: 'End' });
    expect(askedAbout(s)).toBe('astrology'); // the gained skill is asked; no awakening choice
    expect(s.seats[0].maxCombinedHp).toBe(3);
  });

  it('is off while Jiang Wei is hidden', () => {
    expect(turnStart({ generals: at('seat-a', 'jiang-wei', 'filler-xu-huang', false) }).seats[0].maxCombinedHp).toBe(4);
  });
});
