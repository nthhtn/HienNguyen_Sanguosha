import { getLegalActions, redactStateForSeat } from 'engine';
import type { Action } from 'engine';
import { tableRank } from './table-rank';
import { withoutWaste } from './waste';
import { ruleBasedV5Policy } from './rule-based';
import { card, decideWaste, decideWith, registry, table } from './testing';

const targetsOf = (a: Action) => ('targets' in a ? a.targets.map((t) => (t.kind === 'seat' ? t.seatId : '')) : []);
const shield = [card('bs', 'black-shield', 'club', 2)];
const lu = (revealed: boolean) => ({ 'seat-b': ['kingdomWars:lu-xun', 'filler-dong-zhuo', revealed] as [string, string, boolean] });
const liuShan = { 'seat-b': ['liu-shan', 'filler-dong-zhuo', true] as [string, string, boolean] };
// Everyone else is an ally of seat-a, so seat-b is the only foe.
const alone = { 'seat-c': 'Wei', 'seat-d': 'Wei' } as const;

describe('waste: a visible stop (A1)', () => {
  const sha = () => table({ 'seat-a:hand': [card('s1', 'sha', 'spade')], 'seat-b:equip': shield }, { hp: { 'seat-b': 1 } });
  it('drops a black Sha on a Black Shield wearer and plays it on another seat', () => {
    const a = decideWaste(sha());
    expect(a).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 's1' });
    expect(targetsOf(a)).not.toContain('seat-b');
  });
  it('ends the phase when the only target is stopped', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha', 'spade')], 'seat-b:equip': shield }, { kingdoms: alone });
    expect(decideWaste(s).kind).toBe('EndPhaseAction');
  });
  it('the switch off still plays the Sha on the wearer', () => {
    const s = table({ 'seat-a:hand': [card('s1', 'sha', 'spade')], 'seat-b:equip': shield }, { kingdoms: alone });
    expect(decideWith(ruleBasedV5Policy, s)).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 's1', targets: [{ kind: 'seat', seatId: 'seat-b' }] });
  });
  it('drops Steal on a revealed Lu Xun, keeps it on a hidden one', () => {
    const steal = (revealed: boolean) => table({ 'seat-a:hand': [card('t1', 'steal', 'spade')], 'seat-b:hand': [card('x', 'sha')] }, { generals: lu(revealed), kingdoms: alone });
    expect(decideWaste(steal(true)).kind).toBe('EndPhaseAction');
    expect(decideWaste(steal(false))).toMatchObject({ kind: 'PlayCardAction', cardInstanceId: 't1' });
  });
});

describe('waste: Pleasure (A1, B2)', () => {
  const hand = (...defs: string[]) => ({ 'seat-a:hand': defs.map((d, i) => card(`c${i}`, d, 'spade', i + 1)) });
  it('a Sha with no other Basic card is dropped', () => {
    expect(decideWaste(table(hand('sha'), { generals: liuShan, kingdoms: alone })).kind).toBe('EndPhaseAction');
  });
  it('is dropped while a foe ranked higher is cost-free', () => {
    const s = table(hand('sha', 'sha', 'shan'), { generals: liuShan, kingdoms: { 'seat-c': 'Wei' }, hp: { 'seat-d': 1 } });
    const a = decideWaste(s);
    expect(a).toMatchObject({ kind: 'PlayCardAction' });
    expect(targetsOf(a)).toEqual(['seat-d']);
  });
  it('is kept when Liu Shan is the only foe and a Shan stays', () => {
    const a = decideWaste(table(hand('sha', 'sha', 'shan'), { generals: liuShan, kingdoms: alone }));
    expect(targetsOf(a)).toEqual(['seat-b']);
  });
  it('is dropped when paying spends the last Shan, unless he is at 1 HP', () => {
    expect(decideWaste(table(hand('sha', 'shan'), { generals: liuShan, kingdoms: alone, hp: { 'seat-b': 2 } })).kind).toBe('EndPhaseAction');
    expect(targetsOf(decideWaste(table(hand('sha', 'shan'), { generals: liuShan, kingdoms: alone, hp: { 'seat-b': 1 } })))).toEqual(['seat-b']);
  });
});

describe('waste: rivals and fixed target lists', () => {
  const hand = { 'seat-a:hand': ['sha', 'sha', 'shan'].map((d, i) => card(`c${i}`, d, 'spade', i + 1)) };
  it('an adjacent low-HP ally is not a cost-free rival to Liu Shan (B2a)', () => {
    // seat-d (adjacent to seat-a) is an ally at 1 HP; Liu Shan is the only foe.
    const s = table(hand, { generals: liuShan, kingdoms: { 'seat-c': 'Wei', 'seat-d': 'Wei' }, hp: { 'seat-d': 1 } });
    expect(targetsOf(decideWaste(s))).toEqual(['seat-b']);
  });

  // Coerce is offered as fixed [holder, victim] pairs; only the holder is aimed at.
  const coerceFrom = (holder: string, victim: string, generals: Record<string, [string, string, boolean]>) => {
    const s = table({ 'seat-a:hand': [card('co', 'coerce', 'spade')], [`${holder}:equip`]: [card('w', 'axe', 'club')] }, { generals });
    const view = redactStateForSeat(s, 'seat-a');
    const legal = getLegalActions(s, 'seat-a', registry).filter((a) => a.kind === 'PlayCardAction' && a.cardInstanceId === 'co' && targetsOf(a)[0] === holder && targetsOf(a)[1] === victim);
    const rank = tableRank.forRegistry(registry);
    return { legal, kept: withoutWaste(view, view.seats[0], legal, registry, rank) };
  };
  it('keeps a Coerce pair unchanged when only the victim has a stopping skill', () => {
    const { legal, kept } = coerceFrom('seat-b', 'seat-c', { 'seat-c': ['kingdomWars:jia-xu', 'filler-dong-zhuo', true] });
    expect(legal.length).toBeGreaterThan(0);
    expect(kept).toEqual(legal);
  });
  it('drops a Coerce whose holder is stopped (Behind the Curtain: black Tool)', () => {
    const { legal, kept } = coerceFrom('seat-b', 'seat-c', { 'seat-b': ['kingdomWars:jia-xu', 'filler-dong-zhuo', true] });
    expect(legal.length).toBeGreaterThan(0);
    expect(kept).toEqual([]);
  });
});
