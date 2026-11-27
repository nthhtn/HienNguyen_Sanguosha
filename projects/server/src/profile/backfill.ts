import type { EngineContext, GameResult } from 'engine';
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
// server runs. A game that no longer replays, or replays to another ending, is logged and
// marked, so it is not replayed again at every start.
export async function backfillSeatResults(deps: BackfillDeps): Promise<{ filled: number; failed: number }> {
  const replay = deps.replay ?? replayGame;
  let filled = 0;
  let failed = 0;
  for (const { game, userIds } of await deps.repos.games.listUnrecordedFinishedGames()) {
    const fail = async (message: string, err?: unknown) => {
      failed += 1;
      deps.log(message, err);
      await deps.repos.games.markSeatResultsFailed(game.id, new Date());
    };
    try {
      const state = replay(deps.ctx, game, await deps.repos.games.listActions(game.id), false);
      // Without hash checks an old build's game can replay to another ending: its Generals would not be the ones played.
      if (!sameOutcome(state.result, game.result)) {
        await fail(`Game ${game.id} replays to a result that differs from the stored result, so its seat results were not filled in`);
        continue;
      }
      await deps.repos.games.saveSeatResults(buildSeatResults({ gameId: game.id, finalSeats: finalSeatViews(state), result: game.result, userIds }));
      filled += 1;
    } catch (err) {
      await fail(`Game ${game.id} cannot be replayed, so its seat results were not filled in`, err);
    }
  }
  return { filled, failed };
}

const sameOutcome = (replayed: GameResult | null | undefined, stored: GameResult | null): boolean =>
  !!replayed && !!stored && JSON.stringify([replayed.winningSeatIds, replayed.losingSeatIds]) === JSON.stringify([stored.winningSeatIds, stored.losingSeatIds]);
