// Timers for a room's game. The room wraps `run` so it runs on its queue.
export interface Scheduler {
  // Calls `run` after `delayMs`, unless cancelled first. Returns the cancel.
  schedule(delayMs: number, run: () => Promise<void>): () => void;
}

export const realScheduler: Scheduler = {
  schedule(delayMs, run) {
    const timer = setTimeout(() => void run(), delayMs);
    timer.unref();
    return () => clearTimeout(timer);
  },
};
