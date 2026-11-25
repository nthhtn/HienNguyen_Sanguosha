import { buildContentRegistry } from 'content';
import { getActiveSeatId, getLegalActions } from 'engine';
import { act } from '../../scenario-kit/recipe';
import { ALLEGIANCE_LESSON } from './allegiance';

const registry = buildContentRegistry();

describe('the Allegiance lesson start', () => {
  const state = ALLEGIANCE_LESSON.build(registry);
  const beginner = state.seats[0];

  it('opens on the beginner’s Start window, a real pending decision, with both Generals face down', () => {
    expect(state.phase).toBe('Start');
    expect(state.turn.startWindow).toBe(true);
    expect(getActiveSeatId(state)).toBe('seat-0');
    expect(getLegalActions(state, 'seat-0', registry).map((a) => a.kind)).toEqual(['ConfirmRevealsAction']);
    expect(beginner.generals?.main.revealed).toBe(false);
    expect(beginner.generals?.deputy.revealed).toBe(false);
  });

  it('gives the beginner Cao Cao (Wei) as Main General, so revealing shows the Wei Force', () => {
    expect(beginner.generals?.main.generalDefinitionId).toBe('kingdomWars:cao-cao');
    const confirm = getLegalActions(state, 'seat-0', registry)[0];
    const after = act(state, registry, { ...confirm, slots: ['main'] } as typeof confirm);
    const seat = after.seats[0];
    expect(seat.generals?.main.revealed).toBe(true);
    expect(seat.kingdom).toBe('Wei');
  });

  it('keeps every bot’s Generals face down', () => {
    for (const bot of state.seats.slice(1)) expect(bot.generals?.main.revealed).toBe(false);
  });

  it('asks for the Main General to be revealed in the Start window, and for nothing else there', () => {
    const reveal = ALLEGIANCE_LESSON.steps.find((s) => s.id === 'reveal-main')!;
    expect(reveal.completes.kind).toBe('action');
    expect(reveal.target).toBe('reveal-dialog');
  });
});
