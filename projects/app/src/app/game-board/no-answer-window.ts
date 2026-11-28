import type { Action, PendingResponse } from 'engine';

// The response windows that can open with Pass as the only legal action: the engine opens them whatever the seat holds,
// so that passing reveals nothing (`announcePass`). Presentation only: these names say which popups an experiment may skip.
export type NoAnswerWindow = 'sha' | 'hail-of-arrows' | 'barbarians' | 'duel' | 'coerce' | 'upheaval' | 'instigate';

// The windows the beginner experiment skips. Coerce, Upheaval and Instigate stay: passing there costs a weapon, HP or a
// card, so their popup works as a notice.
export const BEGINNER_SKIP_WINDOWS: readonly NoAnswerWindow[] = ['sha', 'hail-of-arrows', 'barbarians', 'duel'];

const CARD_WINDOWS: readonly NoAnswerWindow[] = ['sha', 'hail-of-arrows', 'barbarians', 'duel', 'coerce'];
const SKILL_WINDOWS: readonly NoAnswerWindow[] = ['upheaval', 'instigate'];

// Kingdom Wars versions carry a prefix ("kingdomWars:upheaval") and play as their base.
// Kingdom Wars' Upheaval is named Descend into Chaos.
const baseId = (id: string): string => {
  const base = id.slice(id.indexOf(':') + 1);
  return base === 'descend-into-chaos' ? 'upheaval' : base;
};

// Which of those windows `pending` is, or null for any other (a Wuxie, a dying round, another skill).
export function noAnswerWindowOf(pending: PendingResponse): NoAnswerWindow | null {
  const reason = pending.reason;
  // A Duel window names its card by `sourceCard` and carries no reason.
  if (!reason && pending.sourceCard) return CARD_WINDOWS.find((w) => w === baseId(pending.sourceCard!.definitionId)) ?? null;
  if (reason?.kind === 'card-effect') return CARD_WINDOWS.find((w) => w === baseId(reason.card.as)) ?? null;
  if (reason?.kind === 'ability') return SKILL_WINDOWS.find((w) => w === baseId(reason.abilityId)) ?? null;
  return null;
}

// The Pass to submit in place of opening the popup, or null when the popup should open: the window is listed, the seat has
// nothing to answer with (only Pass is legal, no card and no conversion), and no Tutorial lesson is running.
export function skipsNoAnswerWindow(pending: PendingResponse, legal: readonly Action[], skip: readonly NoAnswerWindow[], tutorialActive: boolean): Action | null {
  if (tutorialActive || skip.length === 0 || legal.length === 0) return null;
  const window = noAnswerWindowOf(pending);
  if (!window || !skip.includes(window)) return null;
  return legal.every((a) => a.kind === 'PassAction') ? legal[0] : null;
}
