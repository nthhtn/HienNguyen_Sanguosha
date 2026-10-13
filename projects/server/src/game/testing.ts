import { ruleBasedPolicy } from 'bots';
import type { BotTurnMemory } from 'bots';
import { getActiveSeatId, getLegalActions, redactStateForSeat } from 'engine';
import type { Action, EngineContext, GameState } from 'engine';
import { applyActions } from './engineGame';
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

// A copy of `value` with every object's keys in the order Postgres jsonb hands
// them back: shorter keys first, then by bytes (not the order they were stored in).
export function reorderKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => reorderKeys(item)) as T;
  if (value === null || typeof value !== 'object') return value;
  const byteOrder = (a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b));
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.length - b.length || byteOrder(a, b));
  return Object.fromEntries(entries.map(([key, item]) => [key, reorderKeys(item)])) as T;
}

export interface BotPlayedMove {
  seatId: string;
  action: Action;
  after: GameState;
}

// Plays up to `count` moves from `state`, the rule-based bot choosing for
// whoever must act; stops early when the game ends.
export function playBots(ctx: EngineContext, state: GameState, count: number): { state: GameState; moves: BotPlayedMove[] } {
  const memories = new Map<string, BotTurnMemory>();
  const moves: BotPlayedMove[] = [];
  let current = state;
  for (let i = 0; i < count && !current.result; i += 1) {
    const seatId = getActiveSeatId(current)!;
    const decision = ruleBasedPolicy.decide(redactStateForSeat(current, seatId), seatId, getLegalActions(current, seatId, ctx.registry), ctx.registry, memories.get(seatId) ?? null);
    memories.set(seatId, decision.memory);
    current = applyActions(ctx, current, [decision.action]).at(-1)!;
    moves.push({ seatId, action: decision.action, after: current });
  }
  return { state: current, moves };
}
