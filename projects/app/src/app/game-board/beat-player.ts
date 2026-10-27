// A fixed sequence of beats for a popup: each runs once at its time, in order. Pure TypeScript over
// setTimeout, so a sequence is the same for every viewer and is tested with fake timers.

export interface Beat {
  // Milliseconds from the start.
  at: number;
  run: () => void;
}

export interface BeatPlayback {
  // Cancels the beats that have not run yet.
  stop(): void;
}

// Whether the viewer asked for less motion: the sequence then shows each beat's end state at once.
export function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

// Runs `beats` in time order (equal times keep their given order). With `reducedMotion` (default: the
// viewer's setting) all of them run now, in order, with no timers left.
export function playBeats(beats: readonly Beat[], opts: { reducedMotion?: boolean } = {}): BeatPlayback {
  const ordered = beats.map((beat, index) => ({ beat, index })).sort((a, b) => a.beat.at - b.beat.at || a.index - b.index).map((x) => x.beat);
  if (opts.reducedMotion ?? prefersReducedMotion()) {
    for (const beat of ordered) beat.run();
    return { stop: () => undefined };
  }
  const timers = ordered.map((beat) => setTimeout(beat.run, beat.at));
  return { stop: () => timers.forEach(clearTimeout) };
}
