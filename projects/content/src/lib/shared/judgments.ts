import type { CardInstance, ContentRegistry, Effect, GameState, GeneralOwner } from 'engine';
import { livingSeatOrderFrom, skillsInPlay } from 'engine';
import { handOf } from './queries';

type Shown = Extract<Effect, { kind: 'JudgmentShownEffect' }>;

// The skills that may replace a judgment's card, each with the cards its seat
// may change one with (Devil: a hand card; Dark Magic, stage 8: a black hand or
// worn card). Each holder is asked in seat order, one at a time (nextToChange).
// A changer's own file adds it (JUDGMENT_CHANGERS.set).
export const JUDGMENT_CHANGERS: Map<string, (state: GameState, seatId: string, registry: ContentRegistry) => CardInstance[]> = new Map([
  ['devil', (state: GameState, seatId: string) => handOf(state, seatId)],
]);

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
  if ((shown.acted ?? []).includes(seatId)) return false;
  return skillsInPlay(state, seatId, registry).some((s) => (JUDGMENT_CHANGERS.get(s.skill.id)?.(state, seatId, registry).length ?? 0) > 0);
}

// Whether `owner`'s seat is the next to say whether it changes the judgment.
export function nextToChange(state: GameState, shown: Shown, owner: GeneralOwner, registry: ContentRegistry): boolean {
  return changerOrder(state, shown).find((seatId) => maySay(state, shown, seatId, registry)) === owner.seatId;
}
