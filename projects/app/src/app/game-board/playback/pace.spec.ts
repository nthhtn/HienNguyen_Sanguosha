import { CAP_MS, RUSH_MS, paceFactor } from './pace';

describe('paceFactor', () => {
  it('Instant is Infinity whatever the queue', () => {
    expect(paceFactor(20000, Infinity, { catchUp: true, owesDecision: true })).toBe(Infinity);
  });

  it('without catch-up, the speed factor alone', () => {
    expect(paceFactor(20000, 0.5, { catchUp: false, owesDecision: true })).toBe(0.5);
  });

  it('owing a decision rushes the queue into RUSH_MS', () => {
    expect(paceFactor(4850, 1, { catchUp: true, owesDecision: true })).toBeCloseTo(4850 / RUSH_MS);
    // A short queue already finishes within RUSH_MS at the chosen speed.
    expect(paceFactor(500, 2, { catchUp: true, owesDecision: true })).toBe(2);
  });

  it('otherwise a queue over CAP_MS is sped up to fit it', () => {
    expect(paceFactor(8000, 1, { catchUp: true, owesDecision: false })).toBe(8000 / CAP_MS);
    expect(paceFactor(3000, 1, { catchUp: true, owesDecision: false })).toBe(1);
  });

  it('twelve 900 ms beats at Slow with catch-up are capped to CAP_MS', () => {
    expect(paceFactor(10800, 0.5, { catchUp: true, owesDecision: false })).toBe(2.7);
  });
});
