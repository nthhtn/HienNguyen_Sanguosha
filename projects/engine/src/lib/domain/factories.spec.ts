import { createSeat, createPlayer } from './factories';

describe('domain factories', () => {
  it('creates a seat with combined HP from both generals and both hidden', () => {
    const maxHp = (id: string) => (id === 'main-general' ? 4 : 3);
    const seat = createSeat('seat-1', 0, 'Wei', 'main-general', 'deputy-general', maxHp);

    expect(seat.maxCombinedHp).toBe(7);
    expect(seat.combinedHp).toBe(7);
    expect(seat.generals!.main).toEqual({ generalDefinitionId: 'main-general', revealed: false });
    expect(seat.generals!.deputy).toEqual({ generalDefinitionId: 'deputy-general', revealed: false });
    expect(seat.eliminated).toBe(false);
  });

  it('creates a player bound to a seat', () => {
    const player = createPlayer('player-1', 'seat-1', 'bot');
    expect(player).toEqual({ id: 'player-1', seatId: 'seat-1', kind: 'bot' });
  });
});
