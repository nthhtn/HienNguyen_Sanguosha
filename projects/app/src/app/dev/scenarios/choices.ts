import { ContentRegistry, GameState, getActiveSeatId } from 'engine';
import { BoardScenario } from '../scenario';
import { act, emptyHand, give, placeJudgment, playCard, playableGame, setGenerals, setTurn, windowOf } from '../recipe';

const SEED = 7;
const JI_LING = 'kingdomWars:ji-ling';
const DOUBLE_EDGED = 'kingdomWars:double-edged';

const youAreAsked = (state: GameState): boolean => getActiveSeatId(state) === 'seat-0' && windowOf(state) !== null;

// Ji Ling holds Double Edged: at the start of his Play Phase he may compete with another seat that holds a hand card.
// Seat-0 is in its Draw Phase; drawing opens the ask.
function doubleEdgedAsk(registry: ContentRegistry): GameState {
  let state = setGenerals(setTurn(playableGame(registry, SEED, 4), 'seat-0', 'Draw'), registry, 'seat-0', JI_LING, 'kingdomWars:guan-yu');
  state = give(emptyHand(state, 'seat-1'), 'seat-1', ['sha', 'shan']);
  return act(state, registry, { kind: 'DrawCardsAction', seatId: 'seat-0', count: 2 });
}

// The ask answered Use, and the seat Double Edged competes with picked: you now pick the card to compete with.
const useDoubleEdged = (registry: ContentRegistry): GameState => {
  const ask = doubleEdgedAsk(registry);
  return act(ask, registry, { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: ask.pendingChoice!.id, optionId: 'use' });
};

export const CHOICE_SCENARIOS: BoardScenario[] = [
  {
    kind: 'board',
    id: 'choice-start-popup',
    group: 'Choice Prompts',
    title: 'Start Popup',
    description: 'The start of your turn: the popup that asks which Generals to reveal.',
    seatCount: 4,
    build: (registry) => playableGame(registry, SEED, 4),
    reaches: (s) => s.phase === 'Start' && getActiveSeatId(s) === 'seat-0' && windowOf(s) === null,
  },
  {
    kind: 'board',
    id: 'choice-pick-card',
    group: 'Choice Prompts',
    title: 'Pick a Card from Another Seat',
    description: 'You used Steal on a bot that holds three cards, and now pick the one to take.',
    seatCount: 4,
    build: (registry) => {
      let state = setTurn(playableGame(registry, SEED, 4), 'seat-0', 'Play');
      for (const seatId of ['seat-0', 'seat-1', 'seat-2', 'seat-3']) state = emptyHand(state, seatId);
      return playCard(give(give(state, 'seat-0', ['steal']), 'seat-1', ['sha', 'shan', 'peach']), registry, 'seat-0', 'steal', ['seat-1']);
    },
    reaches: youAreAsked,
  },
  {
    kind: 'board',
    id: 'choice-judgment',
    group: 'Choice Prompts',
    title: 'Judgment Popup',
    description: 'Lightning waits in your judgment area and your Judgment Phase turns its card.',
    seatCount: 4,
    build: (registry) => {
      const state = placeJudgment(setTurn(playableGame(registry, SEED, 4), 'seat-0', 'Start'), 'seat-0', 'lightning');
      return act(state, registry, { kind: 'ConfirmRevealsAction', seatId: 'seat-0', slots: [] });
    },
    reaches: (s) => s.judgmentView !== undefined,
  },
  {
    kind: 'board',
    id: 'choice-skill-optional',
    group: 'Choice Prompts',
    title: 'Optional Skill Ask',
    description: 'Ji Ling’s Double Edged may start your Play Phase: you choose to use it or not.',
    seatCount: 4,
    build: doubleEdgedAsk,
    reaches: (s) => youAreAsked(s) && s.pendingChoice?.reason.kind === 'ability' && s.pendingChoice.reason.abilityId === DOUBLE_EDGED,
  },
  {
    kind: 'board',
    id: 'choice-pick-seat',
    group: 'Choice Prompts',
    title: 'Pick a Seat',
    description: 'You used Double Edged and now pick the seat to compete with.',
    seatCount: 4,
    build: useDoubleEdged,
    reaches: (s) => youAreAsked(s) && s.pendingSelection?.of === 'seats',
  },
  {
    kind: 'board',
    id: 'choice-compete',
    group: 'Choice Prompts',
    title: 'Compete',
    description: 'You picked a seat to compete with and now choose the hand card to compete with.',
    seatCount: 4,
    build: (registry) => {
      const state = useDoubleEdged(registry);
      return act(state, registry, { kind: 'SelectAction', seatId: 'seat-0', selectionId: state.pendingSelection!.id, ids: ['seat-1'] });
    },
    reaches: (s) => youAreAsked(s) && s.pendingSelection?.of === 'cards',
  },
];
