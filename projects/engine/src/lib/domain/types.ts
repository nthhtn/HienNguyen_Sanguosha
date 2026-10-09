import { RngState } from '../rng/rng';
// Type-only imports: `Effect` and `EngineEvent` are plain serializable
// discriminated unions declared alongside the pipeline that produces them.
// Importing them as types keeps the reference erased at compile time, so there
// is no runtime dependency from the domain module back onto the pipeline.
import type { Effect } from '../pipeline/effects';
import type { EngineEvent } from '../pipeline/events';
import type { Action } from '../pipeline/actions';

export type Kingdom = 'Wei' | 'Shu' | 'Wu' | 'Qun' | 'hidden';

export type Target =
  | { kind: 'seat'; seatId: string }
  | { kind: 'general'; seatId: string; generalSlot: 'main' | 'deputy' };

// Who an ability belongs to: a General's skill (the seat and slot it was
// gathered for, since the same General can be held by more than one seat, and
// the skill's id), or a worn card (its wearer and the card).
export type AbilityOwner =
  | { kind: 'general'; seatId: string; slot: 'main' | 'deputy'; skillId: string }
  | { kind: 'equipment'; seatId: string; cardInstanceId: string };

export type GeneralOwner = Extract<AbilityOwner, { kind: 'general' }>;

export interface Turn {
  turnNumber: number;
  ownerSeatId: string;
  extraTurnStack: string[];
  // Proactive card plays this turn, by card definition id (responses excluded).
  cardPlays?: Record<string, number>;
  // Active skills' uses this turn, by abilityUseKey (seatId/slot/skillId).
  abilityUses?: Record<string, number>;
  // Every card the turn owner used this turn, by what it counted as,
  // responses included (Self-Restraint reads 'sha').
  ownerUses?: Record<string, number>;
  // Cards still owed in this turn's Discard Phase: what the owner was over its
  // hand limit as the phase began, less what it has discarded since. A card
  // drawn meanwhile (Linked Camps) isn't owed too. Absent outside it.
  discardsLeft?: number;
  // Flags that last until the turn ends, e.g. skipPlay (see skipFlagOf).
  // Absent until one is set.
  flags?: Record<string, boolean>;
}

export type Phase = 'GeneralSelection' | 'Start' | 'Judgment' | 'Draw' | 'Play' | 'Discard' | 'End';

export interface GameResult {
  endedAt: number;
  winningKingdom?: Kingdom;
  winningSeatIds: string[];
  losingSeatIds: string[];
}

export interface GeneralInstance {
  generalDefinitionId: string;
  revealed: boolean;
}

export interface SeatGenerals {
  main: GeneralInstance;
  deputy: GeneralInstance;
}

// Pre-game general selection. `candidates` holds the general ids dealt to each
// seat that has not chosen yet; a seat's entry is removed once it chooses.
export interface GeneralSelectionState {
  candidates: Record<string, string[]>;
}

export interface CardZoneRef {
  zoneId: string;
}

export interface Seat {
  id: string;
  index: number;
  kingdom: Kingdom;
  // null only during the GeneralSelection phase, before this seat has chosen.
  generals: SeatGenerals | null;
  combinedHp: number;
  maxCombinedHp: number;
  hand: CardZoneRef;
  equipped: CardZoneRef;
  // Where delayed Tools wait to be judged (Capture, Lightning, Starvation).
  judgment: CardZoneRef;
  // Cards kept face up under the seat's General (Refusing Death). Absent in
  // tables without one.
  pile?: CardZoneRef;
  // Turned face down (Entrench): its next turn is skipped as it turns face up.
  faceDown?: true;
  // Game-long marks some skills keep (none of the base Generals do yet).
  marks?: Record<string, number>;
  eliminated: boolean;
}

export interface Player {
  id: string;
  seatId: string;
  kind: 'human' | 'bot';
  // Shown wherever the seat appears; the seat id stays the stable key.
  name: string;
}

export interface PendingResponse {
  id: string;
  respondingSeatId: string;
  allowedActionKinds: string[];
  allowedCardIds?: string[];
  context: { effect: Effect };
  // The card whose effect opened this window. When set, that card's
  // definition decides what an answer does (CardDefinition.onResponse);
  // otherwise an answer simply cancels context.effect.
  sourceCard?: { instanceId: string; definitionId: string };
  // Effects resolved, in order, after the answering card's own effects — for
  // windows the engine itself opens (e.g. the dying round's Peach heals the
  // dying seat, then asks again).
  onAnswer?: Effect[];
  // What is being asked, so the UI and bots can tell windows apart.
  reason?: DecisionReason;
  // For display only: what not answering is expected to lead to, when
  // context.effect is a step on the way there (a Sha's hit leads to damage).
  outcome?: Effect;
  // What the opening card carries from one answer to the next (Duel: how many
  // Sha are still owed this turn of it).
  data?: Record<string, unknown>;
}

