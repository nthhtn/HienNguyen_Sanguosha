import { BoardScenario, ScreenScenario } from '../scenario';
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

// One page for every ending: the page itself carries the switcher.
const gameOver: ScreenScenario = {
  kind: 'screen',
  id: 'game-over',
  group: 'Other Screens',
  title: 'preview.game-over.title',
  description: 'preview.game-over.description',
  component: () => import('../game-over-preview').then((m) => m.GameOverPreview),
};

export const SCREEN_SCENARIOS: (BoardScenario | ScreenScenario)[] = [generalSelection, gameOver];
