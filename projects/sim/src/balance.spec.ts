import { compareBalance, runBalance } from './balance';
import type { BalanceGame, BalanceReport } from './balance';
import { interval } from './tournament';

const game = (seed: number, o: Partial<BalanceGame>): BalanceGame => ({ seed, winners: [], everLed: null, leaderWon: false, deaths: 0, hpLost: 0, ...o });
const report = (games: BalanceGame[]): BalanceReport => ({ config: { games: games.length, seats: 6, policy: 'x' }, games, perForce: {}, leaderWonRate: interval([]) });

describe('balance runs', () => {
  it('plays every seed, tallies forces, and repeats exactly', () => {
    const config = { games: 4, seats: 6, policy: 'rule-based-v4', firstSeed: 0 };
    const first = runBalance(config);
    expect(first.games.map((g) => g.seed)).toEqual([0, 1, 2, 3]);
    expect(Object.values(first.perForce).reduce((n, t) => n + t.seats, 0)).toBe(24);
    for (const g of first.games) {
      expect(g.winners.length).toBeGreaterThan(0);
      expect(g.deaths).toBeGreaterThan(0);
      expect(g.hpLost).toBeGreaterThan(0);
    }
    expect(runBalance(config)).toEqual(first);
  });

  it('records everLed from the leading force and counts a leader win', () => {
    for (const policy of ['rule-based-v4', 'rule-based-table']) {
      const r = runBalance({ games: 12, seats: 6, policy, firstSeed: 0 });
      const led = r.games.filter((g) => g.everLed !== null);
      expect(led.length).toBeGreaterThan(0);
      expect(r.leaderWonRate.games).toBe(led.length);
      for (const g of r.games) expect(g.leaderWon).toBe(g.everLed !== null && g.winners.includes(g.everLed));
    }
  });
});

describe('compareBalance', () => {
  it('pairs by seed and skips seeds where either run had no leader for the leader rate', () => {
    const a = report([game(0, { everLed: 'Wei', leaderWon: true, deaths: 4, hpLost: 10 }), game(1, { everLed: 'Wu', leaderWon: true, deaths: 3, hpLost: 8 })]);
    const b = report([game(0, { everLed: 'Wei', leaderWon: false, deaths: 2, hpLost: 6 }), game(1, { deaths: 3, hpLost: 12 })]);
    const c = compareBalance(a, b);
    expect(c.leaderWonDiff).toMatchObject({ mean: 1, games: 1 });
    expect(c.deathsDiff.mean).toBe(1);
    expect(c.hpLostDiff.mean).toBe(0);
    expect(c.deathsDiff.games).toBe(2);
  });
});
