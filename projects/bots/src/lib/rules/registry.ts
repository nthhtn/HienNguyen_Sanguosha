import type { Action, ContentRegistry, GameState, PendingChoice, PendingSelection, Seat } from 'engine';
import type { TargetRanker } from '../helpers';

type RespondAction = Extract<Action, { kind: 'RespondAction' }>;

// What a rule sees when the bot asks it. `legal` is the engine's offers with target templates filled by
// `fillPick`; `offered` is the engine's offers as given, templates unfilled.
export interface BotRuleContext {
  view: GameState;
  me: Seat;
  legal: Action[];
  offered: Action[];
  registry: ContentRegistry;
  rank: TargetRanker;
}

// One piece of bot knowledge about a card or skill, keyed by its id in a BotRuleRegistry. Every hook is optional;
// a rule fills in only the decisions it has an opinion on, and returns undefined to leave the rest to the ladder.
export interface BotRule {
  id: string;
  // A Play Phase action: tried early or late in the ladder.
  play?: { when: 'early' | 'late'; pick(ctx: BotRuleContext): Action | undefined };
  // Whether to use an optional ability when asked.
  wantsToUse?(ctx: BotRuleContext, choice: PendingChoice): boolean;
  // The cards or seats to pick for a selection, or 'cancel'.
  select?(ctx: BotRuleContext, selection: PendingSelection): string[] | 'cancel' | undefined;
  // The option to take in a choice.
  choose?(ctx: BotRuleContext, choice: PendingChoice): string | undefined;
  // The response to give in a response window.
  answer?(ctx: BotRuleContext, answers: RespondAction[]): RespondAction | undefined;
}

export type BotRuleRegistry = ReadonlyMap<string, BotRule>;

// Builds a registry in insertion order; a repeated id is a bug, not an override.
export function botRules(rules: BotRule[]): BotRuleRegistry {
  const map = new Map<string, BotRule>();
  for (const rule of rules) {
    if (map.has(rule.id)) throw new Error(`Duplicate bot rule "${rule.id}"`);
    map.set(rule.id, rule);
  }
  return map;
}

// The optional rule set on a rule-based policy; null leaves the policy exactly as it was before the registry.
export interface BotFeatures {
  rules: BotRuleRegistry | null;
}

export const NO_FEATURES: BotFeatures = { rules: null };
