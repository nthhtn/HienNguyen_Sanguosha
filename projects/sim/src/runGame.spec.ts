import { BotKind, parseBotKind, runGame } from './runGame';
import { createGame } from 'engine';
import { buildContentRegistry, kingdomWarMode } from 'content';

describe('runGame', () => {
  it('drives a Kingdom War game to a terminal GameResult using the random-legal-move bot', () => {
    const registry = buildContentRegistry();
    const initialState = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b'], 123);
    const { finalState, actionsSubmitted } = runGame(initialState, { registry, mode: kingdomWarMode }, 456);
    expect(finalState.result).not.toBeNull();
    expect(actionsSubmitted).toBeGreaterThan(0);
  });
});

describe('runGame with rule-based bots', () => {
  it('drives a game to a result using the rule-based policy for every seat', () => {
    const registry = buildContentRegistry();
    const initialState = createGame(kingdomWarMode, registry, ['seat-a', 'seat-b', 'seat-c'], 123);
    const { finalState } = runGame(initialState, { registry, mode: kingdomWarMode }, 456, 20000, 'rule-based');
    expect(finalState.result).not.toBeNull();
  });
});

describe('runGame with a policy per seat', () => {
  it('asks policyFor for each acting seat and finishes the game', () => {
    const registry = buildContentRegistry();
    const seatIds = ['seat-0', 'seat-1', 'seat-2', 'seat-3'];
    const initialState = createGame(kingdomWarMode, registry, seatIds, 123);
    const used = new Set<BotKind>();
    const policyFor = (seatId: string): BotKind => {
      const kind: BotKind = seatIds.indexOf(seatId) % 2 === 0 ? 'rule-based' : 'rule-based-v1';
      used.add(kind);
      return kind;
    };
    const { finalState } = runGame(initialState, { registry, mode: kingdomWarMode }, 456, 20000, 'random', undefined, policyFor);
    expect(finalState.result).not.toBeNull();
    expect([...used].sort()).toEqual(['rule-based', 'rule-based-v1']);
  });

  it('can mix the random picker with a rule-based policy', () => {
    const registry = buildContentRegistry();
    const initialState = createGame(kingdomWarMode, registry, ['seat-0', 'seat-1'], 7);
    const policyFor = (seatId: string): BotKind => (seatId === 'seat-0' ? 'random' : 'rule-based');
    const { actionsSubmitted } = runGame(initialState, { registry, mode: kingdomWarMode }, 7, 20000, 'random', undefined, policyFor);
    expect(actionsSubmitted).toBeGreaterThan(0);
  });
});

describe('parseBotKind', () => {
  it('accepts every bot kind', () => {
    expect(parseBotKind('random')).toBe('random');
    expect(parseBotKind('rule-based')).toBe('rule-based');
    expect(parseBotKind('rule-based-v1')).toBe('rule-based-v1');
    expect(parseBotKind('rule-based-cards')).toBe('rule-based-cards');
  });

  it('names the valid kinds when the text is unknown', () => {
    expect(() => parseBotKind('smart')).toThrow(/Unknown bot "smart".*random, rule-based, rule-based-v1/);
  });
});
