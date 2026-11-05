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
    title: 'Own Turn',
    description: 'Your Play Phase with a full hand: Sha, Shan, Peach, Steal, Duel and Wuxie.',
    seatCount: 4,
    build: (registry) => give(setTurn(playableGame(registry, SEED, 4), 'seat-0', 'Play'), 'seat-0', FULL_HAND),
    reaches: (s) => playPhaseOf(s, 'seat-0') && FULL_HAND.every((id) => handOf(s, 'seat-0').includes(id)),
  },
  {
    kind: 'board',
    id: 'play-other-turn',
    group: 'Play Board',
    title: 'Another Seat’s Turn',
    description: 'A bot’s Play Phase while you wait. The bot moves as soon as the board loads.',
    seatCount: 4,
    botDue: true,
    build: (registry) => setTurn(playableGame(registry, SEED, 4), 'seat-1', 'Play'),
    reaches: (s) => playPhaseOf(s, 'seat-1'),
  },
  {
    kind: 'board',
    id: 'play-equipment',
    group: 'Play Board',
    title: 'Equipment and Judgment Area',
    description: 'You wear a Weapon, an Armor and a Mount, and Lightning waits in your judgment area.',
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
    title: 'Six Seats',
    description: 'A six-seat table, your Play Phase.',
    seatCount: 6,
    build: (registry) => give(setTurn(playableGame(registry, SEED, 6), 'seat-0', 'Play'), 'seat-0', ['sha', 'shan', 'peach']),
    reaches: (s) => s.seats.length === 6 && playPhaseOf(s, 'seat-0'),
  },
];
