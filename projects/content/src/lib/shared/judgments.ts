import type { ContentRegistry, Effect, GameState, GeneralOwner } from 'engine';
import { livingSeatOrderFrom, skillsInPlay } from 'engine';
import { handOf } from './queries';

type Shown = Extract<Effect, { kind: 'JudgmentShownEffect' }>;

// The skills that may replace a judgment's card (Devil; Wind's Dark Magic
// later). Each holder is asked in seat order, one at a time (nextToChange).
export const JUDGMENT_CHANGERS: ReadonlySet<string> = new Set(['devil']);

// The seats asked about changing `shown`'s card, in order: from the judged
// seat; after a replacement, from the seat after the one that replaced it,
// which comes last.
export function changerOrder(state: GameState, shown: Shown): string[] {
  const start = shown.changedBy ?? shown.judgment.seatId;
  const order = livingSeatOrderFrom(state, start);
  return shown.changedBy && order[0] === start ? [...order.slice(1), start] : order;
}

// Whether `seatId` still has a say on `shown`: it holds a changer in play and
// a hand card to change with, and hasn't had its say.
function maySay(state: GameState, shown: Shown, seatId: string, registry: ContentRegistry): boolean {
  return (
    !(shown.acted ?? []).includes(seatId) &&
    handOf(state, seatId).length > 0 &&
    skillsInPlay(state, seatId, registry).some((s) => JUDGMENT_CHANGERS.has(s.skill.id))
  );
}

// Whether `owner`'s seat is the next to say whether it changes the judgment.
export function nextToChange(state: GameState, shown: Shown, owner: GeneralOwner, registry: ContentRegistry): boolean {
  return changerOrder(state, shown).find((seatId) => maySay(state, shown, seatId, registry)) === owner.seatId;
}
