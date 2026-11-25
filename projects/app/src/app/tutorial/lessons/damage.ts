import { getActiveSeatId } from 'engine';
import { emptyHand, give, playCard, playableGame, revealGenerals, setGenerals, setTurn } from '../../scenario-kit/recipe';
import { anchor } from '../anchors';
import { Lesson } from '../tutorial-types';
import { definitionOf } from './lesson-kit';

// Seed 7: the table's first turn belongs to seat-0, the beginner.
const SEED = 7;
const BEGINNER = 'seat-0';
// The seat before the beginner attacks it, then ends its turn so the beginner's turn (and its Peach) follows.
const ATTACKER = 'seat-3';

// Lesson 5: a Sha that is not answered removes 1 HP, then Peach recovers it. The beginner is Zhang Fei and Guan Yu
// (HP 4, no skill that asks on damage) holding only a Peach; the attacker's Sha is already played, so the lesson opens on
// the beginner's response window. Its turn follows the attacker's, so the Peach can be played.
export const DAMAGE_LESSON: Lesson = {
  id: 'damage',
  group: 'basics',
  titleKey: 'tutorial.damage.title',
  summaryKey: 'tutorial.damage.summary',
  seatCount: 4,
  build: (registry) => {
    let state = playableGame(registry, SEED, 4);
    state = revealGenerals(setGenerals(state, registry, BEGINNER, 'kingdomWars:zhang-fei', 'kingdomWars:guan-yu'), BEGINNER);
    state = setTurn(state, ATTACKER, 'Play');
    for (const seat of state.seats) state = emptyHand(state, seat.id);
    return playCard(give(give(state, ATTACKER, ['sha']), BEGINNER, ['peach']), registry, ATTACKER, 'sha', [BEGINNER]);
  },
  steps: [
    // Condenses rules.response.sha2.
    { id: 'attacked', textKey: 'tutorial.damage.s1', target: anchor.responseDialog(), completes: { kind: 'next' } },
    {
      id: 'pass',
      textKey: 'tutorial.damage.s2',
      target: anchor.responseDialog(),
      completes: { kind: 'action', allow: [{ kind: 'PassAction', match: (a) => a.seatId === BEGINNER }] },
    },
    {
      // Condenses rules.damage.hpText, rules.damage.hpCap and rules.damage.hpEx.
      id: 'hp-drops',
      textKey: 'tutorial.damage.s3',
      target: anchor.hp(BEGINNER),
      completes: { kind: 'state', reached: (s) => s.seats[0].combinedHp === s.seats[0].maxCombinedHp - 1 },
    },
    {
      id: 'turn-passes',
      textKey: 'tutorial.damage.s3b',
      target: anchor.phaseIndicator(),
      completes: { kind: 'state', reached: (s) => s.phase === 'Play' && getActiveSeatId(s) === BEGINNER },
      bot: [{ seatId: ATTACKER, pick: (legal) => legal.find((a) => a.kind === 'EndPhaseAction') }],
    },
    {
      id: 'play-peach',
      textKey: 'tutorial.damage.s4',
      // A card's Play button shows on hover on a computer, so the card is ringed; on the phone it is tapped first.
      target: [anchor.targetSeat(BEGINNER), anchor.handCard('peach')],
      phone: { target: [anchor.targetSeat(BEGINNER), anchor.playButton('peach'), anchor.handCard('peach')], textKey: 'tutorial.damage.s4p' },
      completes: { kind: 'action', allow: [{ kind: 'PlayCardAction', match: (a, s) => a.kind === 'PlayCardAction' && a.seatId === BEGINNER && definitionOf(s, a.cardInstanceId) === 'peach' }] },
    },
    {
      id: 'hp-recovers',
      textKey: 'tutorial.damage.s5',
      target: anchor.hp(BEGINNER),
      completes: { kind: 'state', reached: (s) => s.seats[0].combinedHp === s.seats[0].maxCombinedHp },
    },
    { id: 'maximum', textKey: 'tutorial.damage.s6', target: anchor.hp(BEGINNER), completes: { kind: 'next' } },
  ],
};
