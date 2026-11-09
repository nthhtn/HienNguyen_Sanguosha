// Online, a backlog longer than this (real ms) is sped up until what is left fits: a late joiner or a reconnect catching up. A
// batch the server paced is never this long, so it plays at the chosen speed.
export const CAP_MS = 30_000;

// The divisor for every beat's duration. `queuedMs` is the queue's total at Normal. Catch-up is for
// online games only, where the server clock never waits for playback.
export function paceFactor(queuedMs: number, speedFactor: number, opts: { catchUp: boolean }): number {
  if (speedFactor === Infinity) return Infinity;
  if (!opts.catchUp) return speedFactor;
  return Math.max(speedFactor, queuedMs / CAP_MS);
}
