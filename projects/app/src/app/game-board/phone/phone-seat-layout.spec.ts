import { phoneSeats, phoneSizes, SLIM_BELOW, SLIM_MIN } from './phone-seat-layout';
import { testSeat, testSeats } from './phone.testing';

const ids = (seats: { id: string }[]) => seats.map((s) => s.id);

describe('phoneSeats', () => {
  it.each([
    [2, 0, 1],
    [4, 0, 3],
    [8, 0, 7],
    [9, 1, 6],
    [10, 2, 5],
    [11, 2, 6],
    [12, 2, 7],
  ])('puts %i seats as %i on each side and %i on top', (count, side, top) => {
    const placed = phoneSeats(testSeats(count), 'seat-0');
    expect(placed.left).toHaveLength(side);
    expect(placed.right).toHaveLength(side);
    expect(placed.top).toHaveLength(top);
  });

  it('runs turn order up the right, along the top from right to left, and down the left', () => {
    const placed = phoneSeats(testSeats(12), 'seat-0');
    expect(ids(placed.right)).toEqual(['seat-2', 'seat-1']);
    expect(ids(placed.top)).toEqual(['seat-9', 'seat-8', 'seat-7', 'seat-6', 'seat-5', 'seat-4', 'seat-3']);
    expect(ids(placed.left)).toEqual(['seat-10', 'seat-11']);
  });

  it('starts turn order from the viewer, wherever they sit', () => {
    const placed = phoneSeats(testSeats(5), 'seat-3');
    expect(ids(placed.top)).toEqual(['seat-2', 'seat-1', 'seat-0', 'seat-4']);
  });

  it('shows every seat on top when there is no viewer', () => {
    expect(ids(phoneSeats(testSeats(4), null).top)).toEqual(['seat-3', 'seat-2', 'seat-1', 'seat-0']);
  });

  it('keeps an eliminated seat in its place', () => {
    const seats = testSeats(5).map((s) => (s.id === 'seat-2' ? testSeat('seat-2', 2, { eliminated: true }) : s));
    expect(ids(phoneSeats(seats, 'seat-0').top)).toEqual(['seat-4', 'seat-3', 'seat-2', 'seat-1']);
  });
});

describe('phoneSizes', () => {
  it('gives full tiles to 8 seats on the reference phone', () => {
    const sizes = phoneSizes(915, 412, phoneSeats(testSeats(8), 'seat-0'));
    expect(sizes.topTileWidth).toBeGreaterThanOrEqual(SLIM_BELOW);
    expect(sizes.slim).toBe(false);
    expect(sizes.bottomHeight).toBe(124);
    expect(sizes.tileHeight).toBeLessThanOrEqual(110);
  });

  it.each([
    [915, 412],
    [780, 360],
    [760, 340],
  ])('gives slim tiles, never under the minimum, to 12 seats at %i x %i', (width, height) => {
    const sizes = phoneSizes(width, height, phoneSeats(testSeats(12), 'seat-0'));
    expect(sizes.slim).toBe(true);
    expect(sizes.topTileWidth).toBeGreaterThanOrEqual(SLIM_MIN);
    expect(sizes.sideWidth).toBe(sizes.topTileWidth);
  });

  it('keeps the bottom row at 104 px on the smallest window', () => {
    expect(phoneSizes(760, 340, phoneSeats(testSeats(4), 'seat-0')).bottomHeight).toBe(104);
  });
});
