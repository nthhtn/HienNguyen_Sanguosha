import { GameState, Seat } from '../domain/types';
import { createRng } from '../rng/rng';
import { ContentRegistry, GameModeDefinition, SkillDefinition, SkillTrigger } from '../registry/types';
import { skillOf, skillsInPlay } from './generalSkills';
import { gatherTriggeredSkills } from './triggers';
import { conversionsOf } from '../rules/legality';

const onX = (): SkillTrigger => ({ point: 'after:X', condition: () => true, effect: () => [] });
const iron: SkillDefinition = { id: 'iron', compulsory: true, triggers: [onX()], modifiers: { shaLimit: 2 } };
const hint: SkillDefinition = { id: 'hint', triggers: [onX()] };
const crown: SkillDefinition = { id: 'crown', lord: true, triggers: [onX()] };
const forge: SkillDefinition = { id: 'forge', conversions: [{ id: 'forge', as: 'bolt', cards: 2, when: 'both' }] };
const registry: ContentRegistry = {
  cards: new Map(),
  generals: new Map([
    ['smith', { id: 'smith', kingdom: 'Wei', maxHp: 4, skills: [iron, hint, crown] }],
    ['seer', { id: 'seer', kingdom: 'Wei', maxHp: 3, skills: [forge] }],
  ]),
};
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };

function table(mainRevealed: boolean, deputyRevealed: boolean, eliminated = false): GameState {
  const seat: Seat = {
    id: 'a', index: 0, kingdom: 'Wei', combinedHp: 3, maxCombinedHp: 3, eliminated,
    generals: { main: { generalDefinitionId: 'smith', revealed: mainRevealed }, deputy: { generalDefinitionId: 'seer', revealed: deputyRevealed } },
    hand: { zoneId: 'a:hand' }, equipped: { zoneId: 'a:equip' }, judgment: { zoneId: 'a:judgment' },
  };
  return {
    seats: [seat], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [{ id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] }, { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}
const owner = (slot: 'main' | 'deputy', skillId: string) => ({ kind: 'general' as const, seatId: 'a', slot, skillId });

describe('skills in play', () => {
  it('a revealed General: every skill but a Lord skill, with no reveal needed', () => {
    expect(skillsInPlay(table(true, true), 'a', registry).map((s) => [s.owner, s.needsReveal])).toEqual([
      [owner('main', 'iron'), false],
      [owner('main', 'hint'), false],
      [owner('deputy', 'forge'), false],
    ]);
  });

  it('a hidden General: compulsory skills are off; the others need a reveal', () => {
    expect(skillsInPlay(table(false, false), 'a', registry).map((s) => [s.owner.skillId, s.needsReveal])).toEqual([
      ['hint', true],
      ['forge', true],
    ]);
  });

  it('a Lord skill is never in play, and an eliminated seat has none', () => {
    expect(skillsInPlay(table(true, true), 'a', registry).some((s) => s.skill.lord)).toBe(false);
    expect(skillsInPlay(table(true, true, true), 'a', registry)).toEqual([]);
  });

  it('skillOf finds a skill by its owner, hidden or not', () => {
    expect(skillOf(table(false, false), owner('main', 'iron'), registry)).toBe(iron);
    expect(skillOf(table(false, false), owner('main', 'nope'), registry)).toBeUndefined();
  });

  it('gathers triggers from skills in play only, marking those that need a reveal', () => {
    const hidden = gatherTriggeredSkills(table(false, true), registry, mode, 'after:X', {});
    expect(hidden.map((g) => [g.owner, g.needsReveal])).toEqual([[owner('main', 'hint'), true]]);
    const shown = gatherTriggeredSkills(table(true, true), registry, mode, 'after:X', {});
    expect(shown.map((g) => [g.owner, g.needsReveal])).toEqual([[owner('main', 'iron'), undefined], [owner('main', 'hint'), undefined]]);
  });

  it('a General’s conversions are the seat’s, marked when they need a reveal', () => {
    expect(conversionsOf(table(true, false), 'a', registry)).toEqual([
      { owner: owner('deputy', 'forge'), abilityId: 'forge', conversion: forge.conversions![0], needsReveal: true },
    ]);
    expect(conversionsOf(table(true, true), 'a', registry)[0]).not.toHaveProperty('needsReveal');
  });
});
