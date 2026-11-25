import { playableGame, setGenerals } from '../../scenario-kit/recipe';
import { anchor } from '../anchors';
import { Lesson } from '../tutorial-types';

// Seed 7: the first turn belongs to seat-0, the beginner.
const SEED = 7;
const BEGINNER = 'seat-0';

// Lesson 2: Force, hidden Generals and revealing. It starts on the beginner's Start window, the real pending decision
// with both Generals face down; the beginner reveals the Main General (Cao Cao, Wei) and the engine runs on to the Play
// Phase. The Start window shows from the first step, so the first two steps spotlight it whole.
export const ALLEGIANCE_LESSON: Lesson = {
  id: 'allegiance',
  group: 'basics',
  titleKey: 'tutorial.allegiance.title',
  summaryKey: 'tutorial.allegiance.summary',
  seatCount: 4,
  build: (registry) => setGenerals(playableGame(registry, SEED, 4), registry, BEGINNER, 'kingdomWars:cao-cao', 'kingdomWars:guo-jia'),
  steps: [
    // Condenses rules.setup.step2 and rules.setup.reveal1.
    { id: 'face-down', textKey: 'tutorial.allegiance.s1', target: anchor.revealDialog(), completes: { kind: 'next' } },
    {
      id: 'reveal-main',
      textKey: 'tutorial.allegiance.s2',
      target: anchor.revealDialog(),
      completes: {
        kind: 'action',
        allow: [{ kind: 'ConfirmRevealsAction', match: (a) => a.kind === 'ConfirmRevealsAction' && a.seatId === BEGINNER && a.slots.includes('main') }],
      },
    },
    { id: 'force', textKey: 'tutorial.allegiance.s3', target: anchor.seat(BEGINNER), completes: { kind: 'next' } },
    { id: 'bots-hidden', textKey: 'tutorial.allegiance.s4', target: anchor.seat('seat-1'), completes: { kind: 'next' } },
    // Condenses rules.overview.beat4.
    { id: 'win', textKey: 'tutorial.allegiance.s5', completes: { kind: 'next' } },
  ],
};
