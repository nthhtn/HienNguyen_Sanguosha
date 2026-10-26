import { createGame } from 'engine';
import type { GameState } from 'engine';
import { buildContentRegistry, kingdomWarMode } from 'content';
import { BotKind, runGame } from './runGame';

export type Side = 'challenger' | 'baseline';

// Seat k plays the challenger when (k + game) is even, so the pattern flips every game.
export const sideOf = (game: number, seatIndex: number): Side => ((seatIndex + game) % 2 === 0 ? 'challenger' : 'baseline');

type KingdomTally = Record<string, { seats: number; wins: number }>;

export interface GameScore {
  finished: boolean;
  seats: Record<Side, number>;
  wins: Record<Side, number>;
  byKingdom: Record<Side, KingdomTally>;
}

// A seat counts as a win for the side that played it; an unfinished game scores nothing.
export function scoreGame(finalState: GameState, sideOfSeat: (seatId: string) => Side): GameScore {
  const score: GameScore = {
    finished: !!finalState.result,
    seats: { challenger: 0, baseline: 0 },
    wins: { challenger: 0, baseline: 0 },
    byKingdom: { challenger: {}, baseline: {} },
  };
  if (!finalState.result) return score;
  const winners = new Set(finalState.result.winningSeatIds);
  for (const seat of finalState.seats) {
    const side = sideOfSeat(seat.id);
    const won = winners.has(seat.id);
    score.seats[side] += 1;
    if (won) score.wins[side] += 1;
    // An Ambitionist is its own group, not its printed Kingdom.
    const group = seat.allegiance === 'ambitionist' ? 'Ambitionist' : seat.kingdom;
    const tally = (score.byKingdom[side][group] ??= { seats: 0, wins: 0 });
    tally.seats += 1;
    if (won) tally.wins += 1;
  }
  return score;
}

export interface Interval {
  mean: number;
  low: number;
  high: number;
  games: number;
}

// Mean with a 95% normal interval (1.96 standard errors); no spread with fewer than two games.
export function interval(values: number[]): Interval {
  const games = values.length;
  if (games === 0) return { mean: 0, low: 0, high: 0, games };
  const mean = values.reduce((sum, v) => sum + v, 0) / games;
  if (games === 1) return { mean, low: mean, high: mean, games };
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (games - 1);
  const margin = 1.96 * Math.sqrt(variance / games);
  return { mean, low: mean - margin, high: mean + margin, games };
}

export interface TournamentConfig {
  games: number;
  seats: number;
  challenger: BotKind;
  baseline: BotKind;
  firstSeed?: number;
  maxActions?: number;
  // Play each seed twice with the sides swapped; the interval is over pairs. Needs an even number of games.
  mirrored?: boolean;
}

export interface SideTally {
  bot: BotKind;
  seats: number;
  wins: number;
  byKingdom: KingdomTally;
}

export interface TournamentReport {
  config: TournamentConfig;
  finished: number;
  unfinished: number;
  challenger: SideTally;
  baseline: SideTally;
  // Challenger share of seats won minus baseline share: per finished game, or per pair when mirrored.
  difference: Interval;
}

const DEFAULT_MAX_ACTIONS = 20000;

// One value per consecutive pair of games (0 and 1, 2 and 3, …); a pair with an unfinished game is dropped.
export function pairMeans(differences: (number | null)[]): number[] {
  const means: number[] = [];
  for (let i = 0; i + 1 < differences.length; i += 2) {
    const a = differences[i];
    const b = differences[i + 1];
    if (a !== null && b !== null) means.push((a + b) / 2);
  }
  return means;
}

