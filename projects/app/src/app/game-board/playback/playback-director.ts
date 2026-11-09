import { DestroyRef, Injectable, Signal, effect, inject, signal, untracked } from '@angular/core';
import type { CardZone, EngineEvent, GameState, UsedCard } from 'engine';
import { describeResolution, ResolutionNoticeContent, ResolutionSpan } from 'content';
import { GameService } from '../../game.service';
import { PlaybackGate } from '../../playback-gate.service';
import { PlaybackSpeed } from '../../playback-speed.service';
import { BATCH_GAP_MS, PlannedBeat, planBeat } from './beats';
import { foldEvent } from './displayed-state';
import { RESOLUTION_NOTICE_REGISTRY } from './notice-registry';
import { paceFactor } from './pace';
import { resolutionSpans } from './resolution-spans';

interface Step {
  beat: PlannedBeat;
  // The last beat of the events one update brought: the pause between batches follows it.
  lastOfBatch: boolean;
  // The resolutions that end at this beat: their notices are published when it plays.
  notices: ResolutionSpan[];
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
  private readonly noticeRegistry = inject(RESOLUTION_NOTICE_REGISTRY);

  private readonly _displayedState = signal<GameState | null>(null);
  private readonly _current = signal<PlannedBeat | null>(null);
  private readonly _idle = signal(true);
  private readonly _playedLogLength = signal(0);
  private readonly _centreStack = signal<UsedCard[]>([]);
  private readonly _notices = signal<ResolutionNoticeContent[]>([]);

  readonly displayedState: Signal<GameState | null> = this._displayedState.asReadonly();
  readonly current: Signal<PlannedBeat | null> = this._current.asReadonly();
  readonly idle: Signal<boolean> = this._idle.asReadonly();
  readonly playedLogLength: Signal<number> = this._playedLogLength.asReadonly();
  // The cards played into the resolution on show.
  readonly centreStack: Signal<UsedCard[]> = this._centreStack.asReadonly();
  // The Resolution Notices waiting to show, oldest first. In a local game a notice blocks: playback is held
  // from the beat that publishes it until it is dismissed, so no later beat, bot move or decision clock runs
  // under it. Online it does not (the server paces the game and knows nothing of the popup), like the Compete
  // popup. The board shows the first and calls `dismissNotice` when its 5 seconds are up.
  readonly notices: Signal<ResolutionNoticeContent[]> = this._notices.asReadonly();

  dismissNotice(): void {
    this._notices.update((all) => all.slice(1));
    if (this._notices().length === 0) this.releaseNotices();
  }

  // The log length already queued; null before the first look.
  private cursor: number | null = null;
  // Where the next look for finished resolutions starts: the start of one still open, else the log's end.
  private noticeFrom = 0;
  // Held while any notice is waiting or showing.
  private releaseNoticeHold: (() => void) | null = null;
  // The event at `cursor - 1` when it was queued: a log that no longer has it there is another game's.
  private lastQueued: EngineEvent | undefined;
  // The Pass and Play gate went up after a look: the next look is a reveal.
  private hiddenAfterLook = false;
  // The latest visible state: where the fold takes faces from, and what the board shows when idle.
  private target: GameState | null = null;
  private queue: Step[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private holds = 0;
  // A beat's wait ended while held: the next one plays on release.
  private due = false;

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
      this._centreStack.set([]);
      this.clearNotices();
      this.finish(null);
      return;
    }
    // After a reveal, the last move plays again from the state before it, as the revealed seat sees it.
    const moveStart = this.hiddenAfterLook ? this.game.lastMoveStart() : null;
    this.hiddenAfterLook = false;
    if (moveStart && moveStart.log.length <= visible.log.length) {
      this._displayedState.set(moveStart);
      this.cursor = moveStart.log.length;
      this.noticeFrom = this.cursor;
    } else if (this.cursor === null || this.isNewGame(visible) || this._displayedState() === null) {
      // The first look, a new game or a reveal with no move to replay: nothing old plays.
      this.stop();
      this.cursor = visible.log.length;
      this.lastQueued = visible.log[this.cursor - 1];
      this.noticeFrom = this.cursor;
      this.target = visible;
      this._centreStack.set([]);
      this.clearNotices();
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
      .map((beat): Step => ({ beat, lastOfBatch: false, notices: [] }));
    if (steps.length > 0) steps[steps.length - 1].lastOfBatch = true;
    this.planNotices(visible, cursor, steps);
    this.queue.push(...steps);
    this.cursor = visible.log.length;
    this.lastQueued = visible.log[this.cursor - 1];
  }

