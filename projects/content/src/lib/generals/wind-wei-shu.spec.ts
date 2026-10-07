import type { GameState } from 'engine';
import { abilityLog, askedAbout, card, handIds, harness, hp, table, TableOptions } from './skills.testing';

const h = harness();
const at = (seatId: string, general: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [general, 'zhang-he', revealed] });
const pile = Array.from({ length: 6 }, (_, i) => card(`d${i + 1}`, 'shan', 'diamond', i + 1));

describe('Cao Ren — Entrench', () => {
  const ending = () => h.act(table({ drawPile: pile }, { generals: at('seat-a', 'cao-ren') }), { kind: 'EndPhaseAction', seatId: 'seat-a' });

  it('at the start of his End Phase, may turn face down and draw 3', () => {
    const s = ending();
    expect(askedAbout(s)).toBe('entrench');
    const used = h.use(s);
    expect(used.seats[0].faceDown).toBe(true);
    expect(handIds(used, 'seat-a')).toEqual(['d1', 'd2', 'd3']);
    expect(h.decline(s).seats[0].faceDown).toBeUndefined();
  });
});

describe('Xiahou Yuan — Godspeed', () => {
  // seat-d's turn ends; seat-a's begins.
  const turnStarts = (cards: Record<string, ReturnType<typeof card>[]> = {}) =>
    h.settle(table(cards, { generals: at('seat-a', 'xiahou-yuan'), owner: 'seat-d', phase: 'End' }));

  it('option 1: skips Judgment and Draw to use a Sha on any seat, ignoring distance, outside the Sha limit', () => {
    let s = turnStarts();
    expect(askedAbout(s)).toBe('godspeed');
    s = h.use(s);
    expect(s.pendingChoice?.options.map((o) => o.id)).toEqual(['seat-b', 'seat-c', 'seat-d']);
    s = h.choose(s, 'seat-c');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', allowedCardIds: ['shan'] });
    s = h.pass(s);
    expect(hp(s, 'seat-c')).toBe(3);
    expect(s.log.filter((e) => e.kind === 'PhaseSkippedEvent').map((e) => e.kind === 'PhaseSkippedEvent' && e.phase)).toEqual(['Judgment', 'Draw']);
    expect(s.turn.cardPlays).toBeUndefined();
    expect(s.phase).toBe('Play');
  });

  it('option 2: as the Play Phase begins, skips it and discards an Equipment card to use a Sha; the turn moves on', () => {
    let s = h.settle(table({ 'seat-a:hand': [card('cb', 'crossbow', 'diamond', 1)] }, { generals: at('seat-a', 'xiahou-yuan'), phase: 'Draw' }));
    expect(askedAbout(s)).toBe('godspeed');
    s = h.use(s);
    expect(s.pendingSelection?.eligibleIds).toEqual(['cb']);
    s = h.choose(h.select(s, 'cb'), 'seat-c');
    s = h.pass(s);
    expect(hp(s, 'seat-c')).toBe(3);
    expect(s.log.some((e) => e.kind === 'PhaseChangedEvent' && e.seatId === 'seat-a' && e.phase === 'Discard')).toBe(true);
    expect(s.turn.ownerSeatId).toBe('seat-b');
  });

  it('both options in one turn', () => {
    let s = turnStarts({ 'seat-a:hand': [card('cb', 'crossbow', 'diamond', 1)] });
    s = h.pass(h.choose(h.use(s), 'seat-b'));
    expect(askedAbout(s)).toBe('godspeed'); // the Play Phase's ask
  });
});

describe('Huang Zhong — Strong Bow', () => {
  const shot = (bHand: number) =>
    h.play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('n1', 'shan'), ...Array.from({ length: bHand - 1 }, (_, i) => card(`b${i}`, 'peach', 'heart'))] }, { generals: at('seat-a', 'huang-zhong') }), 's1', 'seat-b');

  it('when the target holds at least his HP in cards, may make the Sha unblockable', () => {
    let s = shot(4);
    expect(askedAbout(s)).toBe('strong-bow');
    s = h.use(s);
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(3);
    expect(abilityLog(s)).toEqual([expect.objectContaining({ abilityId: 'strong-bow', outcome: 'unblockable', targetSeatId: 'seat-b' })]);
  });

  it('or at most his attack range in cards; otherwise not asked', () => {
    expect(askedAbout(shot(1))).toBe('strong-bow');
    expect(askedAbout(shot(2))).toBeNull();
  });
});

describe('Wei Yan — Violent Spirit', () => {
  it('recovers 1 HP per point of damage he deals to a seat in his attack range', () => {
    const s = h.pass(h.play(table({ 'seat-a:hand': [card('s1', 'sha')] }, { generals: at('seat-a', 'wei-yan'), hp: { 'seat-a': 2 }, flags: { wine: true } }), 's1', 'seat-b'));
    expect(hp(s, 'seat-b')).toBe(2);
    expect(hp(s, 'seat-a')).toBe(4);
  });

  it('not for a seat outside his range', () => {
    const s = h.pass(h.play(table({ 'seat-a:hand': [card('du', 'duel', 'spade', 1)] }, { generals: at('seat-a', 'wei-yan'), hp: { 'seat-a': 2 } }), 'du', 'seat-c'));
    expect(hp(s, 'seat-c')).toBe(3);
    expect(hp(s, 'seat-a')).toBe(2);
  });
});
