// Online, a viewer who owes a decision sees the rest of the queue in about this long (ms).
export const RUSH_MS = 1000;
// Online, a queue longer than this (ms, at Normal) is sped up until it fits, so no screen drifts far behind.
export const CAP_MS = 4000;

// The divisor for every beat's duration. `queuedMs` is the queue's total at Normal. Catch-up is for
// online games only, where the server clock never waits for playback.
export function paceFactor(queuedMs: number, speedFactor: number, opts: { catchUp: boolean; owesDecision: boolean }): number {
  if (speedFactor === Infinity) return Infinity;
  if (!opts.catchUp) return speedFactor;
  return Math.max(speedFactor, queuedMs / (opts.owesDecision ? RUSH_MS : CAP_MS));
}
