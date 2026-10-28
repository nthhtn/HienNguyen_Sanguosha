import { BotKind, parseBotKind, runGame } from './runGame';
import { createGame } from 'engine';
import { buildContentRegistry, guozhanMode } from 'content';

describe('runGame', () => {
  it('drives a Guozhan game to a terminal GameResult using the random-legal-move bot', () => {
    const registry = buildContentRegistry();
    const initialState = createGame(guozhanMode, registry, ['seat-a', 'seat-b'], 123);
    const { finalState, actionsSubmitted } = runGame(initialState, { registry, mode: guozhanMode }, 456);
    expect(finalState.result).not.toBeNull();
    expect(actionsSubmitted).toBeGreaterThan(0);
  });
});

describe('runGame with rule-based bots', () => {
  it('drives a game to a result using the rule-based policy for every seat', () => {
    const registry = buildContentRegistry();
    const initialState = createGame(guozhanMode, registry, ['seat-a', 'seat-b', 'seat-c'], 123);
    const { finalState } = runGame(initialState, { registry, mode: guozhanMode }, 456, 20000, 'rule-based');
    expect(finalState.result).not.toBeNull();
  });
});

describe('runGame with a policy per seat', () => {
  it('asks policyFor for each acting seat and finishes the game', () => {
    const registry = buildContentRegistry();
    const seatIds = ['seat-0', 'seat-1', 'seat-2', 'seat-3'];
    const initialState = createGame(guozhanMode, registry, seatIds, 123);
    const used = new Set<BotKind>();
    const policyFor = (seatId: string): BotKind => {
      const kind: BotKind = seatIds.indexOf(seatId) % 2 === 0 ? 'rule-based' : 'rule-based-v1';
      used.add(kind);
      return kind;
    };
    const { finalState } = runGame(initialState, { registry, mode: guozhanMode }, 456, 20000, 'random', undefined, policyFor);
    expect(finalState.result).not.toBeNull();
    expect([...used].sort()).toEqual(['rule-based', 'rule-based-v1']);
  });

  it('can mix the random picker with a rule-based policy', () => {
    const registry = buildContentRegistry();
    const initialState = createGame(guozhanMode, registry, ['seat-0', 'seat-1'], 7);
    const policyFor = (seatId: string): BotKind => (seatId === 'seat-0' ? 'random' : 'rule-based');
    const { actionsSubmitted } = runGame(initialState, { registry, mode: guozhanMode }, 7, 20000, 'random', undefined, policyFor);
    expect(actionsSubmitted).toBeGreaterThan(0);
  });
});

describe('runGame with the judgment notice', () => {
  const registry = buildContentRegistry();

  it.each<BotKind>(['random', 'rule-based'])('%s bots finish games with judgmentNotice on, over 10 seeds, leaving no judgment view', (kind) => {
    for (let seed = 1; seed <= 10; seed++) {
      const initialState = createGame(guozhanMode, registry, ['seat-a', 'seat-b', 'seat-c', 'seat-d'], seed, { judgmentNotice: true });
      const { finalState } = runGame(initialState, { registry, mode: guozhanMode }, seed, 20000, kind);
      expect({ seed, finished: finalState.result !== null }).toEqual({ seed, finished: true });
      expect(finalState).not.toHaveProperty('judgmentView');
    }
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

describe('runGame with the Kingdom Wars deck', () => {
  it('plays a four-seat game to a result with rule-based bots', () => {
    const registry = buildContentRegistry();
    const initialState = createGame(guozhanMode, registry, ['seat-0', 'seat-1', 'seat-2', 'seat-3'], 123, { deck: 'kingdomWars' });
    const { finalState } = runGame(initialState, { registry, mode: guozhanMode }, 456, 20000, 'rule-based');
    expect(finalState.rules?.deck).toBe('kingdomWars');
    expect(finalState.result).not.toBeNull();
  });
});
