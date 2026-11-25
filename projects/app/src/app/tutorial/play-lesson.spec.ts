import { buildContentRegistry } from 'content';
import { playableGame, setTurn } from '../scenario-kit/recipe';
import { playLesson } from './lessons/play-lesson.testing';
import { Lesson, Step } from './tutorial-types';

const registry = buildContentRegistry();
const text = 'nav.menu' as const;
const next = (id: string): Step => ({ id, textKey: text, completes: { kind: 'next' } });
const lesson = (steps: Step[]): Lesson => ({ id: 'turn', group: 'basics', titleKey: text, summaryKey: text, seatCount: 2, build: (r) => playableGame(r, 7, 2), steps });

// seat-0 starts in its Start window, where the only legal move is ConfirmRevealsAction.
describe('playLesson', () => {
  it('passes next steps without asking the engine for anything', () => {
    expect(playLesson(lesson([next('a'), next('b')]), registry)).toEqual([
      { stepId: 'a', ok: true },
      { stepId: 'b', ok: true },
    ]);
  });

  it('plays an action step with the first legal action the step allows', () => {
    const confirm: Step = { id: 'confirm', textKey: text, completes: { kind: 'action', allow: [{ kind: 'ConfirmRevealsAction' }] } };
    const inPlay: Step = { id: 'play', textKey: text, completes: { kind: 'state', reached: (s) => s.phase === 'Play' } };
    expect(playLesson(lesson([confirm, inPlay, next('end')]), registry).map((s) => s.ok)).toEqual([true, true, true]);
  });

  it('fails an action step for which no legal action is allowed, naming it, and stops there', () => {
    const impossible: Step = { id: 'impossible', textKey: text, completes: { kind: 'action', allow: [{ kind: 'EndPhaseAction' }] } };
    expect(playLesson(lesson([next('a'), impossible, next('never')]), registry)).toEqual([
      { stepId: 'a', ok: true },
      { stepId: 'impossible', ok: false },
    ]);
  });

  it('fails a state step whose predicate never holds, instead of looping', () => {
    const never: Step = { id: 'never', textKey: text, completes: { kind: 'state', reached: () => false } };
    expect(playLesson(lesson([never]), registry)).toEqual([{ stepId: 'never', ok: false }]);
  });

  it('runs a scripted bot move for a state step that waits on a bot', () => {
    // seat-1 is due in its Play phase; its scripted move ends that phase.
    const botDue = (r: typeof registry) => setTurn(playableGame(r, 7, 2), 'seat-1', 'Play');
    const endsPlay: Step = {
      id: 'bot-ends-play',
      textKey: text,
      completes: { kind: 'state', reached: (s) => s.phase !== 'Play' },
      bot: [{ seatId: 'seat-1', pick: (legal) => legal.find((a) => a.kind === 'EndPhaseAction') }],
    };
    expect(playLesson({ ...lesson([endsPlay]), build: botDue }, registry)).toEqual([{ stepId: 'bot-ends-play', ok: true }]);
  });

  it('fails a state step that waits on a bot with nothing scripted for it', () => {
    const botDue = (r: typeof registry) => setTurn(playableGame(r, 7, 2), 'seat-1', 'Play');
    const waits: Step = { id: 'waits', textKey: text, completes: { kind: 'state', reached: (s) => s.phase !== 'Play' } };
    expect(playLesson({ ...lesson([waits]), build: botDue }, registry)).toEqual([{ stepId: 'waits', ok: false }]);
  });

  it('offers the Start window’s Confirm for each General a step may reveal, not only the empty template', () => {
    const revealsMain: Step = {
      id: 'reveals-main',
      textKey: text,
      completes: { kind: 'action', allow: [{ kind: 'ConfirmRevealsAction', match: (a) => a.kind === 'ConfirmRevealsAction' && a.slots.includes('main') }] },
    };
    const mainUp: Step = { id: 'main-up', textKey: text, completes: { kind: 'state', reached: (s) => s.phase === 'Play' && !!s.seats[0].generals?.main.revealed } };
    expect(playLesson(lesson([revealsMain, mainUp]), registry).map((s) => s.ok)).toEqual([true, true]);
  });
});
