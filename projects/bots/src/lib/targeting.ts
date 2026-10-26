import type { CardPlayedEvent, DamageDealtEvent, GameState, Seat } from 'engine';
import { handCards, isAlly, TargetRanker } from './helpers';

// An alternative to weakest-first targeting; higher score = better target. Not used by the shipped
// policy: it did not beat 'rule-based-v1' on fresh seeds (see the bot tournament spec's Results).
export const TARGET_WEIGHTS = {
  kill: 1000, // the hit would take the target to 0 HP
  trigrams: -60, // wears Eight Trigrams, so a Shan may come for free
  perHandCard: -8, // each card is a chance of a Shan...
  handCap: 5, // ...up to this many
  emptyHand: 30, // nothing to defend with
  threat: 60, // per hostile act aimed at us or an ally...
  threatCap: 3, // ...counting up to this many
  perHp: -10, // weaker is better: the tiebreaker
  seatOrder: -0.01, // then the nearer seat
};

// Damage is taken as 1: a Sha or Duel (Wine's extra point is ignored).
const DAMAGE = 1;

// Cards that, played at us or an ally outside a response, are an attack.
const HOSTILE_CARDS = new Set(['sha', 'duel', 'steal', 'break', 'capture', 'starvation', 'barbarians', 'hail-of-arrows', 'lightning']);

const seatTarget = (target: { kind: string; seatId?: string }): string | undefined => (target.kind === 'seat' ? target.seatId : undefined);

// How many hostile acts `attacker` has made against `me` or one of my revealed allies.
function hostileActs(view: GameState, me: Seat, attacker: Seat): number {
  const mine = (seatId: string | undefined): boolean => {
    if (!seatId) return false;
    if (seatId === me.id) return true;
    const other = view.seats.find((s) => s.id === seatId);
    return !!other && isAlly(me, other, view);
  };
  let acts = 0;
  for (const event of view.log ?? []) {
    if (event.kind === 'DamageDealtEvent') {
      const { damage } = event as DamageDealtEvent;
      if (damage.source && seatTarget(damage.source) === attacker.id && mine(seatTarget(damage.target))) acts += 1;
    } else if (event.kind === 'CardPlayedEvent') {
      const played = event as CardPlayedEvent;
      if (played.seatId === attacker.id && !played.inResponseTo && HOSTILE_CARDS.has(played.card.as) && played.targets.some((t) => mine(seatTarget(t)))) acts += 1;
    }
  }
  return acts;
}

export const targetScore: TargetRanker = (view, me, target) => {
  const w = TARGET_WEIGHTS;
  const wornCards = view.zones.find((z) => z.id === target.equipped.zoneId)?.cards ?? [];
  const held = handCards(view, target).length;
  let score = target.combinedHp * w.perHp + target.index * w.seatOrder;
  if (target.combinedHp <= DAMAGE) score += w.kill;
  if (wornCards.some((c) => c.definitionId === 'eight-trigrams')) score += w.trigrams;
  score += held === 0 ? w.emptyHand : Math.min(held, w.handCap) * w.perHandCard;
  score += Math.min(hostileActs(view, me, target), w.threatCap) * w.threat;
  return score;
};