  // Finds the resolutions that finished with this update and hangs each on the beat of its last event (or,
  // for one that finished with events already queued, on the first new beat; with no new beat, now).
  private planNotices(visible: GameState, cursor: number, steps: Step[]): void {
    const settled = !visible.pendingResponse && !visible.pendingChoice && !visible.pendingSelection && !visible.pendingArrangement && !visible.resolutionQueue && !visible.judgmentView;
    const scan = resolutionSpans(visible.log, Math.min(this.noticeFrom, cursor), settled, (id) => id in this.noticeRegistry);
    this.noticeFrom = scan.resumeFrom;
    for (const { span, endIndex } of scan.spans) {
      // With no new beat, it waits behind the beats already queued.
      const step = steps.find((s) => s.beat.logIndex === Math.max(endIndex, cursor)) ?? this.queue[this.queue.length - 1];
      if (step) step.notices.push(span);
      else this.publish(span);
    }
  }

  // Every waiting notice is dropped (online, a decision the viewer owes must not wait behind a popup).
  dropNotices(): void {
    this.clearNotices();
  }

  private clearNotices(): void {
    this._notices.set([]);
    this.releaseNotices();
  }

  private releaseNotices(): void {
    this.releaseNoticeHold?.();
    this.releaseNoticeHold = null;
  }

  private publish(span: ResolutionSpan): void {
    // The state as of the beat just played, so a card moved or an HP lost later in the batch is not shown early.
    const state = this._displayedState() ?? this.target;
    const content = state ? describeResolution(span, state, this.noticeRegistry) : null;
    if (!content) return;
    this._notices.update((all) => [...all, content]);
    if (this.game.clockWaitsForPlayback) this.releaseNoticeHold ??= this.hold();
  }

  // Another game: the log is shorter than what was queued, or the event last queued is not where it was. The view's
  // log may be a re-masked copy (a skill now reads 'hidden', or no longer does), which is still the same game.
  private isNewGame(visible: GameState): boolean {
    const cursor = this.cursor ?? 0;
    if (visible.log.length < cursor) return true;
    return cursor > 0 && !sameUpToMasking(visible.log[cursor - 1], this.lastQueued);
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
      this.play(step);
      const wait = Math.round(stepMs(step) / factor);
      if (wait > 0) {
        this.timer = setTimeout(() => this.advance(), wait);
        return;
      }
    }
  }

  private play(step: Step): void {
    const beat = step.beat;
    const target = this.target;
    const shown = this._displayedState();
    if (!target || !shown) return;
    this._current.set(beat);
    this._displayedState.set({ ...foldEvent(shown, beat.event, target), log: target.log.slice(0, beat.logIndex + 1) });
    this._playedLogLength.set(beat.logIndex + 1);
    // The centre outlives idle, since a response comes in a later update: it clears on the next play, turn or phase.
    const visual = beat.visual;
    if (visual?.kind === 'play') this._centreStack.update((stack) => (visual.response ? [...stack, visual.card] : [visual.card]));
    else if (beat.event.kind === 'TurnAdvancedEvent' || beat.event.kind === 'PhaseChangedEvent') this._centreStack.set([]);
    step.notices.forEach((span) => this.publish(span));
  }

  private factor(queuedMs: number): number {
    return paceFactor(queuedMs, this.speed.factor(), { catchUp: !this.game.clockWaitsForPlayback });
  }

  // Caught up: the board shows the real state again. The centre stays until play moves on (see play).
  private finish(state: GameState | null): void {
    this._displayedState.set(state);
    this._current.set(null);
    this._playedLogLength.set(state?.log.length ?? 0);
    this.setIdle(true);
  }

  private stop(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.queue = [];
    this.due = false;
  }

  private setIdle(idle: boolean): void {
    this._idle.set(idle);
    this.gate.idle.set(idle);
  }
}

const stepMs = (step: Step) => step.beat.durationMs + (step.lastOfBatch ? BATCH_GAP_MS : 0);

// The same event, or a copy masked for another set of hidden skills: equal but where one side reads 'hidden'.
function sameUpToMasking(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'string' && typeof b === 'string') return a.includes('hidden') || b.includes('hidden');
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every((k) => k in b && sameUpToMasking((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
