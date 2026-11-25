import { buildContentRegistry } from 'content';
import { cardsOverHandLimit, getActiveSeatId, getLegalActions } from 'engine';
import { act } from '../../scenario-kit/recipe';
import { TURN_LESSON } from './turn';

const registry = buildContentRegistry();

describe('the Turn Structure lesson start', () => {
  const state = TURN_LESSON.build(registry);

  it('opens with the seat before the beginner about to end its Play Phase, so the beginner’s whole turn is seen', () => {
    expect(state.phase).toBe('Play');
    expect(getActiveSeatId(state)).toBe('seat-3');
    expect(getLegalActions(state, 'seat-3', registry).some((a) => a.kind === 'EndPhaseAction')).toBe(true);
  });

  it('has both of the beginner’s Generals face up, so no Start window opens for them', () => {
    expect(state.seats[0].generals?.main.revealed).toBe(true);
    expect(state.seats[0].generals?.deputy.revealed).toBe(true);
  });

  it('lets the engine pass the beginner’s Start, Judgment and Draw phases and wait in the Play Phase', () => {
    const ended = act(state, registry, { kind: 'EndPhaseAction', seatId: 'seat-3' });
    expect(ended.phase).toBe('Play');
    expect(getActiveSeatId(ended)).toBe('seat-0');
    expect(ended.turn.turnNumber).toBe(state.turn.turnNumber + 1);
  });

  it('leaves the beginner more cards than HP once the Draw Phase has given 2, so the Discard Phase has work', () => {
    const ended = act(state, registry, { kind: 'EndPhaseAction', seatId: 'seat-3' });
    expect(cardsOverHandLimit(ended, 'seat-0')).toBeGreaterThan(0);
  });

  it('asks for the discard in the Discard window, which the step spotlights whole', () => {
    expect(TURN_LESSON.steps.find((s) => s.id === 'discard')!.target).toBe('discard-dialog');
  });
});
