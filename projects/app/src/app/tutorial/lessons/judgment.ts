import { emptyHand, give, playableGame, revealGenerals, setGenerals, setTurn, stackDrawPile } from '../../scenario-kit/recipe';
import { anchor } from '../anchors';
import { Lesson } from '../tutorial-types';
import { playsCard } from './lesson-kit';

const SEED = 7;
const BEGINNER = 'seat-0';
// The seat next to the beginner, at distance 1 as Starvation needs.
const TARGET = 'seat-1';

// Lesson 9: place Starvation on a bot, end the turn, and watch the bot's Judgment Phase. The top card of the draw pile is
// fixed to a heart, which is not a club, so the verdict is always the same: the bot skips its Draw Phase. Nobody holds a
// Wuxie, so nothing cancels the Starvation when it is judged.
export const JUDGMENT_LESSON: Lesson = {
  id: 'judgment',
  group: 'effects',
  titleKey: 'tutorial.judgment.title',
  summaryKey: 'tutorial.judgment.summary',
  seatCount: 4,
  build: (registry) => {
    let state = playableGame(registry, SEED, 4);
    state = revealGenerals(setGenerals(state, registry, BEGINNER, 'kingdomWars:cao-cao', 'kingdomWars:guo-jia'), BEGINNER);
    state = setTurn(state, BEGINNER, 'Play');
    for (const seat of state.seats) state = emptyHand(state, seat.id);
    return stackDrawPile(give(state, BEGINNER, ['starvation']), ['heart']);
  },
  steps: [
    // Condenses rules.judgment.delayedText.
    { id: 'intro', textKey: 'tutorial.judgment.s1', target: anchor.hand(), completes: { kind: 'next' } },
    {
      // Condenses rules.judgment.starvation (placed on another seat at distance 1).
      id: 'play-starvation',
      textKey: 'tutorial.judgment.s2',
      target: [anchor.targetSeat(TARGET), anchor.handCard('starvation')],
      phone: { target: [anchor.targetSeat(TARGET), anchor.playButton('starvation'), anchor.handCard('starvation')], textKey: 'tutorial.judgment.s2p' },
      completes: { kind: 'action', allow: [playsCard(BEGINNER, 'starvation', TARGET)] },
    },
    { id: 'placed', textKey: 'tutorial.judgment.s3', target: anchor.judgmentArea(TARGET), completes: { kind: 'next' } },
    {
      id: 'end-phase',
      textKey: 'tutorial.judgment.s4',
      target: anchor.endPhase(),
      completes: { kind: 'action', allow: [{ kind: 'EndPhaseAction', match: (a) => a.seatId === BEGINNER }] },
    },
    {
      // Condenses rules.judgment.step1 and rules.judgment.starvation. The popup has no button: it closes by its own
      // countdown, which acknowledges the judgment, so the step lets that acknowledgement through.
      id: 'judged',
      textKey: 'tutorial.judgment.s5',
      target: anchor.judgmentDialog(),
      completes: { kind: 'action', allow: [{ kind: 'AcknowledgeJudgmentAction' }] },
    },
    // Condenses rules.judgment.skipDraw and rules.judgment.step4.
    { id: 'skipped', textKey: 'tutorial.judgment.s6', target: anchor.phaseIndicator(), completes: { kind: 'next' } },
    { id: 'outro', textKey: 'tutorial.judgment.s7', completes: { kind: 'next' } },
  ],
};
