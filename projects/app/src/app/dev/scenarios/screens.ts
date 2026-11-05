import { BoardScenario, ScreenScenario } from '../scenario';
import { GAME_OVER_CASES } from '../game-over-fixtures';
import { freshGame } from '../recipe';
import { getActiveSeatId } from 'engine';

// General selection is a phase of the real board, so it opens the board on a game that has not chosen yet.
const generalSelection: BoardScenario = {
  kind: 'board',
  id: 'general-selection',
  group: 'Other Screens',
  title: 'preview.general-selection.title',
  description: 'preview.general-selection.description',
  seatCount: 4,
  build: (registry) => freshGame(registry, 7, 4),
  reaches: (s) => s.phase === 'GeneralSelection' && getActiveSeatId(s) === 'seat-0',
};

const gameOver = (): ScreenScenario[] =>
  Object.entries(GAME_OVER_CASES).map(([key, c]) => ({
    kind: 'screen',
    id: `over-${key}`,
    group: 'Other Screens',
    title: c.title,
    description: 'preview.over.description',
    component: () => import('../../game-board/game-over').then((m) => m.GameOver),
    inputs: { result: c.result, seats: c.seats, youSeatId: 'seat-0' },
  }));

export const SCREEN_SCENARIOS: (BoardScenario | ScreenScenario)[] = [generalSelection, ...gameOver()];
