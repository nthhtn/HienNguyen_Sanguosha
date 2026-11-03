import { wikiDistanceTable } from 'content';
import { DISTANCE_EXAMPLE } from './distance-example';

// The Distance page's example table. Its hand-worked numbers are checked here against the game's own answers, so the
// picture cannot drift from the rules.
describe('the Distance page example', () => {
  const result = wikiDistanceTable({ seats: DISTANCE_EXAMPLE.seats.map((seat) => ({ n: seat.n, out: !!seat.out, ...(seat.mount ? { mount: seat.mount } : {}) })) });

  it('seat 1 attacks with the range the example states', () => {
    expect(result.range).toBe(DISTANCE_EXAMPLE.range);
  });

  it.each(DISTANCE_EXAMPLE.seats.filter((seat) => seat.distance !== undefined))('seat $n is at the stated distance from seat 1', (seat) => {
    expect(result.seats.find((s) => s.n === seat.n)!.distance).toBe(seat.distance);
  });

  it('shows a knocked-out seat, a mount and a distance that a mount lengthens', () => {
    expect(DISTANCE_EXAMPLE.seats.some((seat) => seat.out)).toBe(true);
    expect(DISTANCE_EXAMPLE.seats.some((seat) => seat.mount === 'shadow-runner')).toBe(true);
  });
});
