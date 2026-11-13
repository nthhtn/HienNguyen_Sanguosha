import { GameState, getActiveSeatId } from 'engine';
import { BoardScenario } from '../scenario';
import { equip, give, placeJudgment, playableGame, setTurn } from '../recipe';

const SEED = 7;

const cardsOf = (state: GameState, zoneId: string) => state.zones.find((z) => z.id === zoneId)?.cards.map((c) => c.definitionId) ?? [];
const handOf = (state: GameState, seatId: string) => cardsOf(state, `${seatId}:hand`);
const playPhaseOf = (state: GameState, seatId: string) => getActiveSeatId(state) === seatId && state.phase === 'Play';

const FULL_HAND = ['sha', 'sha', 'shan', 'peach', 'steal', 'duel', 'wuxie'];

export const PLAY_BOARD_SCENARIOS: BoardScenario[] = [
  {
    kind: 'board',
    id: 'play-own-turn',
    group: 'Play Board',
    title: 'preview.play-own-turn.title',
    description: 'preview.play-own-turn.description',
    seatCount: 4,
    build: (registry) => give(setTurn(playableGame(registry, SEED, 4), 'seat-0', 'Play'), 'seat-0', FULL_HAND),
    reaches: (s) => playPhaseOf(s, 'seat-0') && FULL_HAND.every((id) => handOf(s, 'seat-0').includes(id)),
  },
  {
    kind: 'board',
    id: 'play-other-turn',
    group: 'Play Board',
    title: 'preview.play-other-turn.title',
    description: 'preview.play-other-turn.description',
    seatCount: 4,
    botDue: true,
    build: (registry) => setTurn(playableGame(registry, SEED, 4), 'seat-1', 'Play'),
    reaches: (s) => playPhaseOf(s, 'seat-1'),
  },
  {
    kind: 'board',
    id: 'play-equipment',
    group: 'Play Board',
    title: 'preview.play-equipment.title',
    description: 'preview.play-equipment.description',
    seatCount: 4,
    build: (registry) => {
      let state = setTurn(playableGame(registry, SEED, 4), 'seat-0', 'Play');
      for (const id of ['crossbow', 'eight-trigrams', 'red-hare']) state = equip(state, 'seat-0', id);
      return give(placeJudgment(state, 'seat-0', 'lightning'), 'seat-0', ['sha', 'peach']);
    },
    reaches: (s) =>
      playPhaseOf(s, 'seat-0') &&
      ['crossbow', 'eight-trigrams', 'red-hare'].every((id) => cardsOf(s, 'seat-0:equip').includes(id)) &&
      cardsOf(s, 'seat-0:judgment').includes('lightning'),
  },
  {
    kind: 'board',
    id: 'play-six-seats',
    group: 'Play Board',
    title: 'preview.play-six-seats.title',
    description: 'preview.play-six-seats.description',
    seatCount: 6,
    build: (registry) => give(setTurn(playableGame(registry, SEED, 6), 'seat-0', 'Play'), 'seat-0', ['sha', 'shan', 'peach']),
    reaches: (s) => s.seats.length === 6 && playPhaseOf(s, 'seat-0'),
  },
  {
    kind: 'board',
    id: 'phone-4',
    group: 'Play Board',
    title: 'preview.phone-4.title',
    description: 'preview.phone-4.description',
    seatCount: 4,
    build: (registry) => {
      let state = setTurn(playableGame(registry, SEED, 4), 'seat-0', 'Play');
      for (const id of ['crossbow', 'red-hare']) state = equip(state, 'seat-0', id);
      state = placeJudgment(state, 'seat-1', 'lightning');
      return give(state, 'seat-0', FULL_HAND);
    },
    reaches: (s) => s.seats.length === 4 && playPhaseOf(s, 'seat-0') && FULL_HAND.every((id) => handOf(s, 'seat-0').includes(id)),
  },
  {
    kind: 'board',
    id: 'phone-8',
    group: 'Play Board',
    title: 'preview.phone-8.title',
    description: 'preview.phone-8.description',
    seatCount: 8,
    build: (registry) => {
      let state = setTurn(playableGame(registry, SEED, 8), 'seat-0', 'Play');
      for (const id of ['crossbow', 'red-hare']) state = equip(state, 'seat-0', id);
      state = placeJudgment(state, 'seat-1', 'lightning');
      return give(state, 'seat-0', FULL_HAND);
    },
    reaches: (s) => s.seats.length === 8 && playPhaseOf(s, 'seat-0') && FULL_HAND.every((id) => handOf(s, 'seat-0').includes(id)),
  },
  {
    kind: 'board',
    id: 'phone-12',
    group: 'Play Board',
    title: 'preview.phone-12.title',
    description: 'preview.phone-12.description',
    seatCount: 12,
    build: (registry) => {
      let state = setTurn(playableGame(registry, SEED, 12), 'seat-0', 'Play');
      for (const id of ['crossbow', 'red-hare']) state = equip(state, 'seat-0', id);
      state = placeJudgment(state, 'seat-1', 'lightning');
      return give(state, 'seat-0', FULL_HAND);
    },
    reaches: (s) => s.seats.length === 12 && playPhaseOf(s, 'seat-0') && FULL_HAND.every((id) => handOf(s, 'seat-0').includes(id)),
  },
];
