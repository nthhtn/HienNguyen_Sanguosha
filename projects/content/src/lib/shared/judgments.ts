import type { CardInstance, ContentRegistry, Effect, GameState, GeneralOwner } from 'engine';
import { livingSeatOrderFrom, skillsInPlay } from 'engine';
import { handOf } from './queries';
import { ownCards, selectionOf } from './skills';
import { colourFor } from './suits';

type Shown = Extract<Effect, { kind: 'JudgmentShownEffect' }>;

// The black cards in a seat's hand and equipment (Dark Magic's).
export const blackCards = (state: GameState, seatId: string, registry: ContentRegistry) => ownCards(state, seatId, true).filter((c) => colourFor(state, seatId, c, registry) === 'black');

// The skills that may replace a judgment's card, each with the cards its seat
// may change one with (Devil: a hand card; Dark Magic, stage 8: a black hand or
// worn card). Each holder is asked in seat order, one at a time (nextToChange).
// Both are registered here, so a changer needs no General file imported first.
export const JUDGMENT_CHANGERS: Map<string, (state: GameState, seatId: string, registry: ContentRegistry) => CardInstance[]> = new Map([
  ['devil', (state: GameState, seatId: string) => handOf(state, seatId)],
  ['dark-magic', blackCards],
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

// The ask of a skill that may replace `shown`'s card with one of `eligibleIds` (`oldTo`: where the old
// card goes, else the discard pile). The ask and the pick after it are both marked as a judgment
// change, so they run on the judgment-change clock and are shown inside the judgment popup. Declining,
// or cancelling the pick, lets the card stand and records the seat as having had its say.
export function judgmentChangeAsk(state: GameState, shown: Shown, owner: GeneralOwner, eligibleIds: string[], oldTo?: string): Effect {
  const passed: Shown = { ...shown, acted: [...(shown.acted ?? []), owner.seatId] };
  const pick = selectionOf(state, owner, {
    of: 'cards', eligibleIds, min: 1, max: 1,
    then: { kind: 'replace-judgment', judgment: shown.judgment, owner, abilityId: owner.skillId, ...(oldTo ? { oldTo } : {}) },
    onCancel: [passed], targetSeatId: shown.judgment.seatId, judgmentChange: true,
  });
  return { kind: 'AskUseEffect', owner, abilityId: owner.skillId, effects: [pick], otherwise: [passed], targetSeatId: shown.judgment.seatId, judgmentChange: true };
}
