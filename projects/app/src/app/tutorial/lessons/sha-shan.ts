import { emptyHand, give, playableGame, revealGenerals, setGenerals, setTurn } from '../../scenario-kit/recipe';
import { anchor } from '../anchors';
import { Lesson } from '../tutorial-types';
import { definitionOf, handOf, isRespondWith, playOn, respondWith } from './lesson-kit';

// Seed 7: the table's first turn belongs to seat-0, the beginner.
const SEED = 7;
const BEGINNER = 'seat-0';
// The seat next to the beginner: it answers the beginner's Sha, then attacks the beginner on its own turn.
const NEIGHBOUR = 'seat-1';

// Lesson 4: attack a bot (it answers with Shan), then a bot attacks the beginner who answers with Shan. The beginner
// holds Sha, Shan and Peach in the Play Phase at 3 HP; the neighbour holds a Shan and a Sha and nobody else holds anything.
export const SHA_SHAN_LESSON: Lesson = {
  id: 'sha-shan',
  group: 'basics',
  titleKey: 'tutorial.shaShan.title',
  summaryKey: 'tutorial.shaShan.summary',
  seatCount: 4,
  build: (registry) => {
    let state = playableGame(registry, SEED, 4);
    state = revealGenerals(setGenerals(state, registry, BEGINNER, 'kingdomWars:cao-cao', 'kingdomWars:guo-jia'), BEGINNER);
    state = setTurn(state, BEGINNER, 'Play');
    for (const seat of state.seats) state = emptyHand(state, seat.id);
    return give(give(state, BEGINNER, ['sha', 'shan', 'peach']), NEIGHBOUR, ['shan', 'sha']);
  },
  steps: [
    // Condenses rules.response.sha1.
    { id: 'intro', textKey: 'tutorial.shaShan.s1', target: anchor.hand(), completes: { kind: 'next' } },
    {
      id: 'play-sha',
      textKey: 'tutorial.shaShan.s2',
      // A card's Play button shows on hover on a computer, so the card is ringed; the menu's seat takes over once it opens.
      target: [anchor.targetSeat(NEIGHBOUR), anchor.handCard('sha')],
      // On the phone the card is tapped first and its Play button then sits in the action column.
      phone: { target: [anchor.targetSeat(NEIGHBOUR), anchor.playButton('sha'), anchor.handCard('sha')], textKey: 'tutorial.shaShan.s2p' },
      completes: {
        kind: 'action',
        allow: [
          {
            kind: 'PlayCardAction',
            match: (a, s) =>
              a.kind === 'PlayCardAction' && a.seatId === BEGINNER && definitionOf(s, a.cardInstanceId) === 'sha' && a.targets.length === 1 && a.targets[0].kind === 'seat' && a.targets[0].seatId === NEIGHBOUR,
          },
        ],
      },
    },
    {
      // Condenses rules.response.sha2, rules.response.playsShan and rules.response.shaNoEffect.
      id: 'dodged',
      textKey: 'tutorial.shaShan.s3',
      target: anchor.actionHistory(),
      completes: { kind: 'state', reached: (s) => !s.pendingResponse && !handOf(s, NEIGHBOUR).includes('shan') },
      bot: [{ seatId: NEIGHBOUR, pick: respondWith('shan') }],
    },
    { id: 'history', textKey: 'tutorial.shaShan.s4', target: anchor.actionHistory(), completes: { kind: 'next' } },
    {
      id: 'end-phase',
      textKey: 'tutorial.shaShan.s5',
      target: anchor.endPhase(),
      completes: { kind: 'action', allow: [{ kind: 'EndPhaseAction', match: (a) => a.seatId === BEGINNER }] },
    },
    {
      id: 'attacked',
      textKey: 'tutorial.shaShan.s6',
      target: anchor.phaseIndicator(),
      completes: { kind: 'state', reached: (s) => s.pendingResponse?.respondingSeatId === BEGINNER },
      bot: [{ seatId: NEIGHBOUR, pick: playOn('sha', BEGINNER) }],
    },
    {
      // Condenses rules.response.sha2 for the beginner.
      id: 'answer',
      textKey: 'tutorial.shaShan.s7',
      target: anchor.responseDialog(),
      completes: { kind: 'action', allow: [{ kind: 'RespondAction', match: (a, s) => a.seatId === BEGINNER && isRespondWith('shan')(a, s) }] },
    },
    { id: 'saved', textKey: 'tutorial.shaShan.s8', target: anchor.actionHistory(), completes: { kind: 'next' } },
  ],
};
