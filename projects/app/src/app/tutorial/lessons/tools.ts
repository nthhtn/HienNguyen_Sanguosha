import { emptyHand, equip, give, playableGame, revealGenerals, setGenerals, setTurn } from '../../scenario-kit/recipe';
import { anchor } from '../anchors';
import { Lesson } from '../tutorial-types';
import { picksOption, playsCard } from './lesson-kit';

const SEED = 7;
const BEGINNER = 'seat-0';
// The seat next to the beginner, at distance 1 as Steal needs. It holds one card, so what Steal takes is certain.
const NEIGHBOUR = 'seat-1';
// The seat across the table. It holds no card in hand and wears one Weapon, so what Break discards is certain.
const ACROSS = 'seat-2';

// Lesson 7: play two Tools, Steal on the seat next to the beginner and Break on the seat across. Nobody holds a Wuxie, so
// no cancel window opens and each Tool takes effect at once; the lesson names that window without teaching it.
export const TOOLS_LESSON: Lesson = {
  id: 'tools',
  group: 'cards',
  titleKey: 'tutorial.tools.title',
  summaryKey: 'tutorial.tools.summary',
  seatCount: 4,
  build: (registry) => {
    let state = playableGame(registry, SEED, 4);
    state = revealGenerals(setGenerals(state, registry, BEGINNER, 'kingdomWars:cao-cao', 'kingdomWars:guo-jia'), BEGINNER);
    state = setTurn(state, BEGINNER, 'Play');
    for (const seat of state.seats) state = emptyHand(state, seat.id);
    state = equip(state, ACROSS, 'crossbow');
    return give(give(state, BEGINNER, ['steal', 'break']), NEIGHBOUR, ['peach']);
  },
  steps: [
    // Condenses rules.cardTypes.toolsText.
    { id: 'intro', textKey: 'tutorial.tools.s1', target: anchor.hand(), completes: { kind: 'next' } },
    {
      // Condenses rules.distance.range3.
      id: 'play-steal',
      textKey: 'tutorial.tools.s2',
      target: [anchor.targetSeat(NEIGHBOUR), anchor.handCard('steal')],
      phone: { target: [anchor.targetSeat(NEIGHBOUR), anchor.playButton('steal'), anchor.handCard('steal')], textKey: 'tutorial.tools.s2p' },
      completes: { kind: 'action', allow: [playsCard(BEGINNER, 'steal', NEIGHBOUR)] },
    },
    { id: 'pick-steal', textKey: 'tutorial.tools.s3', target: anchor.choiceDialog(), completes: { kind: 'action', allow: [picksOption(BEGINNER)] } },
    { id: 'stolen', textKey: 'tutorial.tools.s4', target: anchor.hand(), completes: { kind: 'next' } },
    {
      id: 'play-break',
      textKey: 'tutorial.tools.s5',
      target: [anchor.targetSeat(ACROSS), anchor.handCard('break')],
      phone: { target: [anchor.targetSeat(ACROSS), anchor.playButton('break'), anchor.handCard('break')], textKey: 'tutorial.tools.s5p' },
      completes: { kind: 'action', allow: [playsCard(BEGINNER, 'break', ACROSS)] },
    },
    { id: 'pick-break', textKey: 'tutorial.tools.s6', target: anchor.choiceDialog(), completes: { kind: 'action', allow: [picksOption(BEGINNER)] } },
    { id: 'broken', textKey: 'tutorial.tools.s7', target: anchor.actionHistory(), phone: { target: anchor.historyButton(), textKey: 'tutorial.tools.s7p' }, completes: { kind: 'next' } },
    // Names the Wuxie check; the next lesson teaches it.
    { id: 'answer', textKey: 'tutorial.tools.s8', completes: { kind: 'next' } },
  ],
};
