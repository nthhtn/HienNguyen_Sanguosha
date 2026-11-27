import type { EngineContext } from 'engine';
import { finalSeatViews } from 'protocol';
import { replay as replayGame } from '../game/engineGame';
import { Repositories } from '../persistence/repositories';
import { buildSeatResults } from './seatResults';

export interface BackfillDeps {
  repos: Repositories;
  ctx: EngineContext;
  log: (message: string, err?: unknown) => void;
  // Replaces the engine's replay in tests.
  replay?: typeof replayGame;
}

// Writes seat results for finished games that have none: games that ended
// before seat results existed. Safe to run any number of times, and while the
// server runs. A game that no longer replays is logged and left for the next run.
export async function backfillSeatResults(deps: BackfillDeps): Promise<{ filled: number; failed: number }> {
  const replay = deps.replay ?? replayGame;
  let filled = 0;
  let failed = 0;
  for (const { game, userIds } of await deps.repos.games.listUnrecordedFinishedGames()) {
    try {
      const state = replay(deps.ctx, game, await deps.repos.games.listActions(game.id), false);
      await deps.repos.games.saveSeatResults(buildSeatResults({ gameId: game.id, finalSeats: finalSeatViews(state), result: game.result, userIds }));
      filled += 1;
    } catch (err) {
      failed += 1;
      deps.log(`Game ${game.id} cannot be replayed, so its seat results were not filled in`, err);
    }
  }
  return { filled, failed };
}
