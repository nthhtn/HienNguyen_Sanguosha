import type { Action, GameResult, GameRules } from 'engine';
import type { ChatMessage } from './chat';
import type { ActionSource } from './game';
import type { MemberKind } from './rooms';

export interface GameSummaryPlayer {
  seatId: string;
  name: string;
  kind: MemberKind;
}

// One row of My Games: a finished game you played in.
export interface GameSummary {
  gameId: string;
  // When the game ended, in epoch milliseconds.
  finishedAt: number;
  players: GameSummaryPlayer[];
  result: GameResult | null;
  // The seat you played.
  yourSeat: string;
}

// GET /api/me/games: your finished games, newest first.
export interface MyGames {
  games: GameSummary[];
}

export interface ReplaySeat {
  seatId: string;
  roomPlayerId: string;
  name: string;
  kind: MemberKind;
}

export interface ReplayAction {
  seq: number;
  seatId: string;
  source: ActionSource;
  action: Action;
  stateHash: string;
}

// GET /api/games/:id/replay: enough to rebuild a finished game exactly. The
// seed is safe to reveal because the game is over.
export interface GameReplay {
  seed: number;
  seats: ReplaySeat[];
  rules: GameRules;
  buildId: string;
  actions: ReplayAction[];
  // Only the messages sent while this game ran.
  chat: ChatMessage[];
}
