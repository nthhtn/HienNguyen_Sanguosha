import { ContentRegistry, GameState, getActiveSeatId, getLegalActions } from 'engine';
import { act } from '../../scenario-kit/recipe';
import { allows, reachedState } from '../step-rules';
import { BotMove, Lesson } from '../tutorial-types';

const HUMAN = 'seat-0';
const MAX_MOVES = 50;

export interface PlayedStep {
  stepId: string;
  ok: boolean;
}

// Plays a lesson headlessly with the real engine, the way TutorialService runs it: a `next` step is skipped; an
// `action` step takes the first legal action of the beginner that the step allows; a `state` step lets the scripted
// bots move until the predicate holds. A step that cannot complete is reported `ok: false` and playing stops there,
// since the state after it is not the lesson's.
export function playLesson(lesson: Lesson, registry: ContentRegistry): PlayedStep[] {
  let state: GameState = lesson.build(registry);
  const played: PlayedStep[] = [];

  for (const step of lesson.steps) {
    const queue: BotMove[] = [...(step.bot ?? [])];
    // Bots due to act move from the step's queue, in order; an empty queue or another seat's turn leaves them waiting.
    const runBots = (): void => {
      for (let moves = 0; moves < MAX_MOVES; moves++) {
        const seatId = getActiveSeatId(state);
        const head = queue[0];
        if (!seatId || state.players.find((p) => p.seatId === seatId)?.kind !== 'bot' || !head || head.seatId !== seatId) return;
        const action = head.pick(getLegalActions(state, seatId, registry), state);
        if (!action) return;
        queue.shift();
        state = act(state, registry, action);
      }
    };
    runBots();

    let ok = false;
    if (step.completes.kind === 'next') {
      ok = true;
    } else if (step.completes.kind === 'action') {
      const action = getLegalActions(state, HUMAN, registry).find((a) => allows(step, a, state));
      if (action) {
        state = act(state, registry, action);
        ok = true;
      }
    } else {
      for (let moves = 0; moves < MAX_MOVES && !ok; moves++) {
        if (reachedState(step, state)) {
          ok = true;
          break;
        }
        const before = state;
        runBots();
        if (state === before) break;
      }
      ok = ok || reachedState(step, state);
    }
    played.push({ stepId: step.id, ok });
    if (!ok) break;
  }
  return played;
}
