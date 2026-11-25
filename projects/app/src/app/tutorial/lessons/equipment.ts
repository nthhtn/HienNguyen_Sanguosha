import { emptyHand, give, playableGame, revealGenerals, setGenerals, setTurn } from '../../scenario-kit/recipe';
import { anchor } from '../anchors';
import { Lesson } from '../tutorial-types';
import { passes, playsCard } from './lesson-kit';

const SEED = 7;
const BEGINNER = 'seat-0';
// Six seats, so the seat across the table is three steps away: a range-2 Weapon alone cannot reach it, and neither can
// a Mount alone, but together they do. That is what the lesson shows.
const OPPOSITE = 'seat-3';

const WEAPON = 'black-pommel';
const ARMOR = 'eight-trigrams';
const MOUNT = 'red-hare';

const plays = (definitionId: string, targetSeatId?: string) => playsCard(BEGINNER, definitionId, targetSeatId);

// A card's Play button shows on hover on a computer, so the card is ringed until it appears; on the phone the card is tapped first.
const playTarget = (definitionId: string) => [anchor.playButton(definitionId), anchor.handCard(definitionId)];

// Lesson 6: wear a Weapon, an Armor and a Mount, then attack the seat across the table, which only the Weapon and the
// Mount together bring into reach. The beginner holds the three Equipment cards and a Sha in the Play Phase; the bots hold nothing.
export const EQUIPMENT_LESSON: Lesson = {
  id: 'equipment',
  group: 'cards',
  titleKey: 'tutorial.equipment.title',
  summaryKey: 'tutorial.equipment.summary',
  seatCount: 6,
  build: (registry) => {
    let state = playableGame(registry, SEED, 6);
    state = revealGenerals(setGenerals(state, registry, BEGINNER, 'kingdomWars:cao-cao', 'kingdomWars:guo-jia'), BEGINNER);
    state = setTurn(state, BEGINNER, 'Play');
    for (const seat of state.seats) state = emptyHand(state, seat.id);
    return give(state, BEGINNER, [WEAPON, ARMOR, MOUNT, 'sha']);
  },
  steps: [
    // Condenses rules.cardTypes.equipmentText.
    { id: 'intro', textKey: 'tutorial.equipment.s1', target: anchor.hand(), completes: { kind: 'next' } },
    {
      // Condenses rules.distance.range2.
      id: 'play-weapon',
      textKey: 'tutorial.equipment.s2',
      target: playTarget(WEAPON),
      phone: { textKey: 'tutorial.equipment.s2p' },
      completes: { kind: 'action', allow: [plays(WEAPON)] },
    },
    // Condenses rules.distance.text and rules.distance.range1.
    { id: 'weapon-on', textKey: 'tutorial.equipment.s3', target: anchor.equipment(BEGINNER), completes: { kind: 'next' } },
    {
      // Condenses rules.cardTypes.role.eightTrigrams.
      id: 'play-armor',
      textKey: 'tutorial.equipment.s4',
      target: playTarget(ARMOR),
      phone: { textKey: 'tutorial.equipment.s4p' },
      completes: { kind: 'action', allow: [plays(ARMOR)] },
    },
    {
      // Condenses rules.distance.minus.
      id: 'play-mount',
      textKey: 'tutorial.equipment.s5',
      target: playTarget(MOUNT),
      phone: { textKey: 'tutorial.equipment.s5p' },
      completes: { kind: 'action', allow: [plays(MOUNT)] },
    },
    // Condenses rules.distance.minus and rules.distance.range1.
    { id: 'reach', textKey: 'tutorial.equipment.s6', target: anchor.equipment(BEGINNER), completes: { kind: 'next' } },
    {
      id: 'play-sha',
      textKey: 'tutorial.equipment.s7',
      target: [anchor.targetSeat(OPPOSITE), anchor.handCard('sha')],
      phone: { target: [anchor.targetSeat(OPPOSITE), anchor.playButton('sha'), anchor.handCard('sha')], textKey: 'tutorial.equipment.s7p' },
      completes: { kind: 'action', allow: [plays('sha', OPPOSITE)] },
    },
    {
      // Condenses rules.response.shaDamage.
      id: 'hit',
      textKey: 'tutorial.equipment.s8',
      target: anchor.actionHistory(),
      completes: { kind: 'state', reached: (s) => !s.pendingResponse && s.seats.find((x) => x.id === OPPOSITE)!.combinedHp < s.seats.find((x) => x.id === OPPOSITE)!.maxCombinedHp },
      bot: [{ seatId: OPPOSITE, pick: passes }],
    },
    { id: 'outro', textKey: 'tutorial.equipment.s9', target: anchor.equipment(BEGINNER), completes: { kind: 'next' } },
  ],
};
