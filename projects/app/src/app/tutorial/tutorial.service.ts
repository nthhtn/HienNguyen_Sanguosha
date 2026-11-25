import { Injectable, InjectionToken, Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Action, GameState } from 'engine';
import { GameService, HUMAN_SEAT_ID, TutorialHooks } from '../game.service';
import { PlaybackGate } from '../playback-gate.service';
import { LESSONS } from './lessons';
import { loadCompleted, saveCompleted } from './progress';
import { allows, completedBy, reachedState } from './step-rules';
import { BotMove, Lesson, LessonGroupId, LessonId, Step } from './tutorial-types';

// The lessons the service can start; a spec swaps in its own.
export const TUTORIAL_LESSONS = new InjectionToken<Lesson[]>('TUTORIAL_LESSONS', { providedIn: 'root', factory: () => LESSONS });

// After playback is idle, a step waits this long before it moves on, so the board has started any playback the
// move set off. Without it the next card could show over an animation that is about to begin.
const SETTLE_MS = 30;

// Runs a lesson on the real game: it sets up the state, filters the beginner's moves to what the step allows,
// serves the scripted bots, and moves to the next step when the step's rule is met and playback has caught up.
@Injectable({ providedIn: 'root' })
export class TutorialService {
  private readonly game = inject(GameService);
  private readonly gate = inject(PlaybackGate);
  private readonly lessons = inject(TUTORIAL_LESSONS);

  private readonly _lesson = signal<Lesson | null>(null);
  private readonly _stepIndex = signal(0);
  private readonly _finished = signal(false);
  private readonly _lastGroup = signal<LessonGroupId | null>(null);
  private readonly _completed = signal<ReadonlySet<LessonId>>(loadCompleted());
  // The step's rule has been met and it moves on once playback is idle.
  private readonly due = signal(false);
  private botQueue: BotMove[] = [];
  private settling: ReturnType<typeof setTimeout> | null = null;

  readonly lesson: Signal<Lesson | null> = this._lesson.asReadonly();
  readonly stepIndex: Signal<number> = this._stepIndex.asReadonly();
  readonly finished: Signal<boolean> = this._finished.asReadonly();
  // The group of the lesson last started, kept after it ends, so the page can reopen that tab.
  readonly lastGroup: Signal<LessonGroupId | null> = this._lastGroup.asReadonly();
  readonly completed: Signal<ReadonlySet<LessonId>> = this._completed.asReadonly();
  readonly step: Signal<Step | null> = computed(() => this._lesson()?.steps[this._stepIndex()] ?? null);

  private readonly hooks: TutorialHooks = {
    allows: (action, state) => {
      const step = this.step();
      return !!step && !this._finished() && allows(step, action, state);
    },
    botMove: (seatId, legal) => {
      const head = this.botQueue[0];
      if (!head || head.seatId !== seatId) return null;
      const action = head.pick(legal, this.game.state() as GameState);
      if (!action) return null;
      this.botQueue.shift();
      return action;
    },
    applied: (action, after) => this.onApplied(action, after),
  };

  constructor() {
    // A step moves on when its rule is met (an action, or a state the game reaches) and playback is idle.
    effect(() => {
      const step = this.step();
      const state = this.game.state();
      const idle = this.gate.idle();
      const due = this.due();
      if (!step || this._finished()) return;
      const ready = due || (!!state && reachedState(step, state));
      if (ready && idle) untracked(() => this.settleThenAdvance());
    });
  }

  start(id: LessonId): void {
    const lesson = this.lessons.find((l) => l.id === id);
    if (!lesson) return;
    this.clearSettle();
    this.due.set(false);
    this._finished.set(false);
    this._lesson.set(lesson);
    this._lastGroup.set(lesson.group);
    this._stepIndex.set(0);
    this.botQueue = [...(lesson.steps[0]?.bot ?? [])];
    this.game.setTutorialHooks(this.hooks);
    this.game.startFromState(lesson.build(this.game.registry), 'vs-bots');
  }

  // Only a `next` step waits for the button.
  next(): void {
    if (this.step()?.completes.kind === 'next') this.advance();
  }

  // The page calls this when it closes, lesson or not: a game the beginner had on this device is not the Tutorial's to discard.
  exit(): void {
    const running = this._lesson() !== null;
    this.clearSettle();
    this.due.set(false);
    this.game.setTutorialHooks(null);
    if (running) this.game.discardGame();
    this._lesson.set(null);
    this._stepIndex.set(0);
    this._finished.set(false);
    this.botQueue = [];
  }

  private onApplied(action: Action, after: GameState): void {
    const step = this.step();
    // Only the beginner's own move completes an action step; a bot may play the same kind of action.
    if (step && !this._finished() && action.seatId === HUMAN_SEAT_ID && completedBy(step, action, after)) this.due.set(true);
  }

  // The effect runs as soon as playback reads idle, which can be before the board has noticed the new state and
  // gone busy; looking again after a moment keeps the next card from showing over a playback about to start.
  private settleThenAdvance(): void {
    if (this.settling !== null) return;
    this.settling = setTimeout(() => {
      this.settling = null;
      const step = this.step();
      const state = this.game.state();
      if (!step || this._finished() || !this.gate.idle()) return;
      if (this.due() || (state && reachedState(step, state))) this.advance();
    }, SETTLE_MS);
  }

  private clearSettle(): void {
    if (this.settling !== null) clearTimeout(this.settling);
    this.settling = null;
  }

  private advance(): void {
    const lesson = this._lesson();
    if (!lesson) return;
    this.due.set(false);
    const index = this._stepIndex() + 1;
    if (index >= lesson.steps.length) {
      this._finished.set(true);
      this.botQueue = [];
      this._completed.update((done) => new Set([...done, lesson.id]));
      saveCompleted(this._completed());
      return;
    }
    this._stepIndex.set(index);
    this.botQueue = [...(lesson.steps[index].bot ?? [])];
    // A bot that was waiting for this step's move starts again.
    this.game.nudgeBots();
  }
}
