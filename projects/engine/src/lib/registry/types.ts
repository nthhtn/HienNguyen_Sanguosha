import { GameState, Target, Kingdom, GameResult } from '../domain/types';
import { RngState } from '../rng/rng';

export interface PlayContext {
  seatId: string;
  cardInstanceId: string;
  targets: Target[];
  respondingTo?: string;
}

export interface CardDefinition {
  id: string;
  name: string;
  category: 'basic' | 'trick' | 'equipment';
  play(state: GameState, ctx: PlayContext): unknown[];
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
