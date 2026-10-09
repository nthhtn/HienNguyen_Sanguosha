#!/usr/bin/env node
// projects/sim/src/cli.ts
import { createGame } from 'engine';
import { buildContentRegistry, kingdomWarMode } from 'content';
import { runGame } from './runGame';
import { checkInvariants } from './invariants';

const registry = buildContentRegistry();

function playOneGame(seed: number, numSeats: number) {
  const seatIds = Array.from({ length: numSeats }, (_, i) => `seat-${i}`);
  const initialState = createGame(kingdomWarMode, registry, seatIds, seed);
  return runGame(initialState, { registry, mode: kingdomWarMode }, seed);
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

const [, , mode, arg1, arg2] = process.argv;
if (mode === 'single') {
  runSingle(Number(arg1 ?? 1), Number(arg2 ?? 4));
} else if (mode === 'batch') {
  runBatch(Number(arg1 ?? 100), Number(arg2 ?? 4));
} else {
  console.error('Usage: sim single <seed> <numSeats> | sim batch <numGames> <numSeats>');
  process.exitCode = 1;
}
