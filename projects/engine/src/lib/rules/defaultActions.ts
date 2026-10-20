import { GameState } from '../domain/types';
import { Action } from '../pipeline/actions';
import { discardOwed } from './phaseSequence';

// What a timeout submits when nobody has said: Cancel or the first picks for
// a selection, every card on top for an arrangement, Don't for an ask, the
// first option of a choice, No Response, the first General pair, the first
// discards, else End Phase. Several actions for a discard: submit them as one.
export function defaultActionsFor(state: GameState, legal: readonly Action[]): Action[] {
  // A settled judgment: the clock closes it.
  const acknowledge = legal.find((a) => a.kind === 'AcknowledgeJudgmentAction');
  if (acknowledge) return [{ ...acknowledge, timeout: true }];
  const arrange = legal.find((a): a is Extract<Action, { kind: 'ArrangeCardsAction' }> => a.kind === 'ArrangeCardsAction');
  if (arrange && state.pendingArrangement) return [{ ...arrange, top: [...state.pendingArrangement.cardInstanceIds], bottom: [] }];
  // A selection: Cancel when it may be, else the first eligible picks.
  const cancel = legal.find((a) => a.kind === 'CancelSelectionAction');
  if (cancel) return [cancel];
  const select = legal.find((a): a is Extract<Action, { kind: 'SelectAction' }> => a.kind === 'SelectAction');
  if (select && state.pendingSelection) return [{ ...select, ids: state.pendingSelection.eligibleIds.slice(0, state.pendingSelection.min) }];
  // An ask (or "let them draw"): Don't.
  const decline = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === 'decline');
  if (decline) return [decline];
  const pick = legal.find((a) => a.kind === 'ChooseOptionAction');
  if (pick) return [pick];
  const pass = legal.find((a) => a.kind === 'PassAction');
  if (pass) return [pass];
  const generals = legal.find((a) => a.kind === 'ChooseGeneralsAction');
  if (generals) return [generals];
  const discards = legal.filter((a) => a.kind === 'DiscardCardAction');
  if (discards.length > 0) return discards.slice(0, discardOwed(state, state.turn.ownerSeatId));
  const endPhase = legal.find((a) => a.kind === 'EndPhaseAction');
  return [endPhase ?? legal[0]];
}
