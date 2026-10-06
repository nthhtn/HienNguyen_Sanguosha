import type { GameState } from 'engine';
import { buildContentRegistry } from '../registry';
import { seatGender } from './gender';

const registry = buildContentRegistry();
const withGenerals = (main: [string, boolean], deputy: [string, boolean]): GameState => ({
  seats: [{
    id: 'seat-a', index: 0, kingdom: 'Shu', eliminated: false, combinedHp: 3, maxCombinedHp: 3,
    generals: { main: { generalDefinitionId: main[0], revealed: main[1] }, deputy: { generalDefinitionId: deputy[0], revealed: deputy[1] } },
    hand: { zoneId: 'h' }, equipped: { zoneId: 'e' }, judgment: { zoneId: 'j' },
  }],
  players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play', zones: [],
  pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
});

describe('seatGender', () => {
  it('is the Main General’s while the Main is revealed', () => {
    expect(seatGender(withGenerals(['huang-yueying', true], ['cao-cao', true]), 'seat-a', registry)).toBe('female');
  });

  it('else the Deputy’s while that is revealed', () => {
    expect(seatGender(withGenerals(['huang-yueying', false], ['cao-cao', true]), 'seat-a', registry)).toBe('male');
  });

  it('is none with both hidden', () => {
    expect(seatGender(withGenerals(['huang-yueying', false], ['cao-cao', false]), 'seat-a', registry)).toBeNull();
  });
});