export function runTournament(config: TournamentConfig): TournamentReport {
  const wholeNumbers: [string, number | undefined, number][] = [['games', config.games, 0], ['seats', config.seats, 0], ['first seed', config.firstSeed, 0]];
  for (const [name, value, min] of wholeNumbers) {
    if (value !== undefined && (!Number.isInteger(value) || value < min)) throw new Error(`The ${name} must be a whole number, ${min} or more (got ${value})`);
  }
  if (config.mirrored && config.games % 2 !== 0) throw new Error('A mirrored tournament needs an even number of games');
  if (config.seats < 2 || config.seats % 2 !== 0) throw new Error('A tournament needs an even number of seats, at least 2');
  const registry = buildContentRegistry();
  const seatIds = Array.from({ length: config.seats }, (_, i) => `seat-${i}`);
  const firstSeed = config.firstSeed ?? 0;
  const half = config.seats / 2;
  const tallies: Record<Side, SideTally> = {
    challenger: { bot: config.challenger, seats: 0, wins: 0, byKingdom: {} },
    baseline: { bot: config.baseline, seats: 0, wins: 0, byKingdom: {} },
  };
  const gameDifferences: (number | null)[] = []; // null for a game with no result
  for (let game = 0; game < config.games; game++) {
    const seed = firstSeed + (config.mirrored ? Math.floor(game / 2) : game);
    const sideOfSeat = (seatId: string): Side => sideOf(game, seatIds.indexOf(seatId));
    const initialState = createGame(kingdomWarMode, registry, seatIds, seed);
    const { finalState } = runGame(
      initialState,
      { registry, mode: kingdomWarMode },
      seed,
      config.maxActions ?? DEFAULT_MAX_ACTIONS,
      config.baseline,
      undefined,
      (seatId) => (sideOfSeat(seatId) === 'challenger' ? config.challenger : config.baseline)
    );
    const score = scoreGame(finalState, sideOfSeat);
    if (!score.finished) {
      gameDifferences.push(null);
      continue;
    }
    gameDifferences.push(score.wins.challenger / half - score.wins.baseline / half);
    for (const side of ['challenger', 'baseline'] as const) {
      tallies[side].seats += score.seats[side];
      tallies[side].wins += score.wins[side];
      for (const [kingdom, k] of Object.entries(score.byKingdom[side])) {
        const into = (tallies[side].byKingdom[kingdom] ??= { seats: 0, wins: 0 });
        into.seats += k.seats;
        into.wins += k.wins;
      }
    }
  }
  const finished = gameDifferences.filter((d) => d !== null).length;
  const values = config.mirrored ? pairMeans(gameDifferences) : gameDifferences.filter((d): d is number => d !== null);
  return { config, finished, unfinished: gameDifferences.length - finished, challenger: tallies.challenger, baseline: tallies.baseline, difference: interval(values) };
}

const percent = (wins: number, seats: number): string => (seats === 0 ? '-' : `${((100 * wins) / seats).toFixed(1)}%`);

function formatSide(label: string, tally: SideTally): string {
  const kingdoms = Object.entries(tally.byKingdom)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kingdom, k]) => `${kingdom} ${percent(k.wins, k.seats)}`)
    .join(', ');
  return `${label.padEnd(10)} ${tally.bot.padEnd(14)} seats ${String(tally.seats).padStart(5)}  wins ${String(tally.wins).padStart(5)}  rate ${percent(tally.wins, tally.seats).padStart(6)}  [${kingdoms}]`;
}

export function formatReport(report: TournamentReport): string {
  const { config, difference: d } = report;
  const pp = (v: number) => `${(100 * v).toFixed(1)} pp`;
  const verdict = d.games < 2 ? 'too few games to judge' : d.low > 0 ? 'challenger is better' : d.high < 0 ? 'baseline is better' : 'no clear difference';
  return [
    `Games ${config.games} (${report.finished} finished, ${report.unfinished} unfinished), seats ${config.seats}, first seed ${config.firstSeed ?? 0}${config.mirrored ? ', mirrored pairs' : ''}`,
    formatSide('challenger', report.challenger),
    formatSide('baseline', report.baseline),
    `Difference per game (challenger minus baseline): ${pp(d.mean)}, 95% interval ${pp(d.low)} to ${pp(d.high)} over ${d.games} ${config.mirrored ? 'pairs' : 'games'}: ${verdict}`,
  ].join('\n');
}
