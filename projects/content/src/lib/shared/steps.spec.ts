import type { ContentRegistry, GameState } from 'engine';
import { createRng } from 'engine';
import { atStep, cardStep } from './steps';

const registry: ContentRegistry = { cards: new Map(), generals: new Map() };
const owner = { kind: 'equipment' as const, seatId: 'a', cardInstanceId: 'w' };
const step = cardStep('sha-armor', { as: 'sha', colour: 'black', physical: [] }, 'a', { kind: 'seat', seatId: 'b' });

function table(bEliminated: boolean): GameState {
  const seat = (id: string, index: number, eliminated: boolean) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated, generals: null,
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0, false), seat('b', 1, bEliminated)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] },
    phase: 'Play', zones: [], pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('atStep', () => {
  const trigger = atStep(['sha-armor'], { effect: () => [] });

  it('acts at a named step on a living target', () => {
    expect(trigger.condition(table(false), step, owner, registry)).toBe(true);
  });

  it('never acts on an eliminated target (stage 5 follow-up)', () => {
    expect(trigger.condition(table(true), step, owner, registry)).toBe(false);
  });
});
