import type { GameReplay, GameSummary } from 'protocol';
import { ChatMessageRecord, GameActionRecord, GameRecord, UserGameRecord } from '../persistence/records';
import { toChatMessage } from './chat';

// A row of My Games. A finished game always has a finish time; the start is a
// harmless fallback for the type.
export function toGameSummary({ game, yourSeatId }: UserGameRecord): GameSummary {
  return {
    gameId: game.id,
    finishedAt: (game.finishedAt ?? game.startedAt).getTime(),
    players: game.seats.map((s) => ({ seatId: s.seatId, name: s.name, kind: s.kind })),
    result: game.result,
    yourSeat: yourSeatId,
  };
}

// Everything needed to rebuild a finished game: its seed, seats, rules and
// build, its actions with their state hashes, and the chat sent during it.
export function toGameReplay(game: GameRecord, actions: GameActionRecord[], chat: ChatMessageRecord[]): GameReplay {
  return {
    seed: game.seed,
    seats: game.seats.map((s) => ({ seatId: s.seatId, roomPlayerId: s.roomPlayerId, name: s.name, kind: s.kind })),
    rules: { ...game.rules },
    buildId: game.buildId,
    actions: actions.map((a) => ({ seq: a.seq, seatId: a.seatId, source: a.source, action: a.action, stateHash: a.stateHash })),
    chat: chat.map(toChatMessage),
  };
}
