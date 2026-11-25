import { getActiveSeatId } from 'engine';
import { emptyHand, playableGame, revealGenerals, setGenerals, setTurn } from '../../scenario-kit/recipe';
import { anchor } from '../anchors';
import { Lesson } from '../tutorial-types';

// Seed 7: the table's first turn belongs to seat-0, the beginner.
const SEED = 7;
const BEGINNER = 'seat-0';
// The seat before the beginner: it ends its Play Phase and the beginner's whole turn follows.
const BEFORE = 'seat-3';

// Lesson 3: the six phases, the Play Phase that waits for the beginner, and discarding down to the hand limit. Both of
// the beginner's Generals are face up (so no Start window opens) and HP is 3; the Draw Phase gives 2 cards on top of the 4
// dealt, so the Discard Phase owes 3. The lesson opens in the previous seat's Play Phase, which a scripted move ends.
export const TURN_LESSON: Lesson = {
  id: 'turn',
  group: 'basics',
  titleKey: 'tutorial.turn.title',
  summaryKey: 'tutorial.turn.summary',
  seatCount: 4,
  build: (registry) => {
    let state = playableGame(registry, SEED, 4);
    state = revealGenerals(setGenerals(state, registry, BEGINNER, 'kingdomWars:cao-cao', 'kingdomWars:guo-jia'), BEGINNER);
    return emptyHand(setTurn(state, BEFORE, 'Play'), BEFORE);
  },
  steps: [
    {
      // Condenses rules.turn.lead, rules.turn.start, rules.turn.judgment and rules.turn.draw.
      id: 'passing-phases',
      textKey: 'tutorial.turn.s1',
      target: anchor.phaseIndicator(),
      completes: { kind: 'state', reached: (s) => s.phase === 'Play' && getActiveSeatId(s) === BEGINNER },
      bot: [{ seatId: BEFORE, pick: (legal) => legal.find((a) => a.kind === 'EndPhaseAction') }],
    },
    // Condenses rules.turn.note and rules.turn.play.
    { id: 'play-waits', textKey: 'tutorial.turn.s2', target: anchor.hand(), completes: { kind: 'next' } },
    {
      id: 'end-phase',
      textKey: 'tutorial.turn.s3',
      target: anchor.endPhase(),
      completes: { kind: 'action', allow: [{ kind: 'EndPhaseAction', match: (a) => a.seatId === BEGINNER }] },
    },
    {
      // Condenses rules.turn.discard.
      id: 'discard',
      textKey: 'tutorial.turn.s4',
      target: anchor.discardDialog(),
      completes: { kind: 'action', allow: [{ kind: 'DiscardCardAction', match: (a) => a.seatId === BEGINNER }] },
    },
    // Condenses rules.turn.end. The phone board keeps the Discard Pile under History.
    { id: 'turn-ends', textKey: 'tutorial.turn.s5', target: anchor.discardPile(), phone: { textKey: 'tutorial.turn.s5p' }, completes: { kind: 'next' } },
  ],
};
