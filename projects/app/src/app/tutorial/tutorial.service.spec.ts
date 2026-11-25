import { TestBed } from '@angular/core/testing';
import { GameState } from 'engine';
import { GameService } from '../game.service';
import { PlaybackGate } from '../playback-gate.service';
import { playableGame, setTurn } from '../scenario-kit/recipe';
import { TUTORIAL_LESSONS, TutorialService } from './tutorial.service';
import { Lesson, Step } from './tutorial-types';

// 'nav.menu' is any existing catalog key: the service never reads the text.
const text = 'nav.menu' as const;
const next = (id: string): Step => ({ id, textKey: text, completes: { kind: 'next' } });
const confirm = (id: string): Step => ({ id, textKey: text, completes: { kind: 'action', allow: [{ kind: 'ConfirmRevealsAction' }] } });
const reachesPlay = (id: string): Step => ({ id, textKey: text, completes: { kind: 'state', reached: (s) => s.phase === 'Play' } });

// seat-0 starts in its Start window (the only legal move is ConfirmRevealsAction).
const lesson = (id: Lesson['id'], steps: Step[], build?: Lesson['build'], group: Lesson['group'] = 'basics'): Lesson => ({
  id,
  group,
  titleKey: text,
  summaryKey: text,
  seatCount: 2,
  build: build ?? ((registry) => playableGame(registry, 7, 2)),
  steps,
});