export type DecisionReason =
  | { kind: 'dying'; seatId: string }
  // May this seat cancel `tool` (used by toolUserSeatId) on `target`?
  | { kind: 'wuxie'; tool: UsedCard; toolUserSeatId: string; target: Target }
  // May this seat cancel the counter card wuxieSeatId just played?
  | { kind: 'counter-wuxie'; wuxieSeatId: string }
  // A card's own demand, e.g. Barbarians: play a Sha or take 1 damage. For
  // Coerce, `victimSeatId` is the seat the Sha must be played at.
  | { kind: 'card-effect'; card: UsedCard; userSeatId: string; victimSeatId?: string }
  // A Tool's pick (Steal, Break, Harvest): `userSeatId` used `card`; the
  // chooser takes or discards one of `targetSeatId`'s cards (none for Harvest).
  | { kind: 'choice'; card: UsedCard; userSeatId: string; targetSeatId?: string }
  // An ability's say: whether to use it (an ask), or what to pick for it (a
  // selection). `targetSeatId`: the seat it is aimed at, if any.
  // `cardId`: the card the decision is about (Bewilder's claim).
  | { kind: 'ability'; owner: AbilityOwner; abilityId: string; targetSeatId?: string; cardId?: string };

// A pick a seat owes (Steal, Break, Harvest). Pauses the queue like a
// response window.
export interface PendingChoice {
  id: string;
  seatId: string;
  reason: DecisionReason;
  // What picking does, for display: take the card, discard it, or (an ask)
  // use the ability or not. `pick`: a seat, a suit or a label; `give`: who
  // gets the cards.
  verb: 'take' | 'discard' | 'use' | 'pick' | 'give';
  options: ChoiceOption[];
}

export interface ChoiceOption {
  id: string;
  // A face-up card, or a seat's whole hand as one face-down option (the card
  // inside it is picked at random, so the chooser never sees the hand).
  // For an ask: Use or Don't (`decline` also serves "let them draw" and the like).
  // `reveals`: Use reveals that hidden General first.
  // A seat (Raid's targets, who gets given cards), a suit to name, or a label
  // (Done, an Unyielding outcome).
  shows:
    | { kind: 'card'; card: CardInstance }
    | { kind: 'hidden-hand'; seatId: string; count: number }
    | { kind: 'use'; reveals?: 'main' | 'deputy' }
    | { kind: 'decline' }
    | { kind: 'seat'; seatId: string }
    | { kind: 'suit'; suit: CardInstance['suit'] }
    | { kind: 'label'; text: string };
  // Queued at the front when picked.
  effects: Effect[];
}

// A seat picking cards or seats (Axe's 2 cards, Sky Scorcher's extra targets,
// Serpent Spear's 2 hand cards). Pauses the queue like a response window or a
// choice, and may be open over a response window (Serpent Spear answering).
export interface PendingSelection {
  id: string;
  seatId: string;
  reason: DecisionReason;
  of: 'cards' | 'seats';
  // The card instance ids, or seat ids, that may be picked.
  eligibleIds: string[];
  // Picks must share a suit.
  sameSuit?: true;
  min: number;
  max: number;
  // What the picks lead to.
  then: SelectionContinuation;
  // Queued on Cancel; absent = the selection can't be cancelled.
  onCancel?: Effect[];
  // Resolved, in order, the moment the picks are confirmed, before the
  // continuation: a hidden General's reveal, an active skill's use being
  // counted. They must not open a decision.
  onSelect?: Effect[];
}

