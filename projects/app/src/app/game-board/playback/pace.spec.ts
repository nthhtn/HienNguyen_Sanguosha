import { CAP_MS, paceFactor } from './pace';

describe('paceFactor', () => {
  it('Instant is Infinity whatever the queue', () => {
    expect(paceFactor(20000, Infinity, { catchUp: true })).toBe(Infinity);
  });

  it('without catch-up, the speed factor alone', () => {
    expect(paceFactor(200000, 0.5, { catchUp: false })).toBe(0.5);
  });

  it('a queue over CAP_MS is sped up to fit it', () => {
    expect(paceFactor(60000, 1, { catchUp: true })).toBe(60000 / CAP_MS);
    expect(paceFactor(3000, 1, { catchUp: true })).toBe(1);
  });

  it('a long batch the server paced is not sped up at Slow', () => {
    // 12 beats of 900 ms and a gap: 11150 ms at Normal, 22300 ms at Slow.
    expect(paceFactor(11150, 0.5, { catchUp: true })).toBe(0.5);
  });
});
