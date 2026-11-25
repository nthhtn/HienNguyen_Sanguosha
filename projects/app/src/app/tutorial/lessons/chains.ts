import { emptyHand, give, playableGame, revealGenerals, setGenerals, setTurn } from '../../scenario-kit/recipe';
import { anchor } from '../anchors';
import { Lesson } from '../tutorial-types';
import { passes, playsCard } from './lesson-kit';

const SEED = 7;
const BEGINNER = 'seat-0';
// The two seats the beginner chains, one on each side: both are at distance 1, inside the range of a Fire Attack.
const FIRST = 'seat-1';
const SECOND = 'seat-3';

// Lesson 10: chain two bots with Chains, hit one with a Fire Attack and watch the damage pass to the other. The bots hold
// no card, so the one that is hit cannot answer and the damage is certain.
export const CHAINS_LESSON: Lesson = {
  id: 'chains',
  group: 'effects',
  titleKey: 'tutorial.chains.title',
  summaryKey: 'tutorial.chains.summary',
  seatCount: 4,
  build: (registry) => {
    let state = playableGame(registry, SEED, 4);
    state = revealGenerals(setGenerals(state, registry, BEGINNER, 'kingdomWars:cao-cao', 'kingdomWars:guo-jia'), BEGINNER);
    state = setTurn(state, BEGINNER, 'Play');
    for (const seat of state.seats) state = emptyHand(state, seat.id);
    return give(state, BEGINNER, ['chains', 'fire-attack']);
  },
  steps: [
    // Condenses rules.chains.lead.
    { id: 'intro', textKey: 'tutorial.chains.s1', target: anchor.hand(), completes: { kind: 'next' } },
    {
      // Condenses rules.chains.chainText. Chains is played through a window that picks the seats, so the step rings it once it
      // is open, then the menu item that opens it (the Play menu also holds Recast), then the Play button, then the card.
      id: 'play-chains',
      textKey: 'tutorial.chains.s2',
      target: [anchor.targetsDialog(), anchor.pickTargets(), anchor.playButton('chains'), anchor.handCard('chains')],
      phone: { textKey: 'tutorial.chains.s2p' },
      completes: {
        kind: 'action',
        allow: [
          {
            kind: 'PlayCardAction',
            match: (a, s) => {
              if (a.kind !== 'PlayCardAction' || !playsCard(BEGINNER, 'chains').match?.(a, s)) return false;
              const seats = a.targets.map((t) => (t.kind === 'seat' ? t.seatId : '')).sort();
              return seats.length === 2 && seats[0] === FIRST && seats[1] === SECOND;
            },
          },
        ],
      },
    },
    { id: 'chained', textKey: 'tutorial.chains.s3', target: [anchor.chainBadge(FIRST), anchor.seat(FIRST)], completes: { kind: 'next' } },
    {
      id: 'play-fire',
      textKey: 'tutorial.chains.s4',
      target: [anchor.targetSeat(FIRST), anchor.handCard('fire-attack')],
      phone: { target: [anchor.targetSeat(FIRST), anchor.playButton('fire-attack'), anchor.handCard('fire-attack')], textKey: 'tutorial.chains.s4p' },
      completes: { kind: 'action', allow: [playsCard(BEGINNER, 'fire-attack', FIRST)] },
    },
    {
      // Condenses rules.chains.waveText.
      id: 'wave',
      textKey: 'tutorial.chains.s5',
      target: anchor.actionHistory(),
      phone: { target: anchor.historyButton(), textKey: 'tutorial.chains.s5p' },
      completes: {
        kind: 'state',
        reached: (s) => {
          const hit = (id: string) => s.seats.find((x) => x.id === id)!.combinedHp < s.seats.find((x) => x.id === id)!.maxCombinedHp;
          return !s.pendingResponse && hit(FIRST) && hit(SECOND);
        },
      },
      bot: [{ seatId: FIRST, pick: passes }],
    },
    { id: 'outro', textKey: 'tutorial.chains.s6', target: anchor.hp(FIRST), completes: { kind: 'next' } },
  ],
};
