import { answersNeededAgainst, attackRange, seatDistance } from 'content';
import { conversionCards, conversionsOf, livingSeatOrderFrom } from 'engine';
import type { ContentRegistry, GameState, Seat } from 'engine';
import { handCards, isShaCard } from './helpers';
import { isDangerous, relationOf, seatDanger } from './table';

// Duel outlook and exposure until the bot's next turn, from the redacted view (spec rules C1 and C2).

// First values, tunable.
export const EXPOSURE_WEIGHTS = {
  shaPerHandCard: 0.3, reachHandSize: 3, threatBase: 0.1, threatPerCard: 0.1, threatCap: 0.75, weaponBonus: 0.25,
  dangerousBonus: 0.5, truceFactor: 0.2, peach: 1.5, spareShan: 1, armor: 0.3, allyWithCards: 0.3, allyCardsNeeded: 2,
} as const;

const W = EXPOSURE_WEIGHTS;
const HIDDEN_CARD = 'hidden';

const countIn = (view: GameState, seat: Seat, definitionId: string) =>
  handCards(view, seat).filter((c) => c.definitionId === definitionId).length;
const wears = (view: GameState, seat: Seat, slot: 'weapon' | 'armor', registry: ContentRegistry) =>
  (view.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? []).some((c) => registry.cards.get(c.definitionId)?.equipSlot === slot);

// Rule C1: the Sha the bot can play: Sha in hand, plus one per other hand card a revealed conversion turns into Sha.
export function playableSha(view: GameState, me: Seat, registry: ContentRegistry): number {
  const hand = handCards(view, me);
  const converted = new Set<string>();
  for (const owned of conversionsOf(view, me.id, registry)) {
    if (owned.needsReveal || owned.conversion.as !== 'sha') continue;
    for (const c of conversionCards(view, me.id, owned.conversion, registry)) converted.add(c.instanceId);
  }
  const plain = hand.filter((c) => isShaCard(registry, c.definitionId)).length;
  return plain + hand.filter((c) => !isShaCard(registry, c.definitionId) && converted.has(c.instanceId)).length;
}

// Rule C1: the Sha a seat is expected to hold: face-shown Sha plus a share of its hidden hand cards.
export function expectedSha(view: GameState, seat: Seat, registry: ContentRegistry): number {
  const hand = handCards(view, seat);
  const hidden = hand.filter((c) => c.definitionId === HIDDEN_CARD).length;
  const visible = hand.filter((c) => c.definitionId !== HIDDEN_CARD && isShaCard(registry, c.definitionId)).length;
  return visible + W.shaPerHandCard * hidden;
}

// Rule C1: in a Duel dealt to the bot it answers first, so it outlasts only with strictly more rounds to pay.
export function duelOutlook(view: GameState, me: Seat, opponent: Seat, registry: ContentRegistry): 'outlast' | 'lose' {
  const mine = Math.floor(playableSha(view, me, registry) / answersNeededAgainst(view, opponent.id, registry));
  const theirs = Math.floor(expectedSha(view, opponent, registry) / answersNeededAgainst(view, me.id, registry));
  return mine > theirs ? 'outlast' : 'lose';
}

export interface Exposure {
  threat: number;
  protection: number;
  exposed: boolean;
  // How many seats were counted as threats.
  threatSeats: number;
}

// Rule C2: whether the seats acting before the bot's next turn could finish it, after the pending hit is taken
// (`hpAfter`) and `after.shanUsed` Shan are spent.
export function exposure(
  view: GameState, me: Seat, registry: ContentRegistry, danger: (generalId: string) => number, after: { shanUsed: number },
): Exposure {
  // The pending hit: a Sha's or Tool's outcome, or what losing a Duel or a demand costs (its context effect).
  const pending = view.pendingResponse?.outcome ?? view.pendingResponse?.context.effect;
  const hit = pending?.kind === 'DamageEffect' && pending.damage.target.kind === 'seat' && pending.damage.target.seatId === me.id
    ? pending.damage.amount
    : 0;
  const hpAfter = me.combinedHp - hit;

  const before = livingSeatOrderFrom(view, view.turn.ownerSeatId);
  const mineAt = before.indexOf(me.id);
  // On the bot's own turn every other living seat still acts before its next one.
  const acting = mineAt === -1 ? [] : view.turn.ownerSeatId === me.id ? before.slice(1) : before.slice(0, mineAt);
  let threat = 0;
  let threatSeats = 0;
  for (const id of acting) {
    const seat = view.seats.find((s) => s.id === id)!;
    const relation = relationOf(view, me, seat);
    if (relation === 'self' || relation === 'ally') continue;
    const cards = handCards(view, seat).length;
    if (seatDistance(view, seat.id, me.id, registry) > attackRange(view, seat.id, registry) && cards < W.reachHandSize) continue;
    let t = Math.min(W.threatCap, W.threatBase + W.threatPerCard * cards);
    if (wears(view, seat, 'weapon', registry)) t += W.weaponBonus;
    if (isDangerous(seatDanger(view, seat, registry, danger))) t += W.dangerousBonus;
    threat += relation === 'truce' ? t * W.truceFactor : t;
    threatSeats += 1;
  }

  const allies = view.seats.filter((s) => !s.eliminated && relationOf(view, me, s) === 'ally' && handCards(view, s).length >= W.allyCardsNeeded).length;
  const protection =
    W.peach * countIn(view, me, 'peach') +
    W.spareShan * Math.max(0, countIn(view, me, 'shan') - after.shanUsed) +
    (wears(view, me, 'armor', registry) ? W.armor : 0) +
    W.allyWithCards * allies;
  return { threat, protection, exposed: threat - protection >= hpAfter, threatSeats };
}
