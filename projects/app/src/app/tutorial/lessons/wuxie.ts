import { emptyHand, give, giveCopies, playCard, playableGame, revealGenerals, setGenerals, setTurn } from '../../scenario-kit/recipe';
import { anchor } from '../anchors';
import { Lesson } from '../tutorial-types';
import { handOf, isRespondWith, respondWith } from './lesson-kit';

const SEED = 7;
const BEGINNER = 'seat-0';
// Plays Break on the beginner. It is the seat before the beginner in turn order, so the Wuxie check, which starts at the
// seat that used the Tool, asks the beginner first.
const ATTACKER = 'seat-3';
// The seat after the beginner: it holds the one Wuxie that answers the beginner's.
const ANSWERER = 'seat-1';

// Lesson 8: a bot plays Break on the beginner, and the beginner cancels it with Wuxie, the answerer cancels that Wuxie,
// and the beginner cancels that one. The last Wuxie decides, so Break is cancelled. The lesson opens with the window
// already asking the beginner (the Break was played by the recipe), as the Damage and Recovery lesson does with its Sha.
export const WUXIE_LESSON: Lesson = {
  id: 'wuxie',
  group: 'cards',
  titleKey: 'tutorial.wuxie.title',
  summaryKey: 'tutorial.wuxie.summary',
  seatCount: 4,
  build: (registry) => {
    let state = playableGame(registry, SEED, 4);
    state = revealGenerals(setGenerals(state, registry, BEGINNER, 'kingdomWars:cao-cao', 'kingdomWars:guo-jia'), BEGINNER);
    state = setTurn(state, ATTACKER, 'Play');
    for (const seat of state.seats) state = emptyHand(state, seat.id);
    // The deck holds one Wuxie and the chain needs three, so the beginner's and the answerer's are copies made for the lesson.
    state = give(giveCopies(giveCopies(give(state, ATTACKER, ['break']), BEGINNER, 'wuxie', 2), ANSWERER, 'wuxie', 1), BEGINNER, ['peach']);
    return playCard(state, registry, ATTACKER, 'break', [BEGINNER]);
  },
  steps: [
    // Condenses rules.response.wuxieIntro.
    { id: 'intro', textKey: 'tutorial.wuxie.s1', target: anchor.responseDialog(), completes: { kind: 'next' } },
    {
      // Condenses rules.response.chain2.
      id: 'wuxie-first',
      textKey: 'tutorial.wuxie.s2',
      target: anchor.responseDialog(),
      completes: { kind: 'action', allow: [{ kind: 'RespondAction', match: (a, s) => a.seatId === BEGINNER && isRespondWith('wuxie')(a, s) }] },
    },
    {
      // Condenses rules.response.chain3.
      id: 'countered',
      textKey: 'tutorial.wuxie.s3',
      target: anchor.actionHistory(),
      phone: { target: anchor.historyButton(), textKey: 'tutorial.wuxie.s3p' },
      completes: { kind: 'state', reached: (s) => s.pendingResponse?.respondingSeatId === BEGINNER && !handOf(s, ANSWERER).includes('wuxie') },
      bot: [{ seatId: ANSWERER, pick: respondWith('wuxie') }],
    },
    {
      id: 'wuxie-second',
      textKey: 'tutorial.wuxie.s4',
      target: anchor.responseDialog(),
      completes: { kind: 'action', allow: [{ kind: 'RespondAction', match: (a, s) => a.seatId === BEGINNER && isRespondWith('wuxie')(a, s) }] },
    },
    // Condenses rules.response.chain4 and rules.response.breakCancelled.
    { id: 'outro', textKey: 'tutorial.wuxie.s5', target: anchor.actionHistory(), phone: { target: anchor.historyButton(), textKey: 'tutorial.wuxie.s5p' }, completes: { kind: 'next' } },
  ],
};
