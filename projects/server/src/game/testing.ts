import { Scheduler } from './scheduler';

interface Task {
  at: number;
  order: number;
  run: () => Promise<void>;
}

// A clock and timers that a test moves by hand. `advance` runs every task that
// falls due, in time order, and waits for each before the next.
export class ManualScheduler implements Scheduler {
  private tasks: Task[] = [];
  private order = 0;

  constructor(public now: number) {}

  readonly clock = (): number => this.now;

  schedule(delayMs: number, run: () => Promise<void>): () => void {
    const task: Task = { at: this.now + delayMs, order: this.order++, run };
    this.tasks.push(task);
    return () => {
      this.tasks = this.tasks.filter((t) => t !== task);
    };
  }

  get pending(): number {
    return this.tasks.length;
  }

  // When the next task falls due, or null.
  get nextAt(): number | null {
    return this.tasks.length === 0 ? null : Math.min(...this.tasks.map((t) => t.at));
  }

  async advance(ms: number): Promise<void> {
    const until = this.now + ms;
    for (;;) {
      const due = this.tasks.filter((t) => t.at <= until).sort((a, b) => a.at - b.at || a.order - b.order)[0];
      if (!due) break;
      this.tasks = this.tasks.filter((t) => t !== due);
      this.now = Math.max(this.now, due.at);
      await due.run();
    }
    this.now = until;
  }

  // Runs task after task until `done()` holds, nothing is pending, or `limit` tasks ran.
  async runUntil(done: () => boolean, limit = 20_000): Promise<void> {
    for (let i = 0; i < limit && !done(); i += 1) {
      const at = this.nextAt;
      if (at === null) return;
      await this.advance(Math.max(0, at - this.now));
    }
  }
}
