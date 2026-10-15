import type { GameReplay, MyGames } from 'protocol';
import { UserRecord } from '../persistence/records';
import { Repositories } from '../persistence/repositories';
import { toGameReplay, toGameSummary } from '../views/history';

// What a registered user may read about games that are over: their list, and
// the replay of one they played.
export class GameHistory {
  constructor(private readonly repos: Repositories) {}

  async myGames(user: UserRecord): Promise<MyGames> {
    return { games: (await this.repos.games.listFinishedForUser(user.id)).map(toGameSummary) };
  }

  // Null when the user did not play a finished game with that id (it may be
  // unknown, someone else's, running or aborted: the caller can't tell which).
  async replay(user: UserRecord, gameId: string): Promise<GameReplay | null> {
    const entry = await this.repos.games.findFinishedForUser(user.id, gameId);
    if (!entry) return null;
    const [actions, chat] = await Promise.all([this.repos.games.listActions(gameId), this.repos.chat.listForGame(gameId)]);
    return toGameReplay(entry.game, actions, chat);
  }
}
