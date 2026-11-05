import { buildContentRegistry } from 'content';
import { getActiveSeatId } from 'engine';
import { BoardScenario } from '../scenario';
import { SCENARIOS, findScenario } from './index';

const registry = buildContentRegistry();
const boards = SCENARIOS.filter((s): s is BoardScenario => s.kind === 'board');

describe('dev scenarios', () => {
  it('every scenario id is unique', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('findScenario finds by id and is undefined for an unknown id', () => {
    expect(findScenario(SCENARIOS[0].id)).toBe(SCENARIOS[0]);
    expect(findScenario('no-such-scenario')).toBeUndefined();
  });

  it.each(boards.map((s) => [s.id, s] as const))('%s builds and reaches its window', (id, scenario) => {
    const state = scenario.build(registry);
    expect({ id, reached: scenario.reaches(state) }).toEqual({ id, reached: true });
  });

  it.each(boards.map((s) => [s.id, s] as const))('%s builds the same state every time (Reset repeats it)', (_id, scenario) => {
    expect(JSON.stringify(scenario.build(registry))).toEqual(JSON.stringify(scenario.build(registry)));
  });

  it.each(boards.map((s) => [s.id, s] as const))('%s leaves no bot move due unless it says so', (id, scenario) => {
    const state = scenario.build(registry);
    const active = getActiveSeatId(state);
    const botDue = active !== null && state.players.find((p) => p.seatId === active)?.kind === 'bot';
    expect({ id, botDue }).toEqual({ id, botDue: scenario.botDue === true });
  });

  it('Play Board has its four scenarios', () => {
    const ids = SCENARIOS.filter((s) => s.group === 'Play Board').map((s) => s.id);
    expect(ids).toEqual(['play-own-turn', 'play-other-turn', 'play-equipment', 'play-six-seats']);
  });
});
