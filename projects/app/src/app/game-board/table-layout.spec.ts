import { fitTable, seatPlacements, TABLE_RADIUS_X, TABLE_RADIUS_Y, TILE_HEIGHT, TILE_WIDTH } from './table-layout';

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

describe('fitTable', () => {
  // Every tile's box, in px, for a table of this size.
  const boxes = (width: number, height: number, n: number) => {
    const fit = fitTable(width, height, n);
    return seatPlacements(seats(n), 'seat-0', fit).map((p) => {
      const w = TILE_WIDTH * fit.scale;
      const h = TILE_HEIGHT * fit.scale;
      const x = (p.x / 100) * width;
      const y = (p.y / 100) * height;
      return { left: x - w / 2, right: x + w / 2, top: y - h / 2, bottom: y + h / 2 };
    });
  };

  it('keeps tiles full size on a table with room to spare', () => {
    expect(fitTable(2400, 1400, 4).scale).toBe(1);
  });

  it('shrinks tiles on a short table, and further for a crowded one', () => {
    const roomy = fitTable(1200, 560, 5).scale;
    expect(roomy).toBeLessThan(1);
    expect(fitTable(1200, 560, 8).scale).toBeLessThanOrEqual(roomy);
  });

  it.each([
    [1280, 520, 8],
    [1000, 480, 6],
    [1600, 700, 4],
    [900, 600, 8],
    [600, 500, 4],
  ])('keeps every tile inside a %ix%i table with %i seats, clear of the others', (width, height, n) => {
    const all = boxes(width, height, n);
    for (const box of all) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.top).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
      expect(box.bottom).toBeLessThanOrEqual(height);
      for (const other of all) {
        if (other === box) continue;
        const apart = box.right <= other.left || other.right <= box.left || box.bottom <= other.top || other.bottom <= box.top;
        expect(apart).toBe(true);
      }
    }
  });

  it('falls back to the smallest scale when nothing fits', () => {
    expect(fitTable(300, 200, 8).scale).toBe(0.25);
  });

  it('leaves room in the centre between the top and bottom tiles, and the side ones', () => {
    const fit = fitTable(1280, 520, 8);
    expect(fit.centreHeight).toBeGreaterThanOrEqual(130);
    expect(fit.centreWidth).toBeGreaterThanOrEqual(240);
    const [viewer, , right, , top, , left] = boxes(1280, 520, 8);
    expect(viewer.top - top.bottom).toBeGreaterThanOrEqual(fit.centreHeight);
    expect(right.left - left.right).toBeGreaterThanOrEqual(fit.centreWidth);
  });
});
