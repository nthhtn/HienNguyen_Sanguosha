import type { GameResult } from 'engine';
import type { Force, FormEntry, ForceRecord, GeneralRecord, ProfileMode, ProfileStats, WinLoss } from 'protocol';
import { ProfileGameRow } from '../persistence/records';

const FORM_LENGTH = 10;
const TOP_GENERALS = 10;
// Forces with the same number of games list in this order.
const FORCE_ORDER: Force[] = ['Wei', 'Shu', 'Wu', 'Qun', 'ambitionist'];

// True when the seat won, false when it lost, null when the game gave it neither.
export function seatOutcome(result: GameResult | null, seatId: string): boolean | null {
  if (!result) return null;
  if (result.winningSeatIds.includes(seatId)) return true;
  if (result.losingSeatIds.includes(seatId)) return false;
  return null;
}

// A seat's Force: alone, or its printed Kingdom. Null while the Kingdom is hidden and undecided.
function forceOf(row: ProfileGameRow): Force | null {
  if (row.allegiance === 'ambitionist') return 'ambitionist';
  return row.kingdom === 'hidden' ? null : row.kingdom;
}

class Tally {
  games = 0;
  wins = 0;
  losses = 0;
  add(won: boolean | null): void {
    this.games += 1;
    if (won === true) this.wins += 1;
    if (won === false) this.losses += 1;
  }
  get noOutcome(): number {
    return this.games - this.wins - this.losses;
  }
  record(): WinLoss {
    return { games: this.games, wins: this.wins, losses: this.losses, winRate: this.wins + this.losses === 0 ? null : this.wins / (this.wins + this.losses) };
  }
}

const tallyOf = <K>(map: Map<K, Tally>, key: K): Tally => {
  let tally = map.get(key);
  if (!tally) map.set(key, (tally = new Tally()));
  return tally;
};

// A player's numbers over their seat results (Profile spec "Rules for the numbers").
export function computeProfile(input: { displayName: string; memberSince: Date; rows: ProfileGameRow[]; mode: ProfileMode }): ProfileStats {
  const rows = input.rows
    .filter((row) => input.mode === 'all' || row.visibility === (input.mode === 'solo' ? 'solo' : 'open'))
    .sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime() || a.gameId.localeCompare(b.gameId));

  const totals = new Tally();
  const forces = new Map<Force, Tally>();
  const generals = new Map<string, Tally>();
  for (const row of rows) {
    totals.add(row.won);
    const force = forceOf(row);
    if (force) tallyOf(forces, force).add(row.won);
    for (const generalId of [row.mainGeneralId, row.deputyGeneralId]) if (generalId) tallyOf(generals, generalId).add(row.won);
  }

  const byForce: ForceRecord[] = [...forces].map(([force, tally]) => ({ force, ...tally.record() })).sort((a, b) => b.games - a.games || FORCE_ORDER.indexOf(a.force) - FORCE_ORDER.indexOf(b.force));
  const topGenerals: GeneralRecord[] = [...generals]
    .map(([generalId, tally]) => ({ generalId, ...tally.record() }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins || a.generalId.localeCompare(b.generalId))
    .slice(0, TOP_GENERALS);
  const form: FormEntry[] = rows.slice(0, FORM_LENGTH).map((row) => ({ gameId: row.gameId, finishedAt: row.finishedAt.getTime(), result: row.won === true ? 'win' : row.won === false ? 'loss' : 'none' }));

  // Rows are newest first: the current streak is the leading run of wins.
  let current = 0;
  while (current < rows.length && rows[current].won === true) current += 1;
  let best = 0;
  let run = 0;
  for (const row of rows) {
    run = row.won === true ? run + 1 : 0;
    best = Math.max(best, run);
  }

  return {
    displayName: input.displayName,
    memberSince: input.memberSince.getTime(),
    mode: input.mode,
    totals: { ...totals.record(), noOutcome: totals.noOutcome },
    byForce,
    topGenerals,
    form,
    streak: { current, best },
  };
}