describe('TutorialService', () => {
  let game: GameService;
  let gate: PlaybackGate;
  let service: TutorialService;

  const setup = (lessons: Lesson[]) => {
    TestBed.configureTestingModule({ providers: [{ provide: TUTORIAL_LESSONS, useValue: lessons }] });
    game = TestBed.inject(GameService);
    game.botDelayMs = 0;
    gate = TestBed.inject(PlaybackGate);
    service = TestBed.inject(TutorialService);
  };
  // Lets effects run, then the short settle a step waits after playback is idle, then effects again.
  const settle = () => {
    TestBed.tick();
    jest.advanceTimersByTime(50);
    TestBed.tick();
  };
  const confirmReveals = () => game.submit(game.legalActions().find((a) => a.kind === 'ConfirmRevealsAction')!);

  beforeEach(() => {
    jest.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('lastGroup', () => {
    it('is none before any lesson, then the group of the lesson started, kept after it ends', () => {
      setup([lesson('turn', [next('a')], undefined, 'basics'), lesson('chains', [next('a')], undefined, 'effects')]);
      expect(service.lastGroup()).toBeNull();
      service.start('chains');
      expect(service.lastGroup()).toBe('effects');
      service.exit();
      expect(service.lastGroup()).toBe('effects');
      service.start('turn');
      expect(service.lastGroup()).toBe('basics');
    });
  });

  describe('start', () => {
    it('builds the lesson state on the real game, with hooks on, at the first step', () => {
      setup([lesson('turn', [next('a'), next('b')])]);
      expect(service.lesson()).toBeNull();
      expect(service.step()).toBeNull();

      service.start('turn');

      expect(service.lesson()?.id).toBe('turn');
      expect(service.stepIndex()).toBe(0);
      expect(service.step()?.id).toBe('a');
      expect(service.finished()).toBe(false);
      expect(game.tutorialActive()).toBe(true);
      expect(game.mode()).toBe('vs-bots');
      expect(game.state()?.seats).toHaveLength(2);
      expect(game.state()?.phase).toBe('Start');
    });

    it('does nothing for a lesson that is not registered', () => {
      setup([lesson('turn', [next('a')])]);
      service.start('damage');
      expect(service.lesson()).toBeNull();
      expect(game.state()).toBeNull();
    });

    it('starting again restarts at the first step', () => {
      setup([lesson('turn', [next('a'), next('b')])]);
      service.start('turn');
      service.next();
      expect(service.step()?.id).toBe('b');
      service.start('turn');
      expect(service.step()?.id).toBe('a');
      expect(service.finished()).toBe(false);
    });
  });

  describe('a next step', () => {
    it('advances on next()', () => {
      setup([lesson('turn', [next('a'), next('b')])]);
      service.start('turn');
      service.next();
      expect(service.stepIndex()).toBe(1);
    });

    it('locks the board: the beginner cannot play while a card explains something', () => {
      setup([lesson('turn', [next('a'), next('b')])]);
      service.start('turn');
      const before = game.state();
      confirmReveals();
      expect(game.state()).toBe(before);
    });

    it('is not advanced by anything the beginner does on an action step: next() does nothing there', () => {
      setup([lesson('turn', [confirm('a'), next('b')])]);
      service.start('turn');
      service.next();
      expect(service.stepIndex()).toBe(0);
    });
  });

  describe('an action step', () => {
    it('refuses an action the step does not allow', () => {
      setup([lesson('turn', [{ id: 'a', textKey: text, completes: { kind: 'action', allow: [{ kind: 'EndPhaseAction' }] } }, next('b')])]);
      service.start('turn');
      const before = game.state();
      confirmReveals();
      expect(game.state()).toBe(before);
      settle();
      expect(service.stepIndex()).toBe(0);
    });

    it('advances once the allowed action is applied', () => {
      setup([lesson('turn', [confirm('a'), next('b')])]);
      service.start('turn');
      confirmReveals();
      expect(game.state()?.phase).not.toBe('Start');
      settle();
      expect(service.step()?.id).toBe('b');
    });

    it('waits for playback to catch up before it advances', () => {
      setup([lesson('turn', [confirm('a'), next('b')])]);
      service.start('turn');
      gate.idle.set(false);
      confirmReveals();
      settle();
      expect(service.stepIndex()).toBe(0);

      gate.idle.set(true);
      settle();
      expect(service.stepIndex()).toBe(1);
    });

    it('is not completed by a bot’s move that the step would have allowed', () => {
      // seat-1 is due in its Play phase; the step allows an EndPhaseAction from anybody, but only the beginner counts.
      const botTurn: Lesson['build'] = (registry) => setTurn(playableGame(registry, 7, 2), 'seat-1', 'Play');
      const endPhase: Step = { id: 'a', textKey: text, completes: { kind: 'action', allow: [{ kind: 'EndPhaseAction' }] }, bot: [{ seatId: 'seat-1', pick: (legal) => legal.find((a) => a.kind === 'EndPhaseAction') }] };
      setup([lesson('turn', [endPhase, next('b')], botTurn)]);
      service.start('turn');
      jest.advanceTimersByTime(10);
      settle();
      // The bot did end its Play phase, and that did not complete the step.
      expect(game.state()!.phase).not.toBe('Play');
      expect(service.stepIndex()).toBe(0);
    });
  });

  describe('a state step', () => {
    it('advances once the game reaches the state and playback is idle', () => {
      setup([lesson('turn', [reachesPlay('a'), next('b')])]);
      service.start('turn');
      settle();
      expect(service.stepIndex()).toBe(0);

      gate.idle.set(false);
      game.showState({ ...(game.state() as GameState), phase: 'Play' });
      settle();
      expect(service.stepIndex()).toBe(0);

      gate.idle.set(true);
      settle();
      expect(service.stepIndex()).toBe(1);
    });

    it('chains: a step the engine has already satisfied advances on its own', () => {
      setup([lesson('turn', [confirm('a'), reachesPlay('b'), next('c')])]);
      service.start('turn');
      confirmReveals();
      settle();
      settle();
      expect(service.step()?.id).toBe('c');
    });
  });

  describe('scripted bots', () => {
    const botDue: Lesson['build'] = (registry) => setTurn(playableGame(registry, 7, 2), 'seat-1', 'Play');
    const endPhase = (legal: { kind: string }[]) => legal.find((a) => a.kind === 'EndPhaseAction') as never;

    it('serves a step’s bot move to the right seat, once', () => {
      const pick = jest.fn(endPhase);
      setup([lesson('turn', [{ ...next('a'), bot: [{ seatId: 'seat-1', pick }] }], botDue)]);
      service.start('turn');
      const before = game.state();

      jest.advanceTimersByTime(10);

      expect(pick).toHaveBeenCalledTimes(1);
      expect(game.state()).not.toBe(before);
      expect(game.botThinkingSeatId()).toBeNull();
    });

    it('leaves a bot waiting when the next scripted move is for another seat', () => {
      const pick = jest.fn(endPhase);
      setup([lesson('turn', [{ ...next('a'), bot: [{ seatId: 'seat-0', pick }] }], botDue)]);
      service.start('turn');
      const before = game.state();

      jest.advanceTimersByTime(10);

      expect(pick).not.toHaveBeenCalled();
      expect(game.state()).toBe(before);
    });

    it('leaves a bot waiting when the step scripts nothing, with no fall back to the policy', () => {
      setup([lesson('turn', [next('a')], botDue)]);
      service.start('turn');
      const before = game.state();

      jest.advanceTimersByTime(10);

      expect(game.state()).toBe(before);
    });

    it('leaves a bot waiting when its scripted pick finds nothing legal', () => {
      const pick = jest.fn(() => undefined);
      setup([lesson('turn', [{ ...next('a'), bot: [{ seatId: 'seat-1', pick }] }], botDue)]);
      service.start('turn');
      const before = game.state();

      jest.advanceTimersByTime(10);

      expect(pick).toHaveBeenCalledTimes(1);
      expect(game.state()).toBe(before);
      expect(game.botThinkingSeatId()).toBeNull();
    });

    it('a step change swaps in the new step’s moves', () => {
      const first = jest.fn(endPhase);
      const second = jest.fn(endPhase);
      setup([
        lesson(
          'turn',
          [
            { ...next('a'), bot: [{ seatId: 'seat-0', pick: first }] },
            { ...next('b'), bot: [{ seatId: 'seat-1', pick: second }] },
          ],
          botDue
        ),
      ]);
      service.start('turn');
      jest.advanceTimersByTime(10);
      expect(second).not.toHaveBeenCalled();

      // The bot waited with nothing scripted; the new step's move sets it going again.
      service.next();
      jest.advanceTimersByTime(10);

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  describe('finishing', () => {
    it('sets finished, marks the lesson done and saves it when the last step completes', () => {
      const save = jest.spyOn(Storage.prototype, 'setItem');
      setup([lesson('turn', [next('a'), next('b')])]);
      service.start('turn');
      service.next();
      expect(service.finished()).toBe(false);
      expect(service.completed().has('turn')).toBe(false);

      service.next();

      expect(service.finished()).toBe(true);
      expect(service.completed().has('turn')).toBe(true);
      expect(save).toHaveBeenCalledWith('tutorial.completed', '["turn"]');
    });

    it('keeps the board locked once it has finished', () => {
      setup([lesson('turn', [next('a')])]);
      service.start('turn');
      service.next();
      const before = game.state();
      confirmReveals();
      expect(game.state()).toBe(before);
    });

    it('starts with the lessons saved in an earlier visit', () => {
      localStorage.setItem('tutorial.completed', '["allegiance"]');
      setup([lesson('turn', [next('a')])]);
      expect(service.completed()).toEqual(new Set(['allegiance']));
    });

    it('still works when saving throws', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('quota');
      });
      setup([lesson('turn', [next('a')])]);
      service.start('turn');
      service.next();
      expect(service.finished()).toBe(true);
      expect(service.completed().has('turn')).toBe(true);
    });
  });

  describe('exit', () => {
    it('clears the hooks and discards the game mid-lesson', () => {
      setup([lesson('turn', [next('a'), next('b')])]);
      service.start('turn');

      service.exit();

      expect(game.tutorialActive()).toBe(false);
      expect(game.state()).toBeNull();
      expect(service.lesson()).toBeNull();
      expect(service.step()).toBeNull();
      expect(service.finished()).toBe(false);
    });

    it('does the same after the lesson has finished', () => {
      setup([lesson('turn', [next('a')])]);
      service.start('turn');
      service.next();
      expect(service.finished()).toBe(true);

      service.exit();

      expect(game.tutorialActive()).toBe(false);
      expect(game.state()).toBeNull();
      expect(service.finished()).toBe(false);
      expect(service.completed().has('turn')).toBe(true);
    });

    it('leaves a game that is not the Tutorial’s alone when no lesson is running', () => {
      setup([lesson('turn', [next('a')])]);
      game.startFromState(playableGame(game.registry, 7, 2), 'vs-bots');
      expect(game.state()).not.toBeNull();

      service.exit();

      expect(game.state()).not.toBeNull();
    });

    it('stops a late playback from advancing a lesson that was left', () => {
      setup([lesson('turn', [confirm('a'), next('b')])]);
      service.start('turn');
      gate.idle.set(false);
      confirmReveals();
      service.exit();
      gate.idle.set(true);
      settle();
      expect(service.lesson()).toBeNull();
      expect(service.stepIndex()).toBe(0);
    });
  });
});
