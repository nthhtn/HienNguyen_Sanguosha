import { DestroyRef, Injectable, Signal, effect, inject, signal, untracked } from '@angular/core';
import type { CardZone, GameState, UsedCard } from 'engine';
import { GameService } from '../../game.service';
import { PlaybackGate } from '../../playback-gate.service';
import { PlaybackSpeed } from '../../playback-speed.service';
import { BATCH_GAP_MS, PlannedBeat, planBeat } from './beats';
import { foldEvent } from './displayed-state';
import { paceFactor } from './pace';

interface Step {
  beat: PlannedBeat;
  // The last beat of the events one update brought: the pause between batches follows it.
  lastOfBatch: boolean;
}

// Plays the log's new events as paced beats, and keeps the state the board shows at the moment being
// played. It replays recorded facts only; when the queue empties the board shows the real state again.
// Provided by the board, so it lives as long as the board does. `GameService` is the online
// `RemoteGameService` inside the online screen.
@Injectable()
export class PlaybackDirector {
  private readonly game = inject(GameService);
  private readonly speed = inject(PlaybackSpeed);
  private readonly gate = inject(PlaybackGate);

  private readonly _displayedState = signal<GameState | null>(null);
  private readonly _current = signal<PlannedBeat | null>(null);
  private readonly _idle = signal(true);
  private readonly _playedLogLength = signal(0);
  private readonly _centreStack = signal<UsedCard[]>([]);

  readonly displayedState: Signal<GameState | null> = this._displayedState.asReadonly();
  readonly current: Signal<PlannedBeat | null> = this._current.asReadonly();
  readonly idle: Signal<boolean> = this._idle.asReadonly();
  readonly playedLogLength: Signal<number> = this._playedLogLength.asReadonly();
  // The cards played into the resolution on show.
  readonly centreStack: Signal<UsedCard[]> = this._centreStack.asReadonly();

  // The log length already queued; null before the first look.
  private cursor: number | null = null;
  // The Pass and Play gate went up after a look: the next look is a reveal.
  private hiddenAfterLook = false;
  // The latest visible state: where the fold takes faces from, and what the board shows when idle.
  private target: GameState | null = null;
  private queue: Step[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private holds = 0;
  // A beat's wait ended while held: the next one plays on release.
  private due = false;
  // The pace a rush started with, kept so the queue it started with ends in about RUSH_MS.
  private rush = 0;

  constructor() {
    effect(() => {
      const visible = this.game.visibleState();
      untracked(() => this.look(visible));
    });
    // Leaving the board must not leave bots waiting on a playback no one sees.
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      this.gate.idle.set(true);
    });
  }

  // Pauses playback (a popup on show) until the returned release is called.
  hold(): () => void {
    this.holds++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holds--;
      if (this.holds === 0 && this.due) this.advance();
    };
  }

  private look(visible: GameState | null): void {
    if (!visible) {
      // Pass and Play's gate is up: nothing shows or plays until the next seat reveals.
      this.hiddenAfterLook ||= this.cursor !== null;
      this.stop();
      this.target = null;
      this.finish(null);
      return;
    }
    // After a reveal, the last move plays again from the state before it, as the revealed seat sees it.
    const moveStart = this.hiddenAfterLook ? this.game.lastMoveStart() : null;
    this.hiddenAfterLook = false;
    if (moveStart && moveStart.log.length <= visible.log.length) {
      this._displayedState.set(moveStart);
      this.cursor = moveStart.log.length;
    } else if (this.cursor === null || visible.log.length < this.cursor || this._displayedState() === null) {
      // The first look, a new game or a reveal with no move to replay: nothing old plays.
      this.stop();
      this.cursor = visible.log.length;
      this.target = visible;
      this.finish(visible);
      return;
    }
    this.target = visible;
    this.enqueue(visible);
    if (this.timer !== null || this.due) return;
    if (this.queue.length === 0) this.finish(visible);
    else this.advance();
  }

  private enqueue(visible: GameState): void {
    const cursor = this.cursor ?? visible.log.length;
    const kinds = new Map<string, CardZone['kind']>(visible.zones.map((z) => [z.id, z.kind]));
    const zoneKindOf = (zoneId: string) => kinds.get(zoneId);
    const steps = visible.log
      .slice(cursor)
      .map((event, i) => planBeat(event, cursor + i, { zoneKindOf, previous: visible.log[cursor + i - 1] }))
      .map((beat): Step => ({ beat, lastOfBatch: false }));
    if (steps.length > 0) steps[steps.length - 1].lastOfBatch = true;
    this.queue.push(...steps);
    this.cursor = visible.log.length;
  }

  // Plays beats until one needs time on screen, a hold stops it, or the queue runs out.
  private advance(): void {
    this.timer = null;
    this.due = false;
    if (this.queue.length > 0) this.setIdle(false);
    for (;;) {
      if (this.holds > 0) {
        this.due = true;
        return;
      }
      if (this.queue.length === 0) {
        this.finish(this.target);
        return;
      }
      // Recomputed at every beat: a decision coming due online, or a speed change, applies at once.
      const factor = this.factor(this.queue.reduce((sum, step) => sum + stepMs(step), 0));
      const step = this.queue.shift()!;
      this.play(step.beat);
      const wait = Math.round(stepMs(step) / factor);
      if (wait > 0) {
        this.timer = setTimeout(() => this.advance(), wait);
        return;
      }
    }
  }

  private play(beat: PlannedBeat): void {
    const target = this.target;
    const shown = this._displayedState();
    if (!target || !shown) return;
    this._current.set(beat);
    this._displayedState.set({ ...foldEvent(shown, beat.event, target), log: target.log.slice(0, beat.logIndex + 1) });
    this._playedLogLength.set(beat.logIndex + 1);
    const visual = beat.visual;
    if (visual?.kind === 'play') this._centreStack.update((stack) => (visual.response ? [...stack, visual.card] : [visual.card]));
    else if (beat.event.kind === 'TurnAdvancedEvent') this._centreStack.set([]);
  }

  private factor(queuedMs: number): number {
    const catchUp = !this.game.clockWaitsForPlayback;
    const owesDecision = this.game.legalActions().length > 0;
    const factor = paceFactor(queuedMs, this.speed.factor(), { catchUp, owesDecision });
    if (catchUp && owesDecision) {
      // Recomputing on the shrinking queue alone would slow the rush down beat by beat.
      this.rush = Math.max(this.rush, factor);
      return this.rush;
    }
    this.rush = 0;
    return factor;
  }

  // Caught up: the board shows the real state again.
  private finish(state: GameState | null): void {
    this._displayedState.set(state);
    this._current.set(null);
    this._centreStack.set([]);
    this._playedLogLength.set(state?.log.length ?? 0);
    this.rush = 0;
    this.setIdle(true);
  }

  private stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.queue = [];
    this.due = false;
    this.rush = 0;
  }

  private setIdle(idle: boolean): void {
    this._idle.set(idle);
    this.gate.idle.set(idle);
  }
}

const stepMs = (step: Step) => step.beat.durationMs + (step.lastOfBatch ? BATCH_GAP_MS : 0);
