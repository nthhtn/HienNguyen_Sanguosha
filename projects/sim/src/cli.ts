#!/usr/bin/env node
// projects/sim/src/cli.ts
import { createGame } from 'engine';
import { buildContentRegistry, guozhanMode } from 'content';
import { parseBotKind, runGame } from './runGame';
import { formatReport, runTournament } from './tournament';
import { collectSamples, fitValues, formatTable } from './fitGenerals';
import { checkInvariants } from './invariants';

const registry = buildContentRegistry();

function playOneGame(seed: number, numSeats: number) {
  const seatIds = Array.from({ length: numSeats }, (_, i) => `seat-${i}`);
  const initialState = createGame(guozhanMode, registry, seatIds, seed);
  return runGame(initialState, { registry, mode: guozhanMode }, seed);
}

function runSingle(seed: number, numSeats: number): void {
  const { finalState, actionsSubmitted } = playOneGame(seed, numSeats);
  console.log(`Actions submitted: ${actionsSubmitted}`);
  console.log(`Result: ${JSON.stringify(finalState.result)}`);
  console.log('Event log:');
  for (const event of finalState.log) {
    console.log(JSON.stringify(event));
  }
  const violations = checkInvariants(finalState, registry);
  if (violations.length > 0) {
    console.error('Invariant violations:', violations);
    process.exitCode = 1;
  }
}

function runBatch(numGames: number, numSeats: number): void {
  let failures = 0;
  for (let seed = 0; seed < numGames; seed++) {
    const { finalState, actionsSubmitted } = playOneGame(seed, numSeats);
    const violations = checkInvariants(finalState, registry);
    if (violations.length > 0 || !finalState.result) {
      failures++;
      console.error(
        `Seed ${seed} FAILED (actions: ${actionsSubmitted}):`,
        violations.length > 0 ? violations : 'game did not terminate'
      );
    }
  }
  console.log(`${numGames - failures}/${numGames} games passed invariant checks.`);
  if (failures > 0) process.exitCode = 1;
}

function parseMirrored(option: string | undefined): boolean {
  if (option === undefined || option === 'mirrored') return true;
  if (option === 'unmirrored') return false;
  throw new Error(`Unknown option "${option}". Use mirrored or unmirrored`);
}

function runTournamentCommand(games: number, numSeats: number, challenger: string, baseline: string, firstSeed: number, option: string | undefined): void {
  const mirrored = parseMirrored(option);
  const report = runTournament({ games, seats: numSeats, challenger: parseBotKind(challenger), baseline: parseBotKind(baseline), firstSeed, mirrored });
  console.log(formatReport(report));
}

const [, , mode, arg1, arg2, arg3, arg4, arg5, arg6] = process.argv;
if (mode === 'single') {
  runSingle(Number(arg1 ?? 1), Number(arg2 ?? 4));
} else if (mode === 'batch') {
  runBatch(Number(arg1 ?? 100), Number(arg2 ?? 4));
} else if (mode === 'tournament') {
  try {
    runTournamentCommand(Number(arg1 ?? 100), Number(arg2 ?? 4), arg3 ?? 'rule-based', arg4 ?? 'rule-based-v1', Number(arg5 ?? 0), arg6);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
} else if (mode === 'fit-generals') {
  try {
    const [games, seats, first] = [Number(arg1 ?? 1000), Number(arg2 ?? 4), Number(arg3 ?? 0)];
    process.stdout.write(formatTable(fitValues(collectSamples(games, seats, first)), `npm run sim -- fit-generals ${games} ${seats} ${first}`));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  }
} else {
  console.error(
    'Usage: sim single <seed> <numSeats> | sim batch <numGames> <numSeats> | sim tournament <games> <numSeats> <challenger> <baseline> [firstSeed] [mirrored|unmirrored] | sim fit-generals <games> <numSeats> <firstSeed>'
  );
  process.exitCode = 1;
}
