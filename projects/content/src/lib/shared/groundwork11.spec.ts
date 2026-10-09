import { createGame } from 'engine';
import type { SkillDefinition } from 'engine';
import { buildContentRegistry } from '../registry';
import { kingdomWarMode } from '../modes/kingdomWar';
import { awakenedKey, isAwakened } from './awaken';
import { farmCount, stashZoneOf } from './farm';
import { formSkillOptions } from './forms';
import { seatGender } from './gender';
import { seatDistance } from './queries';
import { card, harness, kwMode, registry, table, ids } from '../generals/skills.testing';

const h = harness();
const hk = harness(kwMode);

describe('awakened marks', () => {
  it('isAwakened reads the seat mark awakenedKey names', () => {
    const s = table();
    expect(isAwakened(s, 'seat-a', 'x')).toBe(false);
    const marked = { ...s, seats: s.seats.map((x) => (x.id === 'seat-a' ? { ...x, marks: { [awakenedKey('x')]: 1 } } : x)) };
    expect(isAwakened(marked, 'seat-a', 'x')).toBe(true);
  });
});

describe('Farms', () => {
  it('count the cards in the stash, and a seat with none counts 0', () => {
    const s = table({ 'seat-a:stash': [card('f1', 'sha'), card('f2', 'shan')] });
    expect(stashZoneOf(s, 'seat-a')?.cards).toHaveLength(2);
    expect(farmCount(s, 'seat-a')).toBe(2);
    expect(farmCount(s, 'seat-b')).toBe(0);
  });
});

describe('distanceToOthersFrom', () => {
  it('a skill’s state-based bonus lowers the owner’s distance, never below 1', () => {
    const probe: SkillDefinition = { id: 'probe', modifiers: { distanceToOthersFrom: () => -1 } };
    const custom = { ...registry, generals: new Map(registry.generals).set('probe-g', { id: 'probe-g', kingdom: 'Wei' as const, maxHp: 4, skills: [probe] }) };
    const s = table({}, { generals: { 'seat-a': ['probe-g', 'filler-xu-huang'] }, seats: 6 });
    const base = seatDistance(table({}, { seats: 6 }), 'seat-a', 'seat-c', registry); // 2
    expect(seatDistance(s, 'seat-a', 'seat-c', custom)).toBe(base - 1);
    expect(seatDistance(s, 'seat-a', 'seat-b', custom)).toBe(1);
  });
});

describe('seatGender and a chosen Form', () => {
  it('follows the Form chosen by the shown General’s slot; a hidden holder keeps its own', () => {
    const base = table({}, { generals: { 'seat-a': ['filler-zuo-ci', 'filler-xu-huang'] } });
    const withForm = (revealed: boolean) => ({
      ...base,
      seats: base.seats.map((x) =>
        x.id === 'seat-a'
          ? { ...x, forms: { slot: 'main' as const, held: ['cai-wenji'], chosen: { generalId: 'cai-wenji', skillId: 'lament' } }, generals: { main: { generalDefinitionId: 'filler-zuo-ci', revealed }, deputy: { generalDefinitionId: 'filler-xu-huang', revealed: !revealed } } }
          : x
      ),
    });
    expect(seatGender(withForm(true), 'seat-a', registry)).toBe('female'); // Cai Wenji's
    expect(seatGender(withForm(false), 'seat-a', registry)).toBe('male'); // the Deputy's
  });
});

describe('formSkillOptions', () => {
  it('lists each held General’s skills, leaving out Lord, awakening and limited skills and the chosen one', () => {
    const lord: SkillDefinition = { id: 'l', lord: true };
    const awake: SkillDefinition = { id: 'a', awakening: true };
    const once: SkillDefinition = { id: 'o', limited: true };
    const free: SkillDefinition = { id: 'f' };
    const generals = new Map(registry.generals).set('multi', { id: 'multi', kingdom: 'Wei' as const, maxHp: 3, skills: [lord, awake, once, free, { id: 'g2' }] });
    const custom = { ...registry, generals };
    const s = { ...table(), seats: table().seats.map((x) => (x.id === 'seat-a' ? { ...x, forms: { slot: 'main' as const, held: ['multi'], chosen: { generalId: 'multi', skillId: 'g2' } } } : x)) };
    expect(formSkillOptions(s, 'seat-a', custom)).toEqual([{ generalId: 'multi', skillId: 'f' }]);
  });
});

describe('Kingdom War setup', () => {
  const real = buildContentRegistry();
  const game = createGame(kingdomWarMode, real, ['seat-0', 'seat-1', 'seat-2'], 7);

  it('every seat has a stash zone, and the spare pool is exactly the Generals nobody was dealt', () => {
    expect(game.seats.every((s) => s.stash?.zoneId === `${s.id}:stash`)).toBe(true);
    expect(game.zones.filter((z) => z.id.endsWith(':stash'))).toHaveLength(3);
    const dealt = Object.values(game.generalSelection!.candidates).flat();
    // (a General that deals spare Generals is never one of them)
    const undealt = [...real.generals.keys()].filter((id) => !dealt.includes(id) && !real.generals.get(id)!.skills.some((s) => s.spareGenerals)).sort();
    expect([...game.spareGenerals!].sort()).toEqual(undealt);
    expect(new Set(game.spareGenerals).size).toBe(game.spareGenerals!.length);
  });
});

describe('Kingdom War: the killer and the stash', () => {
  it('a seat killed by damage is eliminated with the damage source as its killer', () => {
    let s = table({ 'seat-b:stash': [card('f1', 'sha')] }, { hp: { 'seat-b': 1 }, kingdoms: { 'seat-b': 'Qun' } });
    s = hk.run(s, [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: 'seat-a' }, target: { kind: 'seat', seatId: 'seat-b' }, amount: 1, nature: 'normal' } }]);
    for (let i = 0; i < 4 && s.pendingResponse; i++) s = hk.pass(s);
    expect(s.seats.find((x) => x.id === 'seat-b')!.eliminated).toBe(true);
    expect(s.log).toContainEqual({ kind: 'SeatEliminatedEvent', seatId: 'seat-b', killerSeatId: 'seat-a' });
    expect(ids(s, 'seat-b:stash')).toEqual([]); // the stash is discarded with the rest
  });
});
