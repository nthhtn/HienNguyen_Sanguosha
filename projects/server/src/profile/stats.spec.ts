import { ProfileGameRow } from '../persistence/records';
import { computeProfile, seatOutcome } from './stats';

const T0 = Date.UTC(2026, 10, 1);
let counter = 0;
// A row finished `n` minutes after T0; later n is newer.
const row = (n: number, overrides: Partial<ProfileGameRow> = {}): ProfileGameRow => ({
  gameId: `game-${n}-${(counter += 1)}`,
  seatId: 'seat-1',
  userId: 'user-1',
  mainGeneralId: 'cao-cao',
  deputyGeneralId: 'zhang-liao',
  kingdom: 'Wei',
  allegiance: 'kingdom',
  eliminated: false,
  won: true,
  finishedAt: new Date(T0 + n * 60_000),
  visibility: 'open',
  ...overrides,
});
const profile = (rows: ProfileGameRow[], mode: 'all' | 'solo' | 'online' = 'all') => computeProfile({ displayName: 'Ann', memberSince: new Date(T0), rows, mode });

describe('computeProfile', () => {
  it('gives a null win rate and empty lists for an empty history', () => {
    expect(profile([])).toEqual({
      displayName: 'Ann',
      memberSince: T0,
      mode: 'all',
      totals: { games: 0, wins: 0, losses: 0, noOutcome: 0, winRate: null },
      byForce: [],
      topGenerals: [],
      form: [],
      streak: { current: 0, best: 0 },
    });
  });

  it('counts a game with no outcome in games and noOutcome but not in the win rate', () => {
    const { totals } = profile([row(1, { won: true }), row(2, { won: false }), row(3, { won: null })]);
    expect(totals).toEqual({ games: 3, wins: 1, losses: 1, noOutcome: 1, winRate: 0.5 });
  });

  it('computes the win rate as wins over wins plus losses', () => {
    expect(profile([row(1), row(2), row(3, { won: false })]).totals.winRate).toBeCloseTo(2 / 3);
  });

  it('counts an ambitionist seat only under ambitionist', () => {
    const { byForce } = profile([row(1, { kingdom: 'Qun', allegiance: 'ambitionist' }), row(2, { kingdom: 'Qun', allegiance: 'kingdom' })]);
    expect(byForce.map((f) => [f.force, f.games])).toEqual([
      ['Qun', 1],
      ['ambitionist', 1],
    ]);
  });

  it('leaves a hidden-Kingdom seat with no allegiance out of byForce but keeps it in totals', () => {
    const p = profile([row(1, { kingdom: 'hidden', allegiance: null, mainGeneralId: null, deputyGeneralId: null })]);
    expect(p.byForce).toEqual([]);
    expect(p.totals.games).toBe(1);
  });

  it('skips unrevealed Generals in topGenerals and counts the rest', () => {
    const p = profile([row(1, { mainGeneralId: null, deputyGeneralId: 'zhang-liao' })]);
    expect(p.topGenerals.map((g) => g.generalId)).toEqual(['zhang-liao']);
  });

  it('counts a General once per slot played, and its wins follow the seat', () => {
    const p = profile([row(1, { mainGeneralId: 'cao-cao', deputyGeneralId: 'zhang-liao', won: true }), row(2, { mainGeneralId: 'zhang-liao', deputyGeneralId: 'xu-chu', won: false }), row(3, { mainGeneralId: 'xu-chu', deputyGeneralId: null, won: null })]);
    const byId = Object.fromEntries(p.topGenerals.map((g) => [g.generalId, g]));
    expect(byId['zhang-liao']).toEqual({ generalId: 'zhang-liao', games: 2, wins: 1, losses: 1, winRate: 0.5 });
    expect(byId['xu-chu']).toEqual({ generalId: 'xu-chu', games: 2, wins: 0, losses: 1, winRate: 0 });
    expect(byId['cao-cao']).toMatchObject({ games: 1, wins: 1 });
  });

  it('caps topGenerals at 10 and orders by games, then wins, then id', () => {
    const rows = [
      ...Array.from({ length: 12 }, (_, i) => row(i + 1, { mainGeneralId: `g-${String(i).padStart(2, '0')}`, deputyGeneralId: null })),
      row(20, { mainGeneralId: 'g-11', deputyGeneralId: null }),
      row(21, { mainGeneralId: 'g-05', deputyGeneralId: null, won: false }),
    ];
    const ids = profile(rows).topGenerals.map((g) => g.generalId);
    expect(ids).toHaveLength(10);
    expect(ids.slice(0, 3)).toEqual(['g-11', 'g-05', 'g-00']);
  });

  it('lists the newest 10 games as win, loss or none', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(i + 1, { won: i === 11 ? false : i === 10 ? null : true }));
    const { form } = profile(rows);
    expect(form).toHaveLength(10);
    expect(form.slice(0, 3).map((f) => f.result)).toEqual(['loss', 'none', 'win']);
    expect(form[0]).toMatchObject({ gameId: rows[11].gameId, finishedAt: rows[11].finishedAt.getTime() });
  });

  it('ends the current streak at a loss or a game with no outcome, and keeps the best run', () => {
    expect(profile([row(1), row(2), row(3), row(4, { won: false }), row(5), row(6)]).streak).toEqual({ current: 2, best: 3 });
    expect(profile([row(1), row(2), row(3, { won: null }), row(4)]).streak).toEqual({ current: 1, best: 2 });
    expect(profile([row(1), row(2, { won: false })]).streak).toEqual({ current: 0, best: 1 });
  });

  it('filters by room visibility in solo and online modes', () => {
    const rows = [row(1, { visibility: 'solo' }), row(2, { visibility: 'open' }), row(3, { visibility: 'open' })];
    expect(profile(rows, 'solo').totals.games).toBe(1);
    expect(profile(rows, 'online').totals.games).toBe(2);
    expect(profile(rows, 'all').totals.games).toBe(3);
    expect(profile(rows, 'solo').mode).toBe('solo');
  });
});

describe('seatOutcome', () => {
  const result = { endedAt: 1, winningSeatIds: ['a'], losingSeatIds: ['b'] };
  it('is true for a winning seat, false for a losing seat and null otherwise', () => {
    expect(seatOutcome(result, 'a')).toBe(true);
    expect(seatOutcome(result, 'b')).toBe(false);
    expect(seatOutcome(result, 'c')).toBeNull();
    expect(seatOutcome(null, 'a')).toBeNull();
  });
});
