import { Target } from '../domain/types';

export type Action =
  | { kind: 'DrawCardsAction'; seatId: string; count: number }
  | { kind: 'PlayCardAction'; seatId: string; cardInstanceId: string; targets: Target[] }
  | { kind: 'RevealGeneralAction'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'ChooseGeneralsAction'; seatId: string; mainId: string; deputyId: string }
  | { kind: 'RespondAction'; seatId: string; pendingResponseId: string; cardInstanceId: string }
  | { kind: 'PassAction'; seatId: string; pendingResponseId: string }
  | { kind: 'EndPhaseAction'; seatId: string }
  | { kind: 'DiscardCardAction'; seatId: string; cardInstanceId: string }
  | { kind: 'ChooseOptionAction'; seatId: string; choiceId: string; optionId: string };

export const ACTION_KINDS: ReadonlySet<Action['kind']> = new Set([
  'DrawCardsAction',
  'PlayCardAction',
  'RevealGeneralAction',
  'ChooseGeneralsAction',
  'RespondAction',
  'PassAction',
  'EndPhaseAction',
  'DiscardCardAction',
  'ChooseOptionAction',
]);

export function isAction(value: { kind: string }): value is Action {
  return ACTION_KINDS.has(value.kind as Action['kind']);
}
