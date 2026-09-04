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

export interface SkillTrigger {
  point: TriggerPoint;
  condition(state: GameState, subject: unknown): boolean;
  effect(state: GameState, subject: unknown): unknown[];
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
}

export type ModeRegistry = Map<string, GameModeDefinition>;
