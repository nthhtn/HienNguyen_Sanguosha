import { GameState, Target, Kingdom, GameResult, PendingResponse } from '../domain/types';
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
}

export interface ResponseContext {
  pending: PendingResponse;
  // The seat that answered, and the card it answered with.
  seatId: string;
  cardInstanceId: string;
}

export type TriggerPoint = `before:${string}` | `after:${string}`;

// Identifies the general-instance a trigger was gathered for. A general skill's
// `condition`/`effect` must know which of its holders it is currently acting
// for: the same GeneralDefinition can legitimately be held by more than one
// Seat at once, so a skill may NOT derive "which seat am I" by searching
// GameState for a general id (that would resolve to whichever holder happens to
// come first, mis-attributing and double-firing the trigger). `owner` is
// `undefined` only for triggers that have no owning general at all — currently
// the mode-level triggers declared by a GameModeDefinition.
export interface TriggerOwner {
  seatId: string;
  slot: 'main' | 'deputy';
}

export interface SkillTrigger {
  point: TriggerPoint;
  condition(state: GameState, subject: unknown, owner?: TriggerOwner): boolean;
  effect(state: GameState, subject: unknown, owner?: TriggerOwner): unknown[];
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
