import { AbilityOwner, Target } from '../domain/types';
import type { TargetPick } from '../registry/types';

export type Action =
  | { kind: 'DrawCardsAction'; seatId: string; count: number }
  // `pickTargets`: on an offered template, pick the targets, then submit with them.
  | { kind: 'PlayCardAction'; seatId: string; cardInstanceId: string; targets: Target[]; pickTargets?: TargetPick }
  // Closes the Start window: reveals the picked hidden Generals, then enters Start. Offered as a template with `slots` free (empty: reveal none).
  | { kind: 'ConfirmRevealsAction'; seatId: string; slots: Array<'main' | 'deputy'> }
  | { kind: 'ChooseGeneralsAction'; seatId: string; mainId: string; deputyId: string }
  | { kind: 'RespondAction'; seatId: string; pendingResponseId: string; cardInstanceId: string }
  | { kind: 'PassAction'; seatId: string; pendingResponseId: string }
  | { kind: 'EndPhaseAction'; seatId: string }
  | { kind: 'DiscardCardAction'; seatId: string; cardInstanceId: string }
  | { kind: 'ChooseOptionAction'; seatId: string; choiceId: string; optionId: string }
  // Fills the pending selection; getLegalActions offers it as a template with no ids.
  | { kind: 'SelectAction'; seatId: string; selectionId: string; ids: string[] }
  | { kind: 'CancelSelectionAction'; seatId: string; selectionId: string }
  // Uses a conversion: in the Play Phase at `targets`, or (with
  // pendingResponseId) to answer that window. Opens a selection of the cards.
  | { kind: 'UseConversionAction'; seatId: string; via: { owner: AbilityOwner; conversionId: string }; targets: Target[]; pendingResponseId?: string; pickTargets?: TargetPick }
  // Uses an active skill of the seat's General (owner.kind === 'general').
  | { kind: 'UseSkillAction'; seatId: string; owner: AbilityOwner }
  // Fills the pending arrangement: `top` (top card first) and `bottom` (in the
  // order they go under the pile). Offered as a template with both empty.
  | { kind: 'ArrangeCardsAction'; seatId: string; arrangementId: string; top: string[]; bottom: string[] }
  // Closes the settled judgment (judgmentNotice rule). `seatId` is the acting seat; `by` the seat
  // whose player pressed Close; `timeout` when the notice clock ran out.
  | { kind: 'AcknowledgeJudgmentAction'; seatId: string; by?: string; timeout?: true };

export const ACTION_KINDS: ReadonlySet<Action['kind']> = new Set([
  'DrawCardsAction',
  'PlayCardAction',
  'ConfirmRevealsAction',
  'ChooseGeneralsAction',
  'RespondAction',
  'PassAction',
  'EndPhaseAction',
  'DiscardCardAction',
  'ChooseOptionAction',
  'SelectAction',
  'CancelSelectionAction',
  'UseConversionAction',
  'UseSkillAction',
  'ArrangeCardsAction',
  'AcknowledgeJudgmentAction',
]);

export function isAction(value: { kind: string }): value is Action {
  return ACTION_KINDS.has(value.kind as Action['kind']);
}
