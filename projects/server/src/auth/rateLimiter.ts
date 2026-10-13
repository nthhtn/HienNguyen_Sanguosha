export interface RateLimit {
  limit: number;
  windowMs: number;
}

// Fixed-window counters, in memory: enough for one server process.
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(private readonly rule: RateLimit) {}

  // Counts a hit for `key`; false once the key is over its limit in this window.
  hit(key: string, now: number): boolean {
    const window = this.windows.get(key);
    if (!window || now - window.start >= this.rule.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      return this.rule.limit >= 1;
    }
    window.count += 1;
    return window.count <= this.rule.limit;
  }

  // Drops ended windows so the map doesn't grow without bound.
  prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.start >= this.rule.windowMs) this.windows.delete(key);
    }
  }

  get size(): number {
    return this.windows.size;
  }
}
