import type { DecisionReason, GameState, Seat } from 'engine';
import { isAlly } from './helpers';

// Tools worth cancelling when aimed at this bot (or, with the wuxie rule, a revealed ally).
export const HARMFUL_TOOLS: ReadonlySet<string> = new Set(['barbarians', 'hail-of-arrows', 'duel', 'steal', 'break', 'capture', 'lightning', 'starvation']);
// Tools that help whoever they are aimed at: worth cancelling when aimed at a known foe.
export const HELPFUL_TOOLS: ReadonlySet<string> = new Set(['draw-two', 'peach-garden', 'harvest']);

// Stage 2 response rules, each a switch so they can be measured on their own.
export interface ResponseRules {
  shanHold: boolean;
  wuxie: boolean;
}
export const NO_RESPONSE_RULES: ResponseRules = { shanHold: false, wuxie: false };
export const ALL_RESPONSE_RULES: ResponseRules = { shanHold: true, wuxie: true };

const handCount = (view: GameState, self: Seat, definitionId: string): number =>
  (view.zones.find((z) => z.id === self.hand.zoneId)?.cards ?? []).filter((c) => c.definitionId === definitionId).length;

// Take a non-lethal hit and keep the Shan: only at 3+ HP and with fewer than 2 Shan in hand.
export function shouldHoldShan(view: GameState, self: Seat): boolean {
  const outcome = view.pendingResponse?.outcome;
  if (outcome?.kind !== 'DamageEffect') return false;
  const { target, amount } = outcome.damage;
  if (target.kind !== 'seat' || target.seatId !== self.id) return false;
  return amount < self.combinedHp && self.combinedHp > 2 && handCount(view, self, 'shan') < 2;
}

type WuxieReason = Extract<DecisionReason, { kind: 'wuxie' }>;

// Whether to spend a Wuxie on `reason`. Baseline: a harmful Tool aimed at this bot. `extended` adds a
// harmful Tool on a revealed ally and a helpful Tool on a known foe, never for a Tool this seat or an ally used.
export function wuxieWorthCancelling(view: GameState, self: Seat, reason: WuxieReason, extended: boolean): boolean {
  if (reason.target.kind !== 'seat') return false;
  const targetId = reason.target.seatId;
  const harmful = HARMFUL_TOOLS.has(reason.tool.as);
  if (targetId === self.id) return harmful;
  if (!extended) return false;
  const user = view.seats.find((s) => s.id === reason.toolUserSeatId);
  if (reason.toolUserSeatId === self.id || (user && isAlly(self, user))) return false;
  const target = view.seats.find((s) => s.id === targetId);
  if (!target) return false;
  if (harmful) return isAlly(self, target);
  return HELPFUL_TOOLS.has(reason.tool.as) && target.kingdom !== 'hidden' && !isAlly(self, target);
}
