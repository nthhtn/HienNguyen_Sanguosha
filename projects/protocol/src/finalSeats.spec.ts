import type { Seat } from 'engine';
import { finalSeatViews } from './public-api';

function seat(over: Partial<Seat> & { main?: string; deputy?: string }): Seat {
  const { main, deputy, ...rest } = over;
  return {
    id: 'seat-0',
    kingdom: 'Wei',
    generals: main === undefined ? null : { main: { generalDefinitionId: main, revealed: true }, deputy: { generalDefinitionId: deputy ?? 'x', revealed: true } },
    eliminated: false,
    ...rest,
  } as unknown as Seat;
}

describe('finalSeatViews', () => {
  it('maps allegiance, Kingdom, Generals and eliminated in seat order', () => {
    const views = finalSeatViews({
      seats: [
        seat({ id: 'seat-0', kingdom: 'Wei', allegiance: 'kingdom', main: 'cao-cao', deputy: 'xu-chu' }),
        seat({ id: 'seat-1', kingdom: 'Wu', allegiance: 'ambitionist', main: 'sun-quan', deputy: 'lu-meng', eliminated: true }),
      ],
    });
    expect(views).toEqual([
      { seatId: 'seat-0', kingdom: 'Wei', allegiance: 'kingdom', mainGeneralId: 'cao-cao', deputyGeneralId: 'xu-chu', eliminated: false },
      { seatId: 'seat-1', kingdom: 'Wu', allegiance: 'ambitionist', mainGeneralId: 'sun-quan', deputyGeneralId: 'lu-meng', eliminated: true },
    ]);
  });

  it('reads an undecided allegiance as null', () => {
    expect(finalSeatViews({ seats: [seat({ main: 'cao-cao' })] })[0].allegiance).toBeNull();
  });

  it('reads a hidden or missing General as null', () => {
    const [hidden, missing] = finalSeatViews({ seats: [seat({ id: 'a', main: 'hidden', deputy: 'hidden' }), seat({ id: 'b' })] });
    expect([hidden.mainGeneralId, hidden.deputyGeneralId]).toEqual([null, null]);
    expect([missing.mainGeneralId, missing.deputyGeneralId]).toEqual([null, null]);
  });
});
