import { getLegalActions } from 'engine';
import { act, playableGame, revealGenerals, setGenerals } from '../../scenario-kit/recipe';
import { anchor } from '../anchors';
import { Lesson } from '../tutorial-types';

// A seed whose first turn belongs to seat-0 (the beginner), who holds a Crossbow, Sha, Coerce and Sha.
const SEED = 7;
const BEGINNER = 'seat-0';

// Lesson 1: the beginner's Generals, HP and the board's cards. It starts in the beginner's Play Phase, Cao Cao and
// Guo Jia face up (the Rules page's HP example: 4 + 3 = 7, half rounded down is 3).
export const GENERALS_LESSON: Lesson = {
  id: 'generals',
  group: 'basics',
  titleKey: 'tutorial.generals.title',
  summaryKey: 'tutorial.generals.summary',
  seatCount: 4,
  build: (registry) => {
    let state = playableGame(registry, SEED, 4);
    state = setGenerals(state, registry, BEGINNER, 'kingdomWars:cao-cao', 'kingdomWars:guo-jia');
    state = revealGenerals(state, BEGINNER);
    // Close the Start window the real way, revealing nothing more: the engine runs on to the Play Phase.
    const confirm = getLegalActions(state, BEGINNER, registry).find((a) => a.kind === 'ConfirmRevealsAction');
    if (!confirm) throw new Error('The Generals lesson expects the Start window to be open');
    return act(state, registry, { ...confirm, slots: [] });
  },
  steps: [
    { id: 'two-generals', textKey: 'tutorial.generals.s1', target: anchor.seat(BEGINNER), completes: { kind: 'next' } },
    { id: 'shared-hp', textKey: 'tutorial.generals.s2', target: anchor.hp(BEGINNER), completes: { kind: 'next' } },
    { id: 'general-details', textKey: 'tutorial.generals.s3', target: anchor.generalInfo(BEGINNER), completes: { kind: 'next' }, phone: { textKey: 'tutorial.generals.s3p' } },
    { id: 'hand', textKey: 'tutorial.generals.s4', target: anchor.hand(), completes: { kind: 'next' } },
    { id: 'discard-pile', textKey: 'tutorial.generals.s5', target: anchor.discardPile(), completes: { kind: 'next' }, phone: { textKey: 'tutorial.generals.s5p', target: anchor.historyButton() } },
    { id: 'action-history', textKey: 'tutorial.generals.s6', target: anchor.actionHistory(), completes: { kind: 'next' }, phone: { textKey: 'tutorial.generals.s6p', target: anchor.historyButton() } },
  ],
};
