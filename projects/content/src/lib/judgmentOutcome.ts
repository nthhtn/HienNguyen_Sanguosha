import type { ContentRegistry, GameState, JudgmentReader, JudgmentView } from 'engine';
import { captureOutcome } from './cards/capture';
import { eightTrigramsOutcome } from './cards/equipment/eight-trigrams';
import { lightningOutcome } from './cards/lightning';
import { starvationOutcome } from './cards/starvation';

// What a settled judgment will do to the table, in outcome keys that `judgmentOutcomeText`
// (display.ts) has text for. Every decision is the reader's own: the function its `onJudged`
// calls, so the text cannot disagree with the rule.
export interface JudgmentOutcome {
  // A card reader's id (the card it counts as) or a skill reader's skill id.
  readerId: string;
  key: string;
  // Seat ids: the judged seat, the reader's owner, and a third seat it acts on (a damage source).
  seats: { seat: string; owner: string; source: string | null };
}

export function judgmentReaderId(reader: JudgmentReader): string {
  return reader.kind === 'card' ? reader.card.as : reader.owner.skillId;
}

interface Decision {
  key: string;
  source?: string | null;
}
type Decide = (state: GameState, view: JudgmentView, registry: ContentRegistry) => Decision;

const READERS: Record<string, Decide> = {
  lightning: (state, view, registry) => ({ key: lightningOutcome(state, view.seatId, view.card, registry) }),
  capture: (state, view, registry) => ({ key: captureOutcome(state, view.seatId, view.card, registry) }),
  starvation: (state, view, registry) => ({ key: starvationOutcome(state, view.seatId, view.card, registry) }),
  'eight-trigrams': (state, view, registry) => ({ key: eightTrigramsOutcome(state, view.seatId, view.card, registry) }),
  // The skill has the card's ability.
  'eight-arrays': (state, view, registry) => ({ key: eightTrigramsOutcome(state, view.seatId, view.card, registry) }),
};

// null when the reader has no entry.
export function judgmentOutcome(state: GameState, view: JudgmentView, registry: ContentRegistry): JudgmentOutcome | null {
  const readerId = judgmentReaderId(view.reader);
  if (!Object.prototype.hasOwnProperty.call(READERS, readerId)) return null;
  const decision = READERS[readerId](state, view, registry);
  const owner = view.reader.kind === 'skill' ? view.reader.owner.seatId : view.seatId;
  return { readerId, key: decision.key, seats: { seat: view.seatId, owner, source: decision.source ?? null } };
}
