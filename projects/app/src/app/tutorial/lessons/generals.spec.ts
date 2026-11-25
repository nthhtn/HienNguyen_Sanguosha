import { buildContentRegistry } from 'content';
import { getActiveSeatId } from 'engine';
import { GENERALS_LESSON } from './generals';

describe('the Your Generals lesson start', () => {
  const state = GENERALS_LESSON.build(buildContentRegistry());
  const beginner = state.seats[0];

  it('opens in the beginner’s Play Phase', () => {
    expect(state.phase).toBe('Play');
    expect(getActiveSeatId(state)).toBe('seat-0');
  });

  it('shows the HP the lesson text works out: Cao Cao 4 + Guo Jia 3, half rounded down, is 3', () => {
    expect(beginner.generals?.main).toEqual({ generalDefinitionId: 'kingdomWars:cao-cao', revealed: true });
    expect(beginner.generals?.deputy).toEqual({ generalDefinitionId: 'kingdomWars:guo-jia', revealed: true });
    expect(beginner.combinedHp).toBe(3);
    expect(beginner.maxCombinedHp).toBe(3);
  });

  it('leaves the bots’ Generals face down', () => {
    for (const bot of state.seats.slice(1)) {
      expect(bot.generals?.main.revealed).toBe(false);
      expect(bot.generals?.deputy.revealed).toBe(false);
    }
  });
});
