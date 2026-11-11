import type { Action, GameState } from 'engine';

// `card:<definitionId>`, `skill:<skillId>` or `ability:<abilityId>`.
export type UsageKey = string;
export type UsageTally = Record<UsageKey, { offered: number; used: number }>;

// The cards, skills and ability asks added for Kingdom Wars by the bot work of part 1.
export const PART_1_KEYS: readonly UsageKey[] = [
  'card:amass',
  'card:ally-far-attack-near',
  'card:harvest',
  'card:ascertain',
  'card:chains',
  'card:blaze',
  'card:wuxie-guo',
  'ability:fire-fan',
  'ability:trident-glaive',
  'skill:kingdomWars:femme-fatale',
  'skill:kingdomWars:impetus-for-conflicts',
  'skill:kingdomWars:benevolence',
];

function definitionIdOf(state: GameState, cardInstanceId: string): string | undefined {
  for (const zone of state.zones) {
    const found = zone.cards.find((c) => c.instanceId === cardInstanceId);
    if (found) return found.definitionId;
  }
  return undefined;
}

// The usage key an action stands for, if it is a card play, a card response or a skill use.
function keyOf(state: GameState, action: Action): UsageKey | undefined {
  if (action.kind === 'PlayCardAction' || action.kind === 'RespondAction') {
    const id = definitionIdOf(state, action.cardInstanceId);
    return id === undefined ? undefined : `card:${id}`;
  }
  if (action.kind === 'UseSkillAction' && action.owner.kind === 'general') return `skill:${action.owner.skillId}`;
  return undefined;
}

const bump = (tally: UsageTally, key: UsageKey, field: 'offered' | 'used'): void => {
  (tally[key] ??= { offered: 0, used: 0 })[field] += 1;
};

// Counts one decision. A card or skill is offered once per decision however many copies or actions
// offer it, and used when the chosen action is one of them. An ability ask is offered while its
// 'use' choice is pending, and used when 'use' is the chosen option.
export function recordDecision(tally: UsageTally, state: GameState, legal: Action[], action: Action): void {
  const offered = new Set<UsageKey>();
  for (const a of legal) {
    const key = keyOf(state, a);
    if (key !== undefined) offered.add(key);
  }
  for (const key of offered) bump(tally, key, 'offered');
  const chosen = keyOf(state, action);
  if (chosen !== undefined) bump(tally, chosen, 'used');

  const choice = state.pendingChoice;
  if (choice && choice.verb === 'use' && choice.reason.kind === 'ability') {
    const key = `ability:${choice.reason.abilityId}`;
    bump(tally, key, 'offered');
    if (action.kind === 'ChooseOptionAction' && action.optionId === 'use') bump(tally, key, 'used');
  }
}
