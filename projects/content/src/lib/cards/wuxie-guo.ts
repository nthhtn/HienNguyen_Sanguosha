import type { CardDefinition, Effect, GameState, PendingResponse } from 'engine';
import { exposedKingdom } from '../shared/kingdom';

// The seat a Wuxie check asks about, when it asks about a Tool (not a counter).
function toolTargetSeatId(pending: PendingResponse): string | null {
  return pending.reason?.kind === 'wuxie' ? pending.reason.target.seatId : null;
}

const livingSeat = (state: GameState, seatId: string) => state.seats.some((s) => s.id === seatId && !s.eliminated);

// Wuxie Kingdom: answers a Wuxie check like a Wuxie. About a Tool on a player
// whose General is exposed, it cancels the Tool there (the check's own cancel)
// and for every later target of that player's Kingdom, read live as each comes.
// Never against a player whose Generals are both hidden. On another counter
// card it acts as a plain Wuxie.
export const wuxieGuoCard: CardDefinition = {
  id: 'wuxie-guo',
  name: 'Wuxie Kingdom',
  category: 'tool',
  legalPlayTargets: () => [], // response only
  answerCondition: (state, pending) => {
    const seatId = toolTargetSeatId(pending);
    if (seatId === null) return true; // a counter: as a plain Wuxie
    return livingSeat(state, seatId) && exposedKingdom(state, seatId) !== null;
  },
  play: (state, ctx): Effect[] => {
    const reason = ctx.answering?.reason;
    if (reason?.kind !== 'wuxie') return [];
    const kingdom = exposedKingdom(state, reason.target.seatId);
    if (kingdom === null) return [];
    return [{ kind: 'CancelToolForKingdomEffect', tool: reason.tool, kingdom, targetSeatId: reason.target.seatId }];
  },
};
