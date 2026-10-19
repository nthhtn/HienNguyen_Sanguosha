import type { ContentRegistry, GameState } from 'engine';
import { createRng } from 'engine';
import { shaLimit } from './queries';

// A General whose compulsory skill lifts the Slash limit (a Roar-like modifier).
const registry: ContentRegistry = {
  cards: new Map(),
  generals: new Map([
    ['roarer', { id: 'roarer', kingdom: 'Shu', maxHp: 4, skills: [{ id: 'roar-test', compulsory: true, modifiers: { shaLimit: Infinity } }] }],
    ['plain', { id: 'plain', kingdom: 'Shu', maxHp: 4, skills: [] }],
  ]),
};

function table(revealed: boolean): GameState {
  return {
    seats: [{
      id: 'a', index: 0, kingdom: 'Shu', combinedHp: 4, maxCombinedHp: 4, eliminated: false,
      generals: { main: { generalDefinitionId: 'roarer', revealed }, deputy: { generalDefinitionId: 'plain', revealed: false } },
      hand: { zoneId: 'a:hand' }, equipped: { zoneId: 'a:equip' }, judgment: { zoneId: 'a:judgment' },
    }],
    players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [{ id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] }, { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] }],
    pendingResponse: null, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}

describe('active abilities from Generals', () => {
  it('a revealed General’s modifier applies', () => {
    expect(shaLimit(table(true), 'a', registry)).toBe(Infinity);
  });

  it('a hidden General’s compulsory modifier doesn’t', () => {
    expect(shaLimit(table(false), 'a', registry)).toBe(1);
  });
});
