import { buildContentRegistry } from 'content';
import { GameState, getActiveSeatId } from 'engine';
import { SHA_SHAN_LESSON } from './sha-shan';

const registry = buildContentRegistry();
const handOf = (state: GameState, seatId: string) => state.zones.find((z) => z.id === `${seatId}:hand`)!.cards.map((c) => c.definitionId);

describe('the Sha and Shan lesson start', () => {
  const state = SHA_SHAN_LESSON.build(registry);

  it('opens in the beginner’s Play Phase holding exactly Sha, Shan and Peach', () => {
    expect(state.phase).toBe('Play');
    expect(getActiveSeatId(state)).toBe('seat-0');
    expect([...handOf(state, 'seat-0')].sort()).toEqual(['peach', 'sha', 'shan']);
  });

  it('gives the seat next to the beginner a Shan to answer with and a Sha to attack with', () => {
    expect(handOf(state, 'seat-1')).toEqual(expect.arrayContaining(['shan', 'sha']));
    expect(handOf(state, 'seat-1')).toHaveLength(2);
  });

  it('keeps the beginner’s HP at 3 with both Generals face up', () => {
    expect(state.seats[0].combinedHp).toBe(3);
    expect(state.seats[0].generals?.main.revealed).toBe(true);
    expect(state.seats[0].generals?.deputy.revealed).toBe(true);
  });

  it('spotlights the card on a computer and its Play button on the phone, and the menu’s seat in both, for the attack', () => {
    const attack = SHA_SHAN_LESSON.steps.find((s) => s.id === 'play-sha')!;
    expect(attack.target).toEqual(['target-seat:seat-1', 'hand-card:sha']);
    expect(attack.phone?.target).toEqual(['target-seat:seat-1', 'play-button:sha', 'hand-card:sha']);
  });

  it('spotlights the whole response window for the beginner’s own answer', () => {
    expect(SHA_SHAN_LESSON.steps.find((s) => s.id === 'answer')!.target).toBe('response-dialog');
  });
});
