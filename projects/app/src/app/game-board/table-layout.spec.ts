import { seatPlacements, TABLE_RADIUS_X, TABLE_RADIUS_Y } from './table-layout';

const seats = (n: number) => Array.from({ length: n }, (_, index) => ({ id: `seat-${index}`, index }));

describe('seatPlacements', () => {
  it('puts the viewer at the bottom centre of the table', () => {
    const [viewer] = seatPlacements(seats(4), 'seat-2');
    expect(viewer.seat.id).toBe('seat-2');
    expect(viewer.isViewer).toBe(true);
    expect(viewer.x).toBeCloseTo(50);
    expect(viewer.y).toBeCloseTo(50 + TABLE_RADIUS_Y);
  });

  it('continues in seat order from the viewer, next seat on the viewer’s right', () => {
    const placements = seatPlacements(seats(4), 'seat-2');
    expect(placements.map((p) => p.seat.id)).toEqual(['seat-2', 'seat-3', 'seat-0', 'seat-1']);
    const [, right, top, left] = placements;
    expect(right.x).toBeCloseTo(50 + TABLE_RADIUS_X);
    expect(right.y).toBeCloseTo(50);
    expect(top.x).toBeCloseTo(50);
    expect(top.y).toBeCloseTo(50 - TABLE_RADIUS_Y);
    expect(left.x).toBeCloseTo(50 - TABLE_RADIUS_X);
    expect(left.isViewer).toBe(false);
  });

  it('seats the only opponent of a 2-seat table opposite the viewer', () => {
    const [, opponent] = seatPlacements(seats(2), 'seat-0');
    expect(opponent.x).toBeCloseTo(50);
    expect(opponent.y).toBeCloseTo(50 - TABLE_RADIUS_Y);
  });

  it('spaces every seat evenly by direction from the table centre', () => {
    const placements = seatPlacements(seats(5), 'seat-0');
    const angles = placements.map((p) => Math.atan2(p.y - 50, p.x - 50));
    for (let i = 1; i < angles.length; i++) {
      const step = (angles[i - 1] - angles[i] + 2 * Math.PI) % (2 * Math.PI);
      expect(step).toBeCloseTo((2 * Math.PI) / 5);
    }
  });

  it('places every seat on the rim of the rectangular table', () => {
    for (const n of [2, 3, 4, 5]) {
      for (const p of seatPlacements(seats(n), 'seat-0')) {
        const onSide = Math.abs(Math.abs(p.x - 50) - TABLE_RADIUS_X) < 1e-9;
        const onEnd = Math.abs(Math.abs(p.y - 50) - TABLE_RADIUS_Y) < 1e-9;
        expect(onSide || onEnd).toBe(true);
        expect(Math.abs(p.x - 50)).toBeLessThanOrEqual(TABLE_RADIUS_X + 1e-9);
        expect(Math.abs(p.y - 50)).toBeLessThanOrEqual(TABLE_RADIUS_Y + 1e-9);
      }
    }
  });

  it('orders by seat index, not by the input array order', () => {
    const shuffled = [seats(3)[2], seats(3)[0], seats(3)[1]];
    expect(seatPlacements(shuffled, 'seat-0').map((p) => p.seat.id)).toEqual(['seat-0', 'seat-1', 'seat-2']);
  });

  it('throws for a viewer who is not at the table', () => {
    expect(() => seatPlacements(seats(3), 'seat-9')).toThrow(/seat-9/);
  });
});
