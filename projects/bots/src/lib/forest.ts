import type { ContentRegistry, GameState, PendingChoice, PendingSelection, Seat } from 'engine';
import { livingSeatOrderFrom } from 'engine';
import { handCards, isAlly, keepRank } from './helpers';

// The stage 10 spec's bot rules for the Forest skills.

const others = (view: GameState, me: Seat) => view.seats.filter((s) => !s.eliminated && s.id !== me.id);
const handSize = (view: GameState, seat: Seat) => view.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0;
const cardCount = (view: GameState, seat: Seat) => handSize(view, seat) + (view.zones.find((z) => z.id === seat.equipped.zoneId)?.cards.length ?? 0);
const byWeakest = (seats: Seat[]) => [...seats].sort((a, b) => a.combinedHp - b.combinedHp || a.index - b.index);
const seatsOf = (view: GameState, choice: PendingChoice) =>
  choice.options.flatMap((o) => (o.shows.kind === 'seat' ? [view.seats.find((s) => s.id === (o.shows as { seatId: string }).seatId)!] : []));

// Alliance: a pair worth swapping is a short ally and a larger non-ally hand, at a cost the bot can pay with 2 or fewer cards.
const alliancePairs = (view: GameState, me: Seat) =>
  others(view, me).flatMap((ally) =>
    others(view, me)
      .filter((foe) => foe.id !== ally.id && isAlly(me, ally) && !isAlly(me, foe))
      .map((foe) => ({ ally, foe, cost: handSize(view, foe) - handSize(view, ally) }))
      .filter((p) => p.cost > 0 && p.cost <= 2 && p.cost <= cardCount(view, me))
  );

export function wantsForest(view: GameState, me: Seat, choice: PendingChoice): boolean | null {
  if (choice.reason.kind !== 'ability') return null;
  switch (choice.reason.abilityId) {
    case 'unnatural-death':
    case 'brave-spirit':
    case 'exile':
      return true;
    case 'resurgence':
      return me.maxCombinedHp - me.combinedHp >= 2;
    case 'intense-edge':
      return handCards(view, me).some((c) => c.rank >= 9);
    case 'charity':
      return handSize(view, me) <= 3;
    default:
      return null;
  }
}

export function wantsForestActive(view: GameState, me: Seat, skillId: string): boolean | null {
  switch (skillId) {
    case 'alliance':
      return alliancePairs(view, me).length > 0;
    case 'upheaval':
      return others(view, me).filter((s) => !isAlly(me, s)).length >= 3;
    default:
      return null;
  }
}

export function forestChoice(view: GameState, me: Seat, choice: PendingChoice, registry: ContentRegistry): string | null {
  if (choice.reason.kind !== 'ability') return null;
  const seats = seatsOf(view, choice);
  const nonAllies = seats.filter((s) => s.id !== me.id && !isAlly(me, s));
  switch (choice.reason.abilityId) {
    case 'exile': {
      // A non-ally with the fewest hand cards; else a face-down ally; else the first.
      const foe = [...nonAllies].sort((a, b) => handSize(view, a) - handSize(view, b) || a.index - b.index)[0];
      const down = seats.find((s) => s.id !== me.id && isAlly(me, s) && s.faceDown);
      return (foe ?? down ?? seats[0])?.id ?? null;
    }
    case 'collapse':
      return me.combinedHp >= 3 ? 'lose-hp' : 'reduce-max-hp';
    case 'upheaval': {
      const foe = byWeakest(seats.filter((s) => s.id !== me.id && !isAlly(me, s)))[0];
      return foe?.id ?? 'pass';
    }
    case 'charity': {
      const ally = seats.find((s) => s.id !== me.id && isAlly(me, s));
      return (ally ?? seats[0])?.id ?? null;
    }
    case 'brave-spirit': {
      // The skill's user picks an ally short of cards, else himself.
      if (seats.length > 0) {
        const ally = [...seats].filter((s) => s.id !== me.id && isAlly(me, s)).sort((a, b) => handSize(view, a) - handSize(view, b) || a.index - b.index)[0];
        return (ally ?? seats.find((s) => s.id === me.id) ?? seats[0]).id;
      }
      // The owner's mode: draw X and discard 1 for X of 2 or less, or when the picked seat has fewer spare cards than X; else draw 1 and discard X.
      const x = me.maxCombinedHp - me.combinedHp;
      const picked = view.seats.find((s) => s.id === (choice.reason as { targetSeatId?: string }).targetSeatId) ?? me;
      const spare = handCards(view, picked).filter((c) => keepRank(view, registry, c.instanceId) < 3).length;
      return x <= 2 || spare < x ? 'draw-x' : 'draw-1';
    }
    case 'alliance': {
      // The partner, at a cost of 2 or less: the non-ally with the largest hand, else any other; else cancel.
      const first = view.seats.find((s) => s.id === (choice.reason as { targetSeatId?: string }).targetSeatId);
      const kept = first ? seats.filter((s) => Math.abs(handSize(view, first) - handSize(view, s)) <= 2) : seats;
      const byHand = (list: Seat[]) => [...list].sort((a, b) => handSize(view, b) - handSize(view, a) || a.index - b.index)[0];
      // The ally fallback (and a `cancel` below) is unreachable: the first pick guarantees a non-ally partner with cost <= 2.
      // A `cancel` here would need a loop guard: it refunds the use, so Alliance would be offered again.
      const partner = byHand(kept.filter((s) => !isAlly(me, s))) ?? byHand(kept);
      return partner?.id ?? choice.options.find((o) => o.id === 'cancel')?.id ?? null;
    }
    default:
      return null;
  }
}

export function forestSelection(view: GameState, me: Seat, selection: PendingSelection, _registry: ContentRegistry): string[] | 'cancel' | null {
  if (selection.reason.kind !== 'ability') return null;
  if (selection.reason.abilityId === 'alliance' && selection.of === 'seats') {
    // The first seat: an ally that has a larger-handed non-ally to swap with.
    const ally = alliancePairs(view, me).map((p) => p.ally.id).find((id) => selection.eligibleIds.includes(id));
    return ally ? [ally] : 'cancel';
  }
  return null;
}

// Whether the Upheaval window's seat (the bot) is being asked to Sha a non-ally.
export const upheavalVictimIsFoe = (view: GameState, me: Seat, victimSeatId: string | undefined): boolean => {
  const victim = view.seats.find((s) => s.id === victimSeatId);
  return !!victim && !isAlly(me, victim) && livingSeatOrderFrom(view, me.id).includes(victim.id);
};
