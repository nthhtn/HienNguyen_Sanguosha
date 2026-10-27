import type { CardInstance, ContentRegistry, GameState } from 'engine';
import { generalDisplayData, judgmentOutcome, judgmentOutcomeText, judgmentReaderId, judgmentRuleText } from 'content';
import type { JudgmentEffect, JudgmentVerdict } from 'content';
import { abilityDisplayName, cardFaceLabel, cardIdDisplayName, Force, seatForce, generalDisplayName, seatName, shownCardId } from '../labels';
import { Translator, localeOf } from '../i18n/translator';

export type JudgmentSource =
  | { kind: 'skill'; generalId: string | null; generalName: string; abilityName: string; skillText: string | null }
  | { kind: 'card'; cardName: string; seatName: string };

// Everything the judgment popup shows, read off the table's public state.
export interface JudgmentDescription {
  // The skill owner's seat force; for a card, the judged seat's; neutral when that seat has shown no General.
  force: Force;
  source: JudgmentSource;
  judgedSeatName: string;
  // As it stands now, after any replacements.
  card: CardInstance;
  // One line per replacement, oldest first.
  changes: { text: string; card: CardInstance }[];
  // No skill can change the card any more: the game waits for the acknowledgement.
  settled: boolean;
  // What the final card will do; only once settled, and only for a reader content has text for.
  outcome: string | null;
  // While not settled: who is deciding, or a general line.
  waiting: string | null;
  // One sentence: what makes this judgment good or bad for the judged seat. Shown at the start.
  rule: string | null;
  // How it went for the judged seat's player and what the table is shown happening; only once settled.
  verdict: JudgmentVerdict | null;
  effect: JudgmentEffect | null;
  // The public HP of the seat that loses it, when the effect is damage.
  hp: { seatName: string; current: number; max: number | null } | null;
  // The cards that were replaced, oldest first; only the last three, so the stack stays readable.
  replaced: CardInstance[];
}

// How many replaced cards stay in view.
export const REPLACED_IN_VIEW = 3;

// The judgment on show, or null. `state` should be the public view: a hidden General or hand stays hidden.
export function judgmentDescription(state: GameState, registry: ContentRegistry, tr: Translator): JudgmentDescription | null {
  const view = state.judgmentView;
  if (!view) return null;
  const name = (seatId: string) => seatName(state.players, seatId, tr);
  const seatOf = (seatId: string) => state.seats.find((s) => s.id === seatId);
  const reader = view.reader;

  let source: JudgmentSource;
  let force: Force;
  if (reader.kind === 'skill') {
    const owner = reader.owner;
    const sourceSeat = seatOf(owner.seatId);
    const shown = sourceSeat?.generals?.[owner.slot].generalDefinitionId;
    const generalId = shown && shown !== 'hidden' ? shown : null;
    const display = generalId ? generalDisplayData(generalId, localeOf(tr)) : null;
    const abilityName = abilityDisplayName(owner.skillId, tr);
    source = {
      kind: 'skill',
      generalId,
      generalName: generalId ? (display?.name ?? generalDisplayName(generalId, tr)) : generalDisplayName('hidden', tr),
      abilityName,
      skillText: display?.skills.find((s) => s.name === abilityName)?.text ?? null,
    };
    force = seatForce(sourceSeat);
  } else {
    source = { kind: 'card', cardName: cardIdDisplayName(shownCardId(reader.card), tr), seatName: name(view.seatId) };
    force = seatForce(seatOf(view.seatId));
  }

  const changes = view.changes.map((change) => ({
    text: tr('judgment.changed', {
      owner: name(change.owner.seatId),
      ability: abilityDisplayName(change.abilityId, tr),
      old: cardFaceLabel(change.replaced),
      new: cardFaceLabel(change.card),
    }),
    card: change.card,
  }));

  let outcome: string | null = null;
  let verdict: JudgmentVerdict | null = null;
  let effect: JudgmentEffect | null = null;
  let hp: JudgmentDescription['hp'] = null;
  if (view.settled) {
    const result = judgmentOutcome(state, view, registry);
    if (result) {
      const owner = name(result.seats.owner);
      outcome = judgmentOutcomeText(result.readerId, result.key, { seat: name(result.seats.seat), owner, source: result.seats.source ? name(result.seats.source) : owner }, localeOf(tr));
      verdict = result.verdict;
      effect = result.effect;
      if (result.effect.kind === 'damage') {
        const subjectId = result.seats[result.effect.subject];
        const subject = subjectId ? seatOf(subjectId) : undefined;
        if (subject) hp = { seatName: name(subject.id), current: Math.max(0, subject.combinedHp), max: subject.maxCombinedHp > 0 ? subject.maxCombinedHp : null };
      }
    }
  }

  let waiting: string | null = null;
  if (!view.settled) {
    const deciding = state.pendingChoice?.seatId ?? state.pendingSelection?.seatId;
    waiting = deciding ? tr('judgment.waiting.seat', { seat: name(deciding) }) : tr('judgment.waiting');
  }

  return {
    force, source, judgedSeatName: name(view.seatId), card: view.card, changes, settled: view.settled, outcome, waiting,
    rule: judgmentRuleText(judgmentReaderId(reader), localeOf(tr)), verdict, effect, hp,
    replaced: view.changes.slice(-REPLACED_IN_VIEW).map((change) => change.replaced),
  };
}
