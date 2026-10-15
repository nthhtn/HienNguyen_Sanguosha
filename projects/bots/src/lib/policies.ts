import type { BotPolicy } from './policy';
import { ALL_CARD_PLAY_RULES, NO_CARD_PLAY_RULES } from './card-play';
import { ALL_RESPONSE_RULES, NO_RESPONSE_RULES } from './responses';
import { GENERAL_VALUES } from './general-values';
import { weakestFirst } from './helpers';
import { createRuleBasedPolicy, ruleBasedPolicy, ruleBasedV1Policy, ruleBasedV2Policy } from './rule-based';

const POLICIES = new Map<string, BotPolicy>();

// Adds a policy under its id, replacing any earlier one with that id. Experiments use this to try variants.
export function registerPolicy(policy: BotPolicy): void {
  POLICIES.set(policy.id, policy);
}

// The ids of every registered policy (the random picker is not a BotPolicy).
export function policyIds(): string[] {
  return [...POLICIES.keys()];
}

export function policyById(id: string): BotPolicy {
  const policy = POLICIES.get(id);
  if (!policy) throw new Error(`Unknown bot policy "${id}". Valid ids: ${policyIds().join(', ')}`);
  return policy;
}

registerPolicy(ruleBasedPolicy);
registerPolicy(ruleBasedV1Policy);
registerPolicy(ruleBasedV2Policy);
// Stage 1 (card play): every card-play rule on; judged against 'rule-based' by the tournament.
registerPolicy(createRuleBasedPolicy('rule-based-cards', weakestFirst, ALL_CARD_PLAY_RULES));
// Stage 2 (responses): both response rules on; judged against 'rule-based' by the tournament.
registerPolicy(createRuleBasedPolicy('rule-based-responses', weakestFirst, NO_CARD_PLAY_RULES, ALL_RESPONSE_RULES));
// Stage 4 (General selection): the measured value table. Shipped, so it now equals 'rule-based'.
registerPolicy(createRuleBasedPolicy('rule-based-picks', weakestFirst, NO_CARD_PLAY_RULES, NO_RESPONSE_RULES, GENERAL_VALUES));
