import type { Action, GameState } from 'engine';
import { recordDecision } from './usage';
import type { UsageTally } from './usage';

const state = (extra: object = {}): GameState =>
  ({
    zones: [{ cards: [{ instanceId: 'a', definitionId: 'sha' }, { instanceId: 'b', definitionId: 'sha' }] }],
    pendingChoice: null,
    ...extra,
  }) as unknown as GameState;
const play = (id: string) => ({ kind: 'PlayCardAction', seatId: 's', cardInstanceId: id, targets: [] }) as Action;

describe('recordDecision', () => {
  it('counts a card once per decision however many copies are offered, and a play as used', () => {
    const tally: UsageTally = {};
    recordDecision(tally, state(), [play('a'), play('b')], play('a'));
    expect(tally['card:sha']).toEqual({ offered: 1, used: 1 });
  });

  it('counts an offered card that is not chosen as offered only', () => {
    const tally: UsageTally = {};
    recordDecision(tally, state(), [play('a')], { kind: 'EndPhaseAction', seatId: 's' });
    expect(tally['card:sha']).toEqual({ offered: 1, used: 0 });
  });

  it('counts a declined ability ask as offered, not used, and an accepted one as both', () => {
    const pending = { pendingChoice: { verb: 'use', reason: { kind: 'ability', abilityId: 'x' } } };
    const tally: UsageTally = {};
    recordDecision(tally, state(pending), [], { kind: 'ChooseOptionAction', seatId: 's', choiceId: 'c', optionId: 'decline' });
    expect(tally['ability:x']).toEqual({ offered: 1, used: 0 });
    recordDecision(tally, state(pending), [], { kind: 'ChooseOptionAction', seatId: 's', choiceId: 'c', optionId: 'use' });
    expect(tally['ability:x']).toEqual({ offered: 2, used: 1 });
  });

  it('counts a skill taken as used', () => {
    const skill = { kind: 'UseSkillAction', seatId: 's', owner: { kind: 'general', skillId: 'y' } } as unknown as Action;
    const tally: UsageTally = {};
    recordDecision(tally, state(), [skill, { kind: 'EndPhaseAction', seatId: 's' }], skill);
    expect(tally['skill:y']).toEqual({ offered: 1, used: 1 });
  });
});
