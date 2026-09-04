import { runGame } from './runGame';
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
