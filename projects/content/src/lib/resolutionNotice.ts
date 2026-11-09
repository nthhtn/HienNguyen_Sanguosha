import type { CardInstance, EngineEvent, GameState } from 'engine';
import { blazeNotice } from './resolutionNotices/blaze';
import { coerceNotice } from './resolutionNotices/take-cards';
import { harvestNotice } from './resolutionNotices/harvest';
import { resurgenceNotice } from './resolutionNotices/resurgence';

// A Resolution Notice: the popup that tells every seat what an effect with a visible outcome did. This
// file is the data model and the registry; the application layer finds each resolution in the log and
// renders the content. Adding a notice for a card or skill is one entry in RESOLUTION_NOTICES (and its
// message keys), never a change to the engine or the popup.

export type NoticeTone = 'good' | 'bad' | 'neutral';

// A line of text as an i18n key and its parameters, translated by the application layer. A parameter
// named `…Seat` (`userSeat`, `targetSeat`) holds a seat id and is shown as that seat's name; one named
// `card` or `…Card` holds a card id and is shown as the card's name, `skill` holds a skill id and is shown
// as the skill's name; any other is shown as it is.
export interface NoticeText {
  key: string;
  params?: Record<string, string | number>;
}

// A card the notice shows: face up, or `null` for a card back (a card a seat may not see).
export interface NoticeCard {
  card: CardInstance | null;
  label?: NoticeText;
}

export interface ResolutionNoticeContent {
  // What caused it: a card (by the id it counts as) or a skill and the seat that owns it.
  source: { kind: 'card'; id: string } | { kind: 'skill'; id: string; seatId: string };
  // The seats involved, the source seat first.
  seatIds: string[];
  // What happened, in order.
  steps: NoticeText[];
  cards: NoticeCard[];
  // A card per seat, shown in a row with the seat's name and revealed Generals under each (Harvest). When set,
  // the popup shows this in place of the row of seats, the steps and the cards.
  seatCards?: { seatId: string; card: CardInstance | null }[];
  // From the source seat's side, the same for every viewer. `hp` names the seat whose HP changed.
  outcome: { tone: NoticeTone; symbol: string; headline: NoticeText; text: NoticeText; hp?: { seatId: string } };
}

// The log events of one resolution, from the play (or the skill's use) to its last effect.
export interface ResolutionSpan {
  sourceId: string;
  userSeatId: string;
  targetSeatIds: string[];
  // Where the span sits in the log, so a `describe` can also read what came just before it (the cards a
  // skill turned up before it announced itself). `events` is `log.slice(startIndex, endIndex + 1)`.
  startIndex: number;
  endIndex: number;
  events: EngineEvent[];
}

export interface ResolutionNoticeDefinition {
  // `view` is the viewer's redacted state: read only what the view and the span's events show. Null when
  // there is nothing worth showing (the resolution was cancelled, say).
  describe(span: ResolutionSpan, view: GameState): ResolutionNoticeContent | null;
}

// Keyed by a card's id or a skill's id. A card whose own response or popup already says what happened
// (Sha, Wuxie, Peach Garden, Chains, Duel, Barbarians, Hail of Arrows, and anything with a Judgment popup),
// or that the table needs no popup for (Draw Two, Ally Far Attack Near, Wine, Amass, Ascertain, Steal, Break),
// has no entry.
export const RESOLUTION_NOTICES: Record<string, ResolutionNoticeDefinition> = {
  blaze: blazeNotice,
  coerce: coerceNotice,
  harvest: harvestNotice,
  resurgence: resurgenceNotice,
};

export function describeResolution(
  span: ResolutionSpan,
  view: GameState,
  registry: Record<string, ResolutionNoticeDefinition> = RESOLUTION_NOTICES
): ResolutionNoticeContent | null {
  return registry[span.sourceId]?.describe(span, view) ?? null;
}
