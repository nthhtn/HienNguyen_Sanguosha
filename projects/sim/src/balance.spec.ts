import { compareBalance, formatBalanceReport, runBalance, wastedIn } from './balance';
import type { BalanceGame, BalanceReport } from './balance';
import type { GameEvent, GameState } from 'engine';
import { interval } from './tournament';

const game = (seed: number, o: Partial<BalanceGame>): BalanceGame => ({ seed, winners: [], everLed: null, leaderWon: false, deaths: 0, hpLost: 0, wasted: 0, ...o });
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
    for (const policy of ['rule-based-v4', 'rule-based']) {
      const r = runBalance({ games: 12, seats: 6, policy, firstSeed: 0 });
      const led = r.games.filter((g) => g.everLed !== null);
      expect(led.length).toBeGreaterThan(0);
      expect(r.leaderWonRate.games).toBe(led.length);
      for (const g of r.games) expect(g.leaderWon).toBe(g.everLed !== null && g.winners.includes(g.everLed));
    }
  });
});

const stateWith = (log: unknown[]): GameState => ({ log } as unknown as GameState);
const answer = (seatId: string, cardInstanceId: string): GameEvent =>
  ({ kind: 'CardPlayedEvent', seatId, card: {}, targets: [], inResponseTo: { cardInstanceId } } as unknown as GameEvent);
const hit = (seatId: string, cardInstanceId: string): GameEvent =>
  ({ kind: 'DamageDealtEvent', damage: { source: null, target: { kind: 'seat', seatId }, amount: 1, nature: 'normal', cause: { cardInstanceId } } } as unknown as GameEvent);

describe('wastedIn', () => {
  it('counts a no-effect ability use', () => {
    expect(wastedIn(stateWith([{ kind: 'AbilityUsedEvent', owner: {}, abilityId: 'x', outcome: 'no-effect' }, { kind: 'AbilityUsedEvent', owner: {}, abilityId: 'x', outcome: 'ok' }]))).toBe(1);
  });
  it('counts an answer followed by damage from the answered card on the same seat', () => {
    expect(wastedIn(stateWith([answer('seat-1', 'c1'), hit('seat-1', 'c1')]))).toBe(1);
  });
  it('does not count an answer that held', () => {
    expect(wastedIn(stateWith([answer('seat-1', 'c1')]))).toBe(0);
  });
  it('does not count damage from another card, on another seat, or before the answer', () => {
    expect(wastedIn(stateWith([answer('seat-1', 'c1'), hit('seat-1', 'c2')]))).toBe(0);
    expect(wastedIn(stateWith([answer('seat-1', 'c1'), hit('seat-2', 'c1')]))).toBe(0);
    expect(wastedIn(stateWith([hit('seat-1', 'c1'), answer('seat-1', 'c1')]))).toBe(0);
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
    expect(c.wastedDiff.games).toBe(2);
    expect(c.deathsDiff.games).toBe(2);
  });
});

describe('formatBalanceReport', () => {
  it('sums every per-seat Ambitionist entry into one Ambitionist row', () => {
    const r = { ...report([]), perForce: { Wei: { seats: 10, wins: 5 }, 'ambitionist:seat-0': { seats: 4, wins: 1 }, 'ambitionist:seat-3': { seats: 6, wins: 2 } } };
    const text = formatBalanceReport(r);
    expect(text).toContain('Ambitionist 30.0%');
    expect(text).toContain('Wei 50.0%');
    expect(text).not.toContain('ambitionist:');
    expect(r.perForce['ambitionist:seat-0']).toEqual({ seats: 4, wins: 1 });
  });
});
