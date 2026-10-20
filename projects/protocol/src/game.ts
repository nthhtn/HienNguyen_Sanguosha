import type { Static } from '@sinclair/typebox';
import type { Action, DecisionKind, EngineEvent, GameResult, GameState } from 'engine';
import type { SoloRoomBodySchema } from './schemas/game';

// A game as one seat may see it: the engine's redaction without the RNG (it
// holds the seed) and without the log (sent as `events`).
export type SeatView = Omit<GameState, 'rng' | 'log'>;

export type GameStatus = 'running' | 'finished' | 'aborted' | 'broken';
// Who made a stored move: a seated person, a bot seat, the clock running out,
// or a bot playing a person's seat.
export type ActionSource = 'human' | 'bot' | 'timeout' | 'takeover';

// The clock that is running, in server time. On a bot-played seat it is the
// bot's move delay, which drives the "thinking…" indicator.
export interface GameClockView {
  seatId: string;
  kind: DecisionKind;
  endsAt: number;
  totalSeconds: number;
  serverNow: number;
  // Set when this is a bot's move delay, not a decision clock a person can act on.
  bot?: true;
}

export interface GameUpdate {
  gameId: string;
  // How many actions the game has applied.
  seq: number;
  view: SeatView;
  // For the receiving seat; empty unless it must act now.
  legalActions: Action[];
  // The index of events[0] in the full log. A client whose log is not this long
  // asks for game.resync, which answers with logFrom 0.
  logFrom: number;
  events: EngineEvent[];
  clock: GameClockView | null;
  // A solo game while its player is away: nothing moves.
  paused: boolean;
}

export interface GameSeatView {
  seatId: string;
  playerId: string;
  name: string;
}

// How the room's last game ended. 'broken': the engine failed during play.
// 'outdated': the game could not be restored after a server update.
export type GameOutcome = 'finished' | 'broken' | 'outdated';

export interface LastGame {
  gameId: string;
  outcome: GameOutcome;
  result: GameResult | null;
  seats: GameSeatView[];
}

export type SoloRoomBody = Static<typeof SoloRoomBodySchema>;

export const GAME_OUTCOME_MESSAGES: Record<Exclude<GameOutcome, 'finished'>, string> = {
  broken: 'This game hit an error and has stopped',
  outdated: "This game can't continue after an update",
};
