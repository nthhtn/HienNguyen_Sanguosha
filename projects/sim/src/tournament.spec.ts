import type { GameState } from 'engine';
import { formatReport, interval, runTournament, scoreGame, sideOf, Side } from './tournament';

// Just enough of a finished game for scoring: seats with kingdoms, and a result.
const finished = (winners: string[]): GameState =>
  ({
    seats: [
      { id: 'seat-0', kingdom: 'Wei' }, { id: 'seat-1', kingdom: 'Shu' },
      { id: 'seat-2', kingdom: 'Wei' }, { id: 'seat-3', kingdom: 'Wu' },
    ],
    result: { endedAt: 0, winningSeatIds: winners, losingSeatIds: [] },
  }) as unknown as GameState;
const unfinished = { seats: [], result: null } as unknown as GameState;
const evenSeatsChallenge = (seatId: string): Side => (Number(seatId.slice(-1)) % 2 === 0 ? 'challenger' : 'baseline');

describe('sideOf', () => {
  it('alternates by seat and flips every game', () => {
    expect([0, 1, 2, 3].map((k) => sideOf(0, k))).toEqual(['challenger', 'baseline', 'challenger', 'baseline']);
    expect([0, 1, 2, 3].map((k) => sideOf(1, k))).toEqual(['baseline', 'challenger', 'baseline', 'challenger']);
  });

  it('gives each side each seat equally often over two games', () => {
    for (let k = 0; k < 4; k++) {
      const sides = [sideOf(0, k), sideOf(1, k)];
      expect(sides).toContain('challenger');
      expect(sides).toContain('baseline');
    }
  });
});

describe('scoreGame', () => {
  it('counts a win for each winning seat on the side that played it', () => {
    const score = scoreGame(finished(['seat-0', 'seat-1']), evenSeatsChallenge);
    expect(score.finished).toBe(true);
    expect(score.seats).toEqual({ challenger: 2, baseline: 2 });
    expect(score.wins).toEqual({ challenger: 1, baseline: 1 });
    expect(score.byKingdom.challenger['Wei']).toEqual({ seats: 2, wins: 1 });
    expect(score.byKingdom.baseline['Shu']).toEqual({ seats: 1, wins: 1 });
  });

  it('reports a game with no result as unfinished, with no wins', () => {
    const score = scoreGame(unfinished, evenSeatsChallenge);
    expect(score.finished).toBe(false);
    expect(score.wins).toEqual({ challenger: 0, baseline: 0 });
  });
});

describe('interval', () => {
  it('is the mean with a 95% margin of 1.96 standard errors', () => {
    const r = interval([1, 0, 1, 0]);
    expect(r.mean).toBeCloseTo(0.5);
    expect(r.games).toBe(4);
    const se = Math.sqrt(((0.5 ** 2) * 4) / 3) / 2; // sample sd / sqrt(n)
    expect(r.low).toBeCloseTo(0.5 - 1.96 * se);
    expect(r.high).toBeCloseTo(0.5 + 1.96 * se);
  });

  it('has no NaN for no games or one game', () => {
    expect(interval([])).toEqual({ mean: 0, low: 0, high: 0, games: 0 });
    expect(interval([0.5])).toEqual({ mean: 0.5, low: 0.5, high: 0.5, games: 1 });
  });
});

describe('runTournament', () => {
  const config = { games: 4, seats: 4, challenger: 'rule-based', baseline: 'rule-based-v1', firstSeed: 1 } as const;

  it('is deterministic for the same configuration', () => {
    expect(runTournament(config)).toEqual(runTournament(config));
  });

  it('rejects an odd seat count, which cannot be paired fairly', () => {
    expect(() => runTournament({ ...config, seats: 3 })).toThrow(/even number of seats/);
  });

  it('counts a game cut off by the action cap as unfinished, not as a win or loss', () => {
    const report = runTournament({ ...config, games: 2, maxActions: 1 });
    expect(report.unfinished).toBe(2);
    expect(report.finished).toBe(0);
    expect(report.challenger.wins + report.baseline.wins).toBe(0);
    expect(formatReport(report)).not.toMatch(/NaN|Infinity/);
  });

  it('works with no games and with two seats', () => {
    expect(formatReport(runTournament({ ...config, games: 0 }))).not.toMatch(/NaN|Infinity/);
    const duel = runTournament({ ...config, games: 2, seats: 2 });
    expect(duel.finished + duel.unfinished).toBe(2);
    expect(duel.challenger.seats + duel.baseline.seats).toBe(duel.finished * 2);
  });

  it('plays equal numbers of challenger and baseline seats', () => {
    const report = runTournament(config);
    expect(report.challenger.seats).toBe(report.baseline.seats);
  });
});
