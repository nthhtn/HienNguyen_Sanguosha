import { buildContentRegistry } from 'content';
import { GameState, getActiveSeatId, getLegalActions } from 'engine';
import { act } from '../../scenario-kit/recipe';
import { DAMAGE_LESSON } from './damage';
import { definitionOf, handOf } from './lesson-kit';

const registry = buildContentRegistry();
const pass = (state: GameState) => getLegalActions(state, 'seat-0', registry).find((a) => a.kind === 'PassAction')!;

describe('the Damage and Recovery lesson start', () => {
  const state = DAMAGE_LESSON.build(registry);

  it('opens on a Sha from the seat before the beginner that the beginner cannot answer, so the response window can only pass', () => {
    expect(state.pendingResponse?.respondingSeatId).toBe('seat-0');
    const kinds = getLegalActions(state, 'seat-0', registry).map((a) => a.kind);
    expect(kinds).toContain('PassAction');
    expect(kinds).not.toContain('RespondAction');
    expect(handOf(state, 'seat-0')).toEqual(['peach']);
  });

  it('starts at full HP, so the Sha takes 1 and the Peach gives it back', () => {
    const seat = state.seats[0];
    expect(seat.combinedHp).toBe(seat.maxCombinedHp);
    const hit = act(state, registry, pass(state));
    expect(hit.seats[0].combinedHp).toBe(seat.maxCombinedHp - 1);
    // A Peach is played in the beginner's own Play Phase, so the attacker's turn has to end first.
    expect(getLegalActions(hit, 'seat-0', registry).some((a) => a.kind === 'PlayCardAction')).toBe(false);
    const turn = act(hit, registry, { kind: 'EndPhaseAction', seatId: 'seat-3' });
    expect(getActiveSeatId(turn)).toBe('seat-0');
    const peach = getLegalActions(turn, 'seat-0', registry).find((a) => a.kind === 'PlayCardAction' && definitionOf(turn, a.cardInstanceId) === 'peach');
    expect(peach).toBeDefined();
    expect(act(turn, registry, peach!).seats[0].combinedHp).toBe(seat.maxCombinedHp);
  });

  it('leaves nothing pending but the hit: the Generals have no skill that asks on damage', () => {
    const hit = act(state, registry, pass(state));
    expect(hit.pendingChoice).toBeUndefined();
    expect(hit.pendingResponse).toBeNull();
    expect(hit.phase).toBe('Play');
  });
});
