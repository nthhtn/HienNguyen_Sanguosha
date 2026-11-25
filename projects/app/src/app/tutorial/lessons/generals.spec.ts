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

describe('the Your Generals lesson on the phone board', () => {
  const textOf = (id: string) => GENERALS_LESSON.steps.find((s) => s.id === id)!;

  it('words the steps whose desktop wording does not fit the phone board', () => {
    // A tap on the seat opens Seat Details, and the Discard Pile and Action History sit under History.
    for (const id of ['general-details', 'discard-pile', 'action-history']) {
      expect([id, textOf(id).phone?.textKey]).toEqual([id, expect.stringMatching(/^tutorial\.generals\.s[356]p$/)]);
    }
  });

  it('keeps the desktop wording where the phone board matches', () => {
    for (const id of ['two-generals', 'shared-hp', 'hand']) expect(textOf(id).phone).toBeUndefined();
  });
});
