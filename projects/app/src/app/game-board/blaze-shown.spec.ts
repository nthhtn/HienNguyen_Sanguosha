import { CardInstance, GameState } from 'engine';
import { blazeShownCard } from './blaze-shown';

const shown: CardInstance = { instanceId: 'h5', definitionId: 'sha', suit: 'heart', rank: 5 };
const other: CardInstance = { instanceId: 's9', definitionId: 'shan', suit: 'spade', rank: 9 };
const state = (step: string, log: unknown[]): GameState =>
  ({
    log,
    pendingSelection: { id: 'blaze-hit-1', seatId: 'seat-0', then: { kind: 'card-step', step: { kind: 'CardStepEffect', step, target: { kind: 'seat', seatId: 'seat-1' } } } },
  }) as unknown as GameState;

describe('blazeShownCard', () => {
  it('finds the card the target showed, for the "discard a card of the same suit" selection', () => {
    const log = [{ kind: 'CardShownEvent', seatId: 'seat-1', card: other, abilityId: 'compete' }, { kind: 'CardShownEvent', seatId: 'seat-1', card: shown, abilityId: 'blaze' }];
    expect(blazeShownCard(state('blaze-hit', log))).toEqual({ card: shown, seatId: 'seat-1' });
  });

  it('uses the latest Blaze showing', () => {
    const log = [{ kind: 'CardShownEvent', seatId: 'seat-1', card: other, abilityId: 'blaze' }, { kind: 'CardShownEvent', seatId: 'seat-1', card: shown, abilityId: 'blaze' }];
    expect(blazeShownCard(state('blaze-hit', log))?.card).toBe(shown);
  });

  it('is null for another selection, or when nothing was shown', () => {
    expect(blazeShownCard(state('blaze-shown', [{ kind: 'CardShownEvent', seatId: 'seat-1', card: shown, abilityId: 'blaze' }]))).toBeNull();
    expect(blazeShownCard(state('blaze-hit', []))).toBeNull();
    expect(blazeShownCard({ log: [], pendingSelection: null } as unknown as GameState)).toBeNull();
  });
});
