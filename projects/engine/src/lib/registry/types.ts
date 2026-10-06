import { CardInstance, GameState, Target, Kingdom, GameResult, PendingResponse, UsedCard } from '../domain/types';
import { RngState } from '../rng/rng';

export interface PlayContext {
  seatId: string;
  cardInstanceId: string;
  targets: Target[];
  respondingTo?: string;
}

// The four equipment slots a seat has. One card per slot.
export type EquipSlot = 'weapon' | 'armor' | 'defensiveMount' | 'offensiveMount';
export const EQUIP_SLOTS: readonly EquipSlot[] = ['weapon', 'armor', 'defensiveMount', 'offensiveMount'];

export interface PlayOptionsContext {
  seatId: string;
  cardInstanceId: string;
}

export interface CardDefinition {
  id: string;
  name: string;
  category: 'basic' | 'tool' | 'equipment';
  // Which equipment slot the card occupies; set exactly when category is 'equipment'.
  equipSlot?: EquipSlot;
  // Reach of a weapon (attack range while equipped); set only for weapons.
  weaponRange?: number;
  // Every legal target list for proactively playing this card in the owner's
  // Play phase: [] = not playable now, [[]] = no target, [[t1], [t2]] = one of
  // these targets. Absent = legacy offers (untargeted + each living other seat).
  legalPlayTargets?(state: GameState, ctx: PlayOptionsContext, registry: ContentRegistry): Target[][];
  play(state: GameState, ctx: PlayContext): unknown[];
  // Called when a seat answers a response window this card opened (see
  // PendingResponse.sourceCard), after the answering card's own effects. Its
  // effects replace the default of simply cancelling the pending effect, e.g.
  // a Duel turning back on the other player.
  onResponse?(state: GameState, ctx: ResponseContext): unknown[];
  // A Tool's rule on one target, once its Wuxie check has passed
  // (ToolRuleEffect). Its effects go to the front of the queue.
  onTarget?(state: GameState, ctx: ToolTargetContext): unknown[];
  // A delayed Tool: play() puts it in a judgment area, so playing it doesn't
  // send it to the discard pile (like Equipment).
  delayed?: boolean;
  // A delayed Tool reading its judgment card (JudgeEffect). Its effects go to
  // the front of the queue, ahead of the judged card's move to the discard pile.
  onJudged?(state: GameState, ctx: JudgedContext): unknown[];
  // What becomes of a delayed Tool once it has had its turn in the Judgment
  // phase (DelayedCleanupEffect). Absent = discarded, if it is still in its
  // owner's judgment area.
  onCleanup?(state: GameState, ctx: DelayedToolContext): unknown[];
  // Active while the card is worn (in an equip zone); the wearer owns them.
  abilities?: Abilities;
  // Resolved for the former wearer right after the card leaves an equip zone,
  // for any reason (Silver Lion's parting heal).
  onUnequip?(state: GameState, ctx: UnequipContext): unknown[];
}

export interface ResponseContext {
  pending: PendingResponse;
  // The seat that answered, and the card it answered with.
  seatId: string;
  cardInstanceId: string;
}

export interface ToolTargetContext {
  tool: UsedCard;
  userSeatId: string;
  target: Target;
  extra?: Target[];
}

export interface JudgedContext {
  tool: UsedCard;
  // The seat being judged, and the card turned up for it.
  seatId: string;
  judged: CardInstance;
}

export interface DelayedToolContext {
  tool: UsedCard;
  // The seat whose judgment area the delayed Tool was judged in.
  ownerSeatId: string;
}

export type TriggerPoint = `before:${string}` | `after:${string}`;

// Who a gathered trigger acts for. A General's skill: the seat and slot it was
// gathered for (the same General can be held by more than one seat, so a skill
// must never search GameState for its own id). A worn card: its wearer and the
// card. `owner` is undefined only for a mode's own triggers.
export type TriggerOwner =
  | { kind: 'general'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'equipment'; seatId: string; cardInstanceId: string };

export interface SkillTrigger {
  point: TriggerPoint;
  // `registry` lets content read worn cards' abilities (e.g. Black Pommel).
  condition(state: GameState, subject: unknown, owner?: TriggerOwner, registry?: ContentRegistry): boolean;
  effect(state: GameState, subject: unknown, owner?: TriggerOwner, registry?: ContentRegistry): unknown[];
}

// Rule changes a worn card gives its wearer. Content's queries read them; the
// engine never does.
export interface AbilityModifiers {
  // Sha plays allowed per turn: the highest wins; Infinity = no limit (Crossbow).
  shaLimit?: number;
  // The wearer's Sha ignores the target's armour (Black Pommel).
  ignoresArmor?: boolean;
}

// What a card does while worn.
export interface Abilities {
  triggers?: SkillTrigger[];
  modifiers?: AbilityModifiers;
}

export interface UnequipContext {
  // The former wearer, and the card that left its equipment.
  seatId: string;
  cardInstanceId: string;
}

export interface SkillDefinition {
  id: string;
  triggers: SkillTrigger[];
  activation: 'auto' | 'player-choice';
}

export interface GeneralDefinition {
  id: string;
  kingdom: Kingdom;
  maxHp: number;
  skills: SkillDefinition[];
}

export interface ContentRegistry {
  cards: Map<string, CardDefinition>;
  generals: Map<string, GeneralDefinition>;
}

export interface GameModeDefinition {
  id: string;
  setup(seatIds: string[], registry: ContentRegistry, rng: RngState): { state: GameState; rng: RngState };
  checkWinCondition(state: GameState): GameResult | null;
  triggers: SkillTrigger[];
  // Largest table this mode can seat with the given content, if it is limited.
  maxSeats?(registry: ContentRegistry): number;
}

export type ModeRegistry = Map<string, GameModeDefinition>;
