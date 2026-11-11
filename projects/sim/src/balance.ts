import { createGame } from 'engine';
import type { GameState, Seat } from 'engine';
import { buildContentRegistry, guozhanMode } from 'content';
import { leadingForceOf } from 'bots';
import { runGame } from './runGame';
import { interval } from './tournament';
import type { Interval } from './tournament';

// Balance runs: every seat plays the same bot, and we measure how often a leading force goes on to win.

export interface BalanceConfig {
  games: number;
  seats: number;
  policy: string;
  firstSeed?: number;
}

export interface BalanceGame {
  seed: number;
  winners: string[]; // force keys
  everLed: string | null; // the first force that led
  leaderWon: boolean;
  deaths: number; // seats eliminated in the game
  hpLost: number; // damage taken, summed over all seats
}

export interface BalanceReport {
  config: BalanceConfig;
  games: BalanceGame[];
  perForce: Record<string, { seats: number; wins: number }>;
  leaderWonRate: Interval; // over games with a leader
}

const MAX_ACTIONS = 20000;

// The force a seat ends in: an Ambitionist is its own force, otherwise its Kingdom (eliminated seats are revealed).
// Same key format as the bots' forcesOf.
const finalForceKey = (seat: Seat): string => (seat.allegiance === 'ambitionist' ? `ambitionist:${seat.id}` : seat.kingdom);

function hpLostIn(state: GameState): number {
  let total = 0;
  for (const event of state.log) {
    if (event.kind === 'DamageDealtEvent' && event.damage.target.kind === 'seat') total += event.damage.amount;
  }
  return total;
}

export function runBalance(config: BalanceConfig): BalanceReport {
  const registry = buildContentRegistry();
  const seatIds = Array.from({ length: config.seats }, (_, i) => `seat-${i}`);
  const firstSeed = config.firstSeed ?? 0;
  const games: BalanceGame[] = [];
  const perForce: BalanceReport['perForce'] = {};
  for (let g = 0; g < config.games; g++) {
    const seed = firstSeed + g;
    let everLed: string | null = null;
    const { finalState } = runGame(
      createGame(guozhanMode, registry, seatIds, seed),
      { registry, mode: guozhanMode },
      seed,
      MAX_ACTIONS,
      config.policy,
      (state) => {
        if (everLed === null) everLed = leadingForceOf(state)?.key ?? null;
      }
    );
    const winningSeats = new Set(finalState.result?.winningSeatIds ?? []);
    const winners = [...new Set(finalState.seats.filter((s) => winningSeats.has(s.id)).map(finalForceKey))];
    for (const seat of finalState.seats) {
      const tally = (perForce[finalForceKey(seat)] ??= { seats: 0, wins: 0 });
      tally.seats += 1;
      if (winningSeats.has(seat.id)) tally.wins += 1;
    }
    games.push({
      seed,
      winners,
      everLed,
      leaderWon: everLed !== null && winners.includes(everLed),
      deaths: finalState.seats.filter((s) => s.eliminated).length,
      hpLost: hpLostIn(finalState),
    });
  }
  const led = games.filter((game) => game.everLed !== null);
  return { config, games, perForce, leaderWonRate: interval(led.map((game) => (game.leaderWon ? 1 : 0))) };
}

export interface BalanceComparison {
  leaderWonDiff: Interval;
  deathsDiff: Interval;
  hpLostDiff: Interval;
}

// A minus B, paired by seed; the leader-won difference only over seeds where both had a leader.
export function compareBalance(a: BalanceReport, b: BalanceReport): BalanceComparison {
  const bySeed = new Map(b.games.map((game) => [game.seed, game]));
  const pairs = a.games.flatMap((game) => {
    const other = bySeed.get(game.seed);
    return other ? [{ a: game, b: other }] : [];
  });
  const led = pairs.filter((p) => p.a.everLed !== null && p.b.everLed !== null);
  return {
    leaderWonDiff: interval(led.map((p) => Number(p.a.leaderWon) - Number(p.b.leaderWon))),
    deathsDiff: interval(pairs.map((p) => p.a.deaths - p.b.deaths)),
    hpLostDiff: interval(pairs.map((p) => p.a.hpLost - p.b.hpLost)),
  };
}

const pct = (v: number): string => `${(100 * v).toFixed(1)}%`;
const fmt = (i: Interval, digits = 2): string => `${i.mean.toFixed(digits)} (${i.low.toFixed(digits)} to ${i.high.toFixed(digits)}) over ${i.games}`;

export function formatBalanceReport(report: BalanceReport): string {
  const forces = Object.entries(report.perForce)
    .sort(([x], [y]) => x.localeCompare(y))
    .map(([key, t]) => `${key} ${t.seats === 0 ? '-' : pct(t.wins / t.seats)}`)
    .join(', ');
  const r = report.leaderWonRate;
  return [
    `${report.config.policy}: ${report.games.length} games, ${report.config.seats} seats`,
    `  win rate per force: ${forces}`,
    `  leader won: ${pct(r.mean)} (${pct(r.low)} to ${pct(r.high)}) over ${r.games} games with a leader`,
  ].join('\n');
}

export function formatComparison(c: BalanceComparison): string {
  return [
    `Leader won, A minus B: ${fmt(c.leaderWonDiff, 3)} games`,
    `Deaths per game, A minus B: ${fmt(c.deathsDiff)} games`,
    `HP lost per game, A minus B: ${fmt(c.hpLostDiff)} games`,
  ].join('\n');
}
