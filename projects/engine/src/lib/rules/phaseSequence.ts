import { GameState, Phase, Seat, Turn } from '../domain/types';
import { cardsOverHandLimit } from './handLimit';

export const PHASE_ORDER: readonly Phase[] = ['Start', 'Judgment', 'Draw', 'Play', 'Discard', 'End'];

// Whether the current phase must wait for the turn owner to act: always in
// Play, and in Discard while they are over their hand limit. Every other phase
// passes on its own once its entry triggers have resolved.
export function phaseWaitsForPlayer(state: GameState): boolean {
  if (state.phase === 'Play') return true;
  if (state.phase === 'Discard') return cardsOverHandLimit(state, state.turn.ownerSeatId) > 0;
  return false;
}

// The turn flag that makes the turn owner skip `phase` (e.g. 'skipPlay').
export function skipFlagOf(phase: Phase): string {
  return `skip${phase}`;
}

// The next phase, passing over any phase flagged to skip this turn (`skipped`,
// in order). After End, the next turn's Start: a new turn has no flags.
export function advancePhaseOrTurn(state: GameState): { phase: Phase; turn: Turn; skipped: Phase[] } {
  const currentIndex = PHASE_ORDER.indexOf(state.phase);
  // An unrecognized phase means a real bug upstream, not a case to paper over
  // by silently restarting the phase sequence.
  if (currentIndex === -1) {
    throw new Error(`Unrecognized phase: ${state.phase}`);
  }
  if (currentIndex === PHASE_ORDER.length - 1) {
    return { phase: PHASE_ORDER[0], turn: advanceTurn(state.turn, state.seats), skipped: [] };
  }
  const skipped: Phase[] = [];
  let next = currentIndex + 1;
  // End is never skipped, so a turn always ends.
  while (next < PHASE_ORDER.length - 1 && state.turn.flags?.[skipFlagOf(PHASE_ORDER[next])]) {
    skipped.push(PHASE_ORDER[next]);
    next++;
  }
  return { phase: PHASE_ORDER[next], turn: state.turn, skipped };
}

function advanceTurn(turn: Turn, seats: Seat[]): Turn {
  if (turn.extraTurnStack.length > 0) {
    const nextSeatId = turn.extraTurnStack[turn.extraTurnStack.length - 1];
    return {
      turnNumber: turn.turnNumber + 1,
      ownerSeatId: nextSeatId,
      extraTurnStack: turn.extraTurnStack.slice(0, -1),
    };
  }
  const ordered = [...seats].sort((a, b) => a.index - b.index);
  const currentIdx = ordered.findIndex((s) => s.id === turn.ownerSeatId);
  if (currentIdx === -1) {
    throw new Error(`Cannot advance the turn: unknown current turn owner ${turn.ownerSeatId}`);
  }
  // Walk clockwise from the current owner's seat position rather than from its
  // position within the living-seats subsequence: the current owner may itself
  // have just been eliminated, and turn order must still continue from where it
  // sat rather than restarting at the first living seat.
  for (let step = 1; step <= ordered.length; step++) {
    const candidate = ordered[(currentIdx + step) % ordered.length];
    if (!candidate.eliminated) {
      return { turnNumber: turn.turnNumber + 1, ownerSeatId: candidate.id, extraTurnStack: [] };
    }
  }
  // Zero living seats. The mode's win condition should already have ended the
  // game before this point, so reaching here is a bug worth reporting loudly
  // rather than falling back to an arbitrary seat.
  throw new Error('Cannot advance the turn: every seat is eliminated');
}