// What a selection's picks lead to: plain data, so the state stays serialisable.
export type SelectionContinuation =
  // Discard the picked cards, then queue `then`.
  | { kind: 'discard'; then?: Effect[] }
  // Use the picked cards as one `as` card (with no `as`: the one picked card as
  // itself), at `targets` or as the answer to the window `respondTo`.
  // `counted`: toward per-turn limits. `free`: outside the Play Phase's limits.
  | { kind: 'use-card'; as?: string; via?: UsedCard['via']; targets: Target[]; respondTo?: string; counted: boolean; free?: boolean }
  // Queue `step` with the picked ids added to its data as `picked`.
  | { kind: 'card-step'; step: Extract<Effect, { kind: 'CardStepEffect' }> }
  // Replace the judgment's card with the one picked (Devil).
  | { kind: 'replace-judgment'; judgment: Judgment; owner: AbilityOwner; abilityId: string; oldTo?: string }
  // Give the picked cards to one of `toSeatIds`, chosen next; then `then`.
  // `tally`: add how many were given to turn.abilityUses[tally] (Kindness).
  | { kind: 'give'; toSeatIds: string[]; then?: Effect[]; tally?: string }
  // Queue a skill's `step` with the picked ids added to its data as `picked`.
  // `suspendWindow`: the open window goes into the step's data as `window` and
  // is cleared while the skill decides.
  | { kind: 'skill-step'; step: Extract<Effect, { kind: 'SkillStepEffect' }>; suspendWindow?: true };

// A seat putting cards from the top of the draw pile back in the order it
// likes, some on top and some at the bottom (Astrology). The cards stay in the
// draw pile meanwhile; only the arranging seat sees them.
export interface PendingArrangement {
  id: string;
  seatId: string;
  reason: DecisionReason;
  cardInstanceIds: string[];
}

export interface CardZone {
  id: string;
  kind: 'hand' | 'equip' | 'drawPile' | 'discardPile' | 'judgment' | 'processing' | 'pile';
  ownerSeatId?: string;
  cards: CardInstance[];
  // Cards here that count as another card than their own (a diamond placed as
  // Capture), by instance id. Forgotten when the card leaves. Absent when none.
  countsAs?: Record<string, string>;
}

export interface CardInstance {
  instanceId: string;
  definitionId: string;
  suit: 'spade' | 'heart' | 'club' | 'diamond';
  rank: number;
}

// A card as it is being used: what it counts as, its colour, and the physical
// cards behind it (one normally; none for a card a skill makes, two for a
// Serpent Spear Sha). `via` names the conversion that made it, if any.
export interface UsedCard {
  as: string;
  colour: 'red' | 'black' | 'none';
  suit?: CardInstance['suit'];
  rank?: number;
  physical: CardInstance[];
  via?: { owner: AbilityOwner; abilityId: string; conversionId: string };
}

// Who reads a judgment: a card through its definition's onJudged (a delayed
// Tool; a worn card such as Eight Trigrams), or a General's skill through its own.
export type JudgmentReader = { kind: 'card'; card: UsedCard } | { kind: 'skill'; owner: GeneralOwner };

// A judgment under way: whose it is, who reads it, what the reader passed
// along, and the card turned up (the latest, once a skill has replaced it).
export interface Judgment {
  seatId: string;
  reader: JudgmentReader;
  card: CardInstance;
  data?: Record<string, unknown>;
}

// What a Wuxie check is about: a Tool on one target, or a counter card someone
// just played (so a counter can itself be countered).
export type WuxieSubject =
  | { kind: 'tool'; tool: UsedCard; userSeatId: string; target: Target }
  | { kind: 'counter'; seatId: string };

// The weak structural shape every engine event satisfies. `GameState.log` is
// typed as the concrete `EngineEvent` union instead, so consumers can read a
// specific event's fields after narrowing on `kind` without casting.
export interface GameEvent {
  kind: string;
}

// One step still to resolve: an effect, or an action a trigger asked for.
export type QueueItem = Effect | Action;

export interface Damage {
  source: Target | null;
  target: Target;
  amount: number;
  nature: 'normal' | 'fire' | 'thunder';
  // What caused it. `card` is the card as used (a Serpent Spear Sha has two
  // physical cards); `cardInstanceId` is its first physical card, if any.
  cause?: { cardInstanceId?: string; card?: UsedCard; skillId?: string };
}

export interface GameState {
  seats: Seat[];
  players: Player[];
  turn: Turn;
  phase: Phase;
  zones: CardZone[];
  pendingResponse: PendingResponse | null;
  // What is left to resolve, front first. Absent (never []) when nothing is
  // left: the engine only rests with items here while a decision is pending.
  resolutionQueue?: QueueItem[];
  // The pick a seat owes, if any. Absent (never null) when none, like the queue.
  pendingChoice?: PendingChoice;
  // The cards or seats a seat owes a pick of, if any. Absent (never null) when
  // none, like the choice.
  pendingSelection?: PendingSelection;
  // The cards a seat owes an arrangement of, if any. Absent (never null) when none.
  pendingArrangement?: PendingArrangement;
  log: EngineEvent[];
  rng: RngState;
  result: GameResult | null;
  generalSelection: GeneralSelectionState | null;
}
