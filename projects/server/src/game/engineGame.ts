import { createHash } from 'node:crypto';
import { kingdomWarMode } from 'content';
import { createGame, createRng, getActiveSeatId, getLegalActions, isOfferedAction, resolve, shuffle } from 'engine';
import type { Action, ContentRegistry, EngineContext, GameRules, GameState } from 'engine';
import type { MemberKind } from 'protocol';
import { GameActionRecord, GameRecord, GameSeat } from '../persistence/records';

// Seating draws from its own stream of the seed, apart from the game's own
// (spec "Start Game, step by step").
export const SEATING_SALT = 0x5eed5ea7;

export function engineContext(registry: ContentRegistry): EngineContext {
  return { registry, mode: kingdomWarMode };
}

export interface SeatCandidate {
  id: string;
  name: string;
  kind: MemberKind;
}

// Members (in join order) to seats seat-0, seat-1, … in a seeded random order.
export function drawSeats(members: readonly SeatCandidate[], seed: number): GameSeat[] {
  const { items } = shuffle(members, createRng(seed ^ SEATING_SALT));
  return items.map((member, i) => ({ seatId: `seat-${i}`, roomPlayerId: member.id, name: member.name, kind: member.kind }));
}

// The engine's opening state with each seat's name and kind, as
// GameService.startGame sets them.
export function openingState(ctx: EngineContext, seed: number, seats: readonly GameSeat[], rules: GameRules): GameState {
  const created = createGame(ctx.mode, ctx.registry, seats.map((s) => s.seatId), seed, rules);
  const players = created.players.map((player) => {
    const seat = seats.find((s) => s.seatId === player.seatId);
    return seat ? { ...player, kind: seat.kind, name: seat.name } : player;
  });
  return { ...created, players };
}

export function stateHash(state: GameState): string {
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}

// A player's move that the engine refuses or never offered. Nothing changed.
export class IllegalMoveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalMoveError';
  }
}

// A seated player's actions as one move. Before each action, its seat must be
// the one to act and the action must be one the engine offers it. Returns the
// state after each action, or throws IllegalMoveError and changes nothing.
export function applyMove(ctx: EngineContext, state: GameState, seatId: string, actions: readonly Action[]): GameState[] {
  const steps: GameState[] = [];
  let current = state;
  for (const action of actions) {
    if (getActiveSeatId(current) !== seatId || action.seatId !== seatId) throw new IllegalMoveError(`Seat ${seatId} can't act now`);
    if (!isOfferedAction(action, getLegalActions(current, seatId, ctx.registry))) throw new IllegalMoveError(`${action.kind} was not offered to ${seatId}`);
    try {
      current = resolve(current, action, ctx).state;
    } catch (err) {
      throw new IllegalMoveError(err instanceof Error ? err.message : String(err));
    }
    steps.push(current);
  }
  return steps;
}

// Actions the server chose itself (a bot's, or a timeout's defaults). No
// checks: the engine's own errors are thrown as they are.
export function applyActions(ctx: EngineContext, state: GameState, actions: readonly Action[]): GameState[] {
  const steps: GameState[] = [];
  let current = state;
  for (const action of actions) {
    current = resolve(current, action, ctx).state;
    steps.push(current);
  }
  return steps;
}

// Rebuilds a game from its stored actions. With `checkHashes`, every step's
// hash must match the stored one (spec "Restore on startup").
export function replay(ctx: EngineContext, game: GameRecord, actions: readonly GameActionRecord[], checkHashes: boolean): GameState {
  let state = openingState(ctx, game.seed, game.seats, game.rules);
  actions.forEach((row, i) => {
    if (row.seq !== i + 1) throw new Error(`Action ${i + 1} is missing`);
    state = resolve(state, row.action, ctx).state;
    if (checkHashes && stateHash(state) !== row.stateHash) throw new Error(`State hash differs after action ${row.seq}`);
  });
  return state;
}
