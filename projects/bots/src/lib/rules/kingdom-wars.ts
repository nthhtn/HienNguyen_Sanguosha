import { fireFanRule, tridentGlaiveRule } from './equipment';
import { botRules, BotRuleRegistry } from './registry';
import { allyFarAttackNearRule, amassRule, ascertainRule, blazeRule, chainsRule, harvestRule } from './tools';
import { wuxieKingdomRule } from './wuxie-guo';

// Kingdom Wars card and skill knowledge for the bot, keyed by card or skill id (filled in by later tasks).
export const KINGDOM_WARS_RULES: BotRuleRegistry = botRules([
  amassRule, allyFarAttackNearRule, harvestRule, ascertainRule, chainsRule, blazeRule,
  wuxieKingdomRule, fireFanRule, tridentGlaiveRule,
]);
