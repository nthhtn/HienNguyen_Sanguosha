import type { Action, GameState } from 'engine';
import { seatName } from '../labels';
import { Translator, englishTranslator } from '../i18n/translator';
import { AskDescription, SelectionDescription, describeAsk, describeSelection } from './ability-description';

// What the decision area of the Judgment popup shows while a skill that may change the card is being asked.
export type JudgmentDecisionView =
  // The viewer is the seat asked: the engine's own question, step by step (the ask, then the card pick).
  | { kind: 'mine'; step: { kind: 'ask'; description: AskDescription } | { kind: 'select'; description: SelectionDescription }; deciderName: string }
  // Someone else is asked: a waiting line.
  | { kind: 'watching'; deciderName: string }
  // The asked seat's own view is not on screen yet (Pass and Play): the hand-off comes first.
  | { kind: 'gate'; seatId: string; deciderName: string };

// The decision a skill that may change an unsettled judgment's card is waiting on, as `viewerSeatId` sees
// it, or null when there is none (the judgment is settled, or the pending decision is not a changer's).
// `legal`: what the engine offers the viewer. `shown`: whether the viewer's own view is on screen.
export function judgmentDecision(state: GameState, viewerSeatId: string, legal: readonly Action[], tr: Translator = englishTranslator, shown = true): JudgmentDecisionView | null {
  const view = state.judgmentView;
  const pending = state.pendingChoice?.judgmentChange ? state.pendingChoice : state.pendingSelection?.judgmentChange ? state.pendingSelection : null;
  if (!view || view.settled || !pending) return null;
  const deciderName = seatName(state.players, pending.seatId, tr);
  if (pending.seatId !== viewerSeatId) return { kind: 'watching', deciderName };
  if (!shown) return { kind: 'gate', seatId: pending.seatId, deciderName };
  const ask = describeAsk(state, viewerSeatId, legal, tr);
  if (ask) return { kind: 'mine', step: { kind: 'ask', description: ask }, deciderName };
  const selection = describeSelection(state, viewerSeatId, legal, tr);
  if (selection) return { kind: 'mine', step: { kind: 'select', description: selection }, deciderName };
  return { kind: 'watching', deciderName };
}
