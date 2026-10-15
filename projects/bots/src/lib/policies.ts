import type { BotPolicy } from './policy';
import { ruleBasedPolicy, ruleBasedV1Policy } from './rule-based';

const POLICIES: ReadonlyMap<string, BotPolicy> = new Map([ruleBasedPolicy, ruleBasedV1Policy].map((p) => [p.id, p]));

// The ids of every registered policy (the random picker is not a BotPolicy).
export const POLICY_IDS: readonly string[] = [...POLICIES.keys()];

export function policyById(id: string): BotPolicy {
  const policy = POLICIES.get(id);
  if (!policy) throw new Error(`Unknown bot policy "${id}". Valid ids: ${POLICY_IDS.join(', ')}`);
  return policy;
}
