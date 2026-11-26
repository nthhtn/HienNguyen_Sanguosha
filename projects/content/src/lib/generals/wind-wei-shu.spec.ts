import { abilityLog, askedAbout, card, handIds, harness, hp, table, TableOptions } from './skills.testing';
import { generalTextData } from '../display';

const h = harness();
const at = (seatId: string, general: string, revealed = true): TableOptions['generals'] => ({ [seatId]: [general, 'filler-zhang-he', revealed] });
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

  it('option 1: skips Judgment and Draw to use a Slash on any seat, ignoring distance, outside the Slash limit', () => {
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

  it('option 2: as the Play Phase begins, skips it and discards an Equipment card to use a Slash; the turn moves on', () => {
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

  it('when the target holds at least his HP in cards, may make the Slash unblockable', () => {
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
  it('recovers 1 HP per point of damage he deals to a seat at distance 1', () => {
    const s = h.pass(h.play(table({ 'seat-a:hand': [card('s1', 'sha')] }, { generals: at('seat-a', 'wei-yan'), hp: { 'seat-a': 2 }, flags: { wine: true } }), 's1', 'seat-b'));
    expect(hp(s, 'seat-b')).toBe(2);
    expect(hp(s, 'seat-a')).toBe(4);
  });

  it('not for a seat at distance 2, even when a weapon could reach it', () => {
    const armed = h.pass(h.play(
      table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('gdb', 'green-dragon-blade', 'spade', 5)] }, { generals: at('seat-a', 'wei-yan'), hp: { 'seat-a': 2 } }),
      's1',
      'seat-c',
    ));
    expect(hp(armed, 'seat-c')).toBe(3);
    expect(hp(armed, 'seat-a')).toBe(2);
    const far = h.pass(h.play(table({ 'seat-a:hand': [card('du', 'duel', 'spade', 1)] }, { generals: at('seat-a', 'wei-yan'), hp: { 'seat-a': 2 } }), 'du', 'seat-c'));
    expect(hp(far, 'seat-c')).toBe(3);
    expect(hp(far, 'seat-a')).toBe(2);
  });

  it('does heal a seat a -1 horse brings to distance 1', () => {
    const s = h.pass(h.play(
      table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('rh', 'red-hare', 'heart', 5)] }, { generals: at('seat-a', 'wei-yan'), hp: { 'seat-a': 2 } }),
      's1',
      'seat-c',
    ));
    expect(hp(s, 'seat-c')).toBe(3);
    expect(hp(s, 'seat-a')).toBe(3);
  });

  it('the skill text says distance 1, one HP per point of damage', () => {
    expect(generalTextData('wei-yan')!.skills[0].text).toBe('For each unit of damage that Wei Yan causes to a player at distance 1, he regains one unit of health.');
    expect(generalTextData('wei-yan', 'vi')!.skills[0].text).toBe('Với mỗi sát thương Ngụy Diên gây ra cho một người chơi ở khoảng cách 1, ông hồi một Sinh lực.');
  });
});
