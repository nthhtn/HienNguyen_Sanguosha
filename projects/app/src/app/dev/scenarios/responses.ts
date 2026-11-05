import { ContentRegistry, GameState } from 'engine';
import { BoardScenario } from '../scenario';
import { act, emptyHand, give, playCard, playableGame, setHp, setTurn, stepUntil } from '../recipe';

const SEED = 7;

// A 4-seat table where `attacker` is in its Play Phase and every seat holds nothing, so only the cards a
// recipe gives can answer a window.
function bareTable(registry: ContentRegistry, attacker = 'seat-1'): GameState {
  let state = setTurn(playableGame(registry, SEED, 4), attacker, 'Play');
  for (const seatId of ['seat-0', 'seat-1', 'seat-2', 'seat-3']) state = emptyHand(state, seatId);
  return state;
}

// `attacker` plays `card` at `targets`; seat-0 holds `answers`. A Tool that hits every other seat is asked
// seat by seat from the attacker on, so seat-3 (right before seat-0) makes seat-0 the first to answer.
function attacked(card: string, targets: string[], answers: string[], attacker = 'seat-1') {
  return (registry: ContentRegistry): GameState =>
    playCard(give(give(bareTable(registry, attacker), attacker, [card]), 'seat-0', answers), registry, attacker, card, targets);
}

const waitingOn = (state: GameState, seatId: string, answer: string): boolean =>
  state.pendingResponse?.respondingSeatId === seatId && (state.pendingResponse.allowedCardIds ?? []).includes(answer);

export const RESPONSE_SCENARIOS: BoardScenario[] = [
  {
    kind: 'board',
    id: 'respond-sha',
    group: 'Response Windows',
    title: 'Respond to Sha',
    description: 'A bot used Sha on you and you hold a Shan.',
    seatCount: 4,
    build: attacked('sha', ['seat-0'], ['shan']),
    reaches: (s) => waitingOn(s, 'seat-0', 'shan'),
  },
  {
    kind: 'board',
    id: 'respond-wuxie',
    group: 'Response Windows',
    title: 'Wuxie on a Tool',
    description: 'A bot used Steal on you and you hold a Wuxie.',
    seatCount: 4,
    build: attacked('steal', ['seat-0'], ['wuxie']),
    reaches: (s) => waitingOn(s, 'seat-0', 'wuxie'),
  },
  {
    kind: 'board',
    id: 'respond-duel',
    group: 'Response Windows',
    title: 'Duel',
    description: 'A bot challenged you to a Duel and you hold a Sha.',
    seatCount: 4,
    build: attacked('duel', ['seat-0'], ['sha']),
    reaches: (s) => waitingOn(s, 'seat-0', 'sha'),
  },
  {
    kind: 'board',
    id: 'respond-barbarians',
    group: 'Response Windows',
    title: 'Barbarians',
    description: 'A bot used Barbarians and you hold a Sha.',
    seatCount: 4,
    build: attacked('barbarians', [], ['sha'], 'seat-3'),
    reaches: (s) => waitingOn(s, 'seat-0', 'sha'),
  },
  {
    kind: 'board',
    id: 'respond-arrows',
    group: 'Response Windows',
    title: 'Hail of Arrows',
    description: 'A bot used Hail of Arrows and you hold a Shan.',
    seatCount: 4,
    build: attacked('hail-of-arrows', [], ['shan'], 'seat-3'),
    reaches: (s) => waitingOn(s, 'seat-0', 'shan'),
  },
  {
    kind: 'board',
    id: 'respond-dying-peach',
    group: 'Response Windows',
    title: 'Dying with a Peach',
    description: 'You are on 1 HP, a bot’s Sha lands and you hold a Peach.',
    seatCount: 4,
    build: (registry) => {
      const hit = playCard(give(setHp(give(bareTable(registry), 'seat-0', ['peach']), 'seat-0', 1), 'seat-1', ['sha']), registry, 'seat-1', 'sha', ['seat-0']);
      const passed = act(hit, registry, { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: hit.pendingResponse!.id });
      // A General's own ask (such as a revival skill) can come first: decline it, then let the table's empty hands pass.
      const ask = passed.pendingChoice;
      const declined = ask?.options.some((o) => o.id === 'decline')
        ? act(passed, registry, { kind: 'ChooseOptionAction', seatId: ask.seatId, choiceId: ask.id, optionId: 'decline' })
        : passed;
      return stepUntil(declined, registry, (s) => waitingOn(s, 'seat-0', 'peach'));
    },
    reaches: (s) => s.seats[0].combinedHp <= 0 && waitingOn(s, 'seat-0', 'peach'),
  },
  {
    kind: 'board',
    id: 'respond-discard',
    group: 'Response Windows',
    title: 'Discard to the Hand Limit',
    description: 'Your Discard Phase with more cards than your HP allows.',
    seatCount: 4,
    build: (registry) => {
      const state = give(setTurn(playableGame(registry, SEED, 4), 'seat-0', 'Play'), 'seat-0', ['sha', 'sha', 'shan', 'peach', 'steal', 'duel', 'wuxie']);
      return act(state, registry, { kind: 'EndPhaseAction', seatId: 'seat-0' });
    },
    reaches: (s) => s.phase === 'Discard' && s.turn.ownerSeatId === 'seat-0',
  },
];
