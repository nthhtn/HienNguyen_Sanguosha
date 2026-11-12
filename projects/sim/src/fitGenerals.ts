import { createGame } from 'engine';
import { buildContentRegistry, guozhanMode, pairKey } from 'content';
import { policyById, registerPolicy } from 'bots';
import type { BotPolicy } from 'bots';
import { runGame } from './runGame';

// A General with n samples keeps n / (n + SHRINK_K) of its measured lift.
export const SHRINK_K = 200;
const RANDOM_PICKS_ID = 'fit-random-picks';

export type FitDeck = 'identity' | 'kingdomWars';

export interface PickSample {
  generalIds: [string, string];
  won: boolean;
  seats: number;
  // R2′: the printed Kingdom of the seat's Generals (both share one), whatever allegiance the seat ends with.
  kingdom: string;
}

export interface Fit {
  values: Record<string, number>;
  counts: Record<string, number>;
}

// R2: each seat count weighs the same whatever its sample count, and is compared against its own win rate.
interface SeatCountStats {
  weight: number;
  overall: number;
}

function statsBySeatCount(samples: PickSample[]): Map<number, SeatCountStats> {
  const tally = new Map<number, { n: number; wins: number }>();
  for (const x of samples) {
    const t = tally.get(x.seats) ?? { n: 0, wins: 0 };
    t.n += 1;
    if (x.won) t.wins += 1;
    tally.set(x.seats, t);
  }
  const stats = new Map<number, SeatCountStats>();
  for (const [seats, t] of tally) stats.set(seats, { weight: 1 / t.n, overall: t.wins / t.n });
  return stats;
}

// R2′: F(K, s) = the win rate of seats of Kingdom K at seat count s − the overall win rate at s.
export function forceLifts(samples: PickSample[]): Record<string, Record<number, number>> {
  const stats = statsBySeatCount(samples);
  const tally: Record<string, Record<number, { n: number; wins: number }>> = {};
  for (const x of samples) {
    const t = ((tally[x.kingdom] ??= {})[x.seats] ??= { n: 0, wins: 0 });
    t.n += 1;
    if (x.won) t.wins += 1;
  }
  const lifts: Record<string, Record<number, number>> = {};
  for (const [kingdom, bySeats] of Object.entries(tally)) {
    lifts[kingdom] = {};
    for (const [seats, t] of Object.entries(bySeats)) lifts[kingdom][Number(seats)] = t.wins / t.n - stats.get(Number(seats))!.overall;
  }
  return lifts;
}

// R2′ / R4′: a sample's weight, and its result measured against its seat count and its force: won − overall(s) − F(K, s).
function forceResiduals(samples: PickSample[]): { weight: number; residual: number }[] {
  const stats = statsBySeatCount(samples);
  const lifts = forceLifts(samples);
  return samples.map((x) => {
    const { weight, overall } = stats.get(x.seats)!;
    return { weight, residual: (x.won ? 1 : 0) - overall - lifts[x.kingdom][x.seats] };
  });
}

// A weighted mean of per-sample residuals, kept with the raw sample count for shrinking.
interface Accumulator {
  n: number;
  weight: number;
  sum: number;
}

const add = (acc: Accumulator, weight: number, residual: number): void => {
  acc.n += 1;
  acc.weight += weight;
  acc.sum += weight * residual;
};

// R2′: a General's value is its weighted mean of (won − overall(s) − F(K, s)), shrunk by n / (n + k).
export function fitValues(samples: PickSample[], k = SHRINK_K): Fit {
  const residuals = forceResiduals(samples);
  const tally: Record<string, Accumulator> = {};
  samples.forEach((x, i) => {
    const { weight, residual } = residuals[i];
    for (const id of x.generalIds) add((tally[id] ??= { n: 0, weight: 0, sum: 0 }), weight, residual);
  });
  const values: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const [id, t] of Object.entries(tally)) {
    values[id] = (t.n / (t.n + k)) * (t.sum / t.weight);
    counts[id] = t.n;
  }
  return { values, counts };
}

// R4: a candidate pair keeps n / (n + K_PAIR) of its measured lift.
export const K_PAIR = 200;

export interface PairFit {
  bonuses: Record<string, number>;
  counts: Record<string, number>;
}

// R4′: a candidate's lift is its weighted mean of (won − overall(s) − F(K, s) − value A − value B), force
// subtracted once; only lifts above 0 after rounding to 4 decimals are kept.
export function fitPairs(samples: PickSample[], values: Record<string, number>, candidates: readonly (readonly [string, string])[], k = K_PAIR): PairFit {
  const residuals = forceResiduals(samples);
  const tally = new Map<string, Accumulator>(candidates.map(([a, b]) => [pairKey(a, b), { n: 0, weight: 0, sum: 0 }]));
  samples.forEach((x, i) => {
    const [a, b] = x.generalIds;
    const acc = tally.get(pairKey(a, b));
    if (!acc) return;
    const { weight, residual } = residuals[i];
    add(acc, weight, residual - (values[a] ?? 0) - (values[b] ?? 0));
  });
  const bonuses: Record<string, number> = {};
  const counts: Record<string, number> = {};
  for (const [key, t] of tally) {
    counts[key] = t.n;
    const bonus = t.n === 0 ? 0 : (t.n / (t.n + k)) * (t.sum / t.weight);
    if (Number(bonus.toFixed(4)) > 0) bonuses[key] = bonus;
  }
  return { bonuses, counts };
}

