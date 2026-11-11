import type { Action } from 'engine';
import { ruleBasedV5Policy } from './rule-based';
import { card, decideWaste, decideWith, table } from './testing';

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
