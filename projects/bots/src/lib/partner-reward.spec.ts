import type { GameState, PendingChoice } from 'engine';
import { act, decide, picked, table } from './testing';

// The Synergistic Partners reward: recover 1 HP when damaged, otherwise draw 2 cards.
describe('ruleBasedPolicy: the partner reward', () => {
  const reward = (s: GameState, recoverDisabled: boolean): GameState => {
    const choice: PendingChoice = {
      id: 'partner-reward', seatId: 'seat-a', verb: 'pick', reason: { kind: 'partner-reward' },
      options: [
        { id: 'recover', shows: { kind: 'label', text: 'Recover 1 HP' }, effects: [], ...(recoverDisabled ? { disabled: true as const } : {}) },
        { id: 'draw', shows: { kind: 'label', text: 'Draw 2 Cards' }, effects: [] },
      ],
    };
    return { ...s, pendingChoice: choice };
  };

  it('a damaged bot recovers 1 HP', () => {
    expect(picked(decide(reward(table({}, { hp: { 'seat-a': 3 } }), false)))).toBe('recover');
  });

  it('a bot at full HP draws 2 cards', () => {
    expect(picked(decide(reward(table(), true)))).toBe('draw');
  });

  it('a damaged bot recovers whatever order the options come in', () => {
    const s = reward(table({}, { hp: { 'seat-a': 3 } }), false);
    const reversed = { ...s, pendingChoice: { ...s.pendingChoice!, options: [...s.pendingChoice!.options].reverse() } };
    expect(picked(decide(reversed))).toBe('recover');
  });

  it('what the bot picks resolves without error', () => {
    const s = reward(table({}, { hp: { 'seat-a': 3 } }), false);
    expect(() => act(s, decide(s))).not.toThrow();
  });
});