// The whole text of general-values.data.ts.
export function formatTable(fit: Fit, command: string): string {
  const rows = Object.keys(fit.values).sort().map((id) => `  '${id}': ${fit.values[id].toFixed(4)}, // ${fit.counts[id]} samples`);
  return [
    '// How much better (win-rate points) a seat does holding each General; absent ids count 0.',
    '// GENERATED by `' + command + '`; see the Stage 4 spec. Do not edit by hand.',
    'export const GENERAL_VALUES: Readonly<Record<string, number>> = {',
    ...rows,
    '};',
    '',
  ].join('\n');
}

// R2′: each Kingdom's force lift as comments, the plain mean of F(K, s) over the seat counts it was seen at.
function forceLiftComments(forces: Record<string, Record<number, number>>): string[] {
  const rows = Object.keys(forces)
    .sort()
    .map((kingdom) => {
      const lifts = Object.values(forces[kingdom]);
      const mean = lifts.reduce((sum, v) => sum + v, 0) / lifts.length;
      return `//   ${kingdom}: ${mean >= 0 ? '+' : ''}${mean.toFixed(4)}`;
    });
  return ["// Force lift (a Kingdom's win rate minus the overall rate), averaged over seat counts. Values and pair", '// bonuses are measured against it; it is not used for picking.', ...rows];
}

// The whole text of general-values.kingdom-wars.data.ts: values by full id, then the confirmed pair bonuses.
export function formatDeckTable(fit: Fit, pairs: PairFit, forces: Record<string, Record<number, number>>, command: string): string {
  const valueRows = Object.keys(fit.values).sort().map((id) => `  '${id}': ${fit.values[id].toFixed(4)}, // ${fit.counts[id]} samples`);
  const pairRows = Object.keys(pairs.counts)
    .sort()
    .map((key) => (key in pairs.bonuses ? `  '${key}': ${pairs.bonuses[key].toFixed(4)}, // ${pairs.counts[key]} samples` : `  // '${key}': no bonus, ${pairs.counts[key]} samples`));
  return [
    '// How much better (win-rate points) a seat does holding each Kingdom Wars General than its force does, and the',
    '// extra lift of confirmed candidate pairs; absent ids and pairs count 0.',
    '// GENERATED by `' + command + '`; see the Kingdom Wars bots Part 4 spec. Do not edit by hand.',
    '',
    ...forceLiftComments(forces),
    '',
    'export const KINGDOM_WARS_VALUES: Readonly<Record<string, number>> = {',
    ...valueRows,
    '};',
    '',
    '// Keyed by `pairKey` (the two full ids, sorted, joined by `|`). Candidates without a bonus are listed as comments.',
    'export const KINGDOM_WARS_PAIR_BONUSES: Readonly<Record<string, number>> = {',
    ...pairRows,
    '};',
    '',
  ].join('\n');
}

// Plays `rule-based`, but picks a pseudo-random legal pair (from the game seed and the seat), so a General's
// value is not mixed up with its max HP.
function randomPicks(): BotPolicy {
  const base = policyById('rule-based');
  return {
    id: RANDOM_PICKS_ID,
    decide: (view, seatId, legal, registry, memory) => {
      const decision = base.decide(view, seatId, legal, registry, memory);
      if (view.phase !== 'GeneralSelection') return decision;
      const choices = legal.filter((a) => a.kind === 'ChooseGeneralsAction');
      const index = (view.rng.seed + 7919 * view.seats.findIndex((s) => s.id === seatId)) % choices.length;
      return { ...decision, action: choices[index] ?? decision.action };
    },
  };
}

export function collectSamples(games: number, seats: number, firstSeed: number, deck: FitDeck): PickSample[] {
  registerPolicy(randomPicks());
  const registry = buildContentRegistry();
  const seatIds = Array.from({ length: seats }, (_, i) => `seat-${i}`);
  const samples: PickSample[] = [];
  for (let game = 0; game < games; game++) {
    const seed = firstSeed + game;
    const { finalState } = runGame(createGame(guozhanMode, registry, seatIds, seed, { deck }), { registry, mode: guozhanMode }, seed, 20000, RANDOM_PICKS_ID);
    if (!finalState.result) continue;
    const winners = new Set(finalState.result.winningSeatIds);
    for (const seat of finalState.seats) {
      if (!seat.generals) continue;
      const main = seat.generals.main.generalDefinitionId;
      const kingdom = registry.generals.get(main)?.kingdom;
      if (!kingdom) throw new Error(`General ${main} is not in the registry`);
      samples.push({ generalIds: [main, seat.generals.deputy.generalDefinitionId], won: winners.has(seat.id), seats, kingdom });
    }
  }
  return samples;
}
