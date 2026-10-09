import type { CardInstance, ContentRegistry, GameState, PendingChoice, PendingSelection, Seat } from 'engine';
import { livingSeatOrderFrom } from 'engine';
import { handCards, isAlly, keepRank, leastUseful } from './helpers';

// The stage 9 spec's bot rules for the Fire skills. Bots don't read content's
// range rules, so reach is the seats round the table plus a worn Weapon's
// range (horses aside).

const others = (view: GameState, me: Seat) => view.seats.filter((s) => !s.eliminated && s.id !== me.id);
const weakest = (seats: Seat[]) => [...seats].sort((a, b) => a.combinedHp - b.combinedHp || a.index - b.index)[0];
const handSize = (view: GameState, seat: Seat) => view.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0;
const cardOf = (view: GameState, id: string) => view.zones.flatMap((z) => z.cards).find((c) => c.instanceId === id);
const byRank = (view: GameState, ids: readonly string[]) => [...ids].sort((a, b) => (cardOf(view, a)?.rank ?? 0) - (cardOf(view, b)?.rank ?? 0));
const isWeapon = (registry: ContentRegistry, c: CardInstance) => registry.cards.get(c.definitionId)?.equipSlot === 'weapon';
const worn = (view: GameState, seat: Seat) => view.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? [];

// Seats apart round the table.
function ringDistance(view: GameState, from: Seat, to: Seat): number {
  const order = livingSeatOrderFrom(view, from.id);
  const i = order.indexOf(to.id);
  return i < 0 ? Infinity : Math.min(i, order.length - i);
}

// How far `seat` reaches: its worn Weapon's range, else 1.
const reach = (view: GameState, seat: Seat, registry: ContentRegistry) =>
  Math.max(1, ...worn(view, seat).map((c) => registry.cards.get(c.definitionId)?.weaponRange ?? 1));

// Non-allies within `seat`'s reach.
const nonAlliesInReach = (view: GameState, me: Seat, seat: Seat, registry: ContentRegistry) =>
  others(view, seat).filter((s) => s.id !== me.id && !isAlly(me, s) && ringDistance(view, seat, s) <= reach(view, seat, registry));

// A Weapon in hand for a Weapon slot already filled.
const spareWeapons = (view: GameState, me: Seat, registry: ContentRegistry) =>
  worn(view, me).some((c) => isWeapon(registry, c)) ? handCards(view, me).filter((c) => isWeapon(registry, c)) : [];

// The stronger non-allies Rouse the Tiger would compete with: a hand card, and another non-ally in reach.
const rousable = (view: GameState, me: Seat, registry: ContentRegistry) =>
  others(view, me).filter((s) => !isAlly(me, s) && s.combinedHp > me.combinedHp && handSize(view, s) > 0 && nonAlliesInReach(view, me, s, registry).length > 0);

const highCard = (view: GameState, me: Seat) => handCards(view, me).some((c) => c.rank >= 10);

// Clubs worth recasting: ranked below Shan (never a Peach).
const spareClubs = (view: GameState, me: Seat, registry: ContentRegistry, ids = handCards(view, me).map((c) => c.instanceId)) =>
  ids.filter((id) => cardOf(view, id)?.suit === 'club' && keepRank(view, registry, id) < 3);

export function wantsFireActive(view: GameState, me: Seat, skillId: string, registry: ContentRegistry): boolean | null {
  const hand = handCards(view, me);
  switch (skillId) {
    case 'shackle':
      return spareClubs(view, me, registry).length > 0;
    case 'assault':
      return nonAlliesInReach(view, me, me, registry).length > 0 && (spareWeapons(view, me, registry).length > 0 || me.combinedHp >= 3);
    case 'rouse-the-tiger':
      return highCard(view, me) && rousable(view, me, registry).length > 0;
    case 'heavens-justice':
      return hand.filter((c) => c.definitionId === 'sha').length >= 2 && highCard(view, me) && others(view, me).some((s) => !isAlly(me, s) && handSize(view, s) > 0);
    default:
      return null;
  }
}

export function wantsFire(view: GameState, me: Seat, choice: PendingChoice): boolean | null {
  if (choice.reason.kind !== 'ability') return null;
  const target = view.seats.find((s) => s.id === (choice.reason as { targetSeatId?: string }).targetSeatId);
  switch (choice.reason.abilityId) {
    case 'nirvana':
    case 'eight-arrays':
    case 'eternal-loyalty':
      return true;
    case 'sudden-attack':
      return !!target && !isAlly(me, target);
    case 'dueling-heroes':
      return handCards(view, me).length >= 3 && others(view, me).some((s) => !isAlly(me, s));
    default:
      return null;
  }
}

export function fireSelection(view: GameState, me: Seat, selection: PendingSelection, registry: ContentRegistry): string[] | 'cancel' | null {
  const eligible = selection.eligibleIds;
  const then = selection.then;
  // Competing: the user its highest card; a target its highest against a non-ally, its lowest against an ally.
  if (then.kind === 'skill-step' && (then.step.step === 'compete-user' || then.step.step === 'compete-target')) {
    const user = view.seats.find((s) => s.id === then.step.owner.seatId);
    const highest = then.step.step === 'compete-user' || !user || !isAlly(me, user);
    const ranked = byRank(view, eligible);
    return [highest ? ranked[ranked.length - 1] : ranked[0]];
  }
  // Blaze: show the least useful card; discard the least useful match.
  if (then.kind === 'card-step' && (then.step.step === 'blaze-shown' || then.step.step === 'blaze-hit')) {
    return leastUseful(view, registry, eligible).slice(0, 1);
  }
  if (selection.reason.kind !== 'ability') return null;
  const seats = eligible.map((id) => view.seats.find((s) => s.id === id)).filter((s): s is Seat => !!s);
  switch (selection.reason.abilityId) {
    case 'rouse-the-tiger': {
      const pick = weakest(rousable(view, me, registry).filter((s) => eligible.includes(s.id)));
      return pick ? [pick.id] : 'cancel';
    }
    case 'heavens-justice': {
      const pick = weakest(seats.filter((s) => !isAlly(me, s)));
      return pick ? [pick.id] : 'cancel';
    }
    case 'assault': {
      const spare = spareWeapons(view, me, registry).map((c) => c.instanceId).filter((id) => eligible.includes(id));
      return [spare[0] ?? leastUseful(view, registry, eligible)[0]];
    }
    case 'shackle': {
      const clubs = leastUseful(view, registry, spareClubs(view, me, registry, eligible));
      return clubs.length > 0 ? [clubs[0]] : 'cancel';
    }
    default:
      return null;
  }
}

export function fireChoice(view: GameState, me: Seat, choice: PendingChoice, registry: ContentRegistry): string | null {
  if (choice.reason.kind !== 'ability') return null;
  const seats = choice.options.flatMap((o) => (o.shows.kind === 'seat' ? [view.seats.find((s) => s.id === (o.shows as { seatId: string }).seatId)!] : []));
  const has = (id: string) => choice.options.some((o) => o.id === id);
  switch (choice.reason.abilityId) {
    case 'assault':
      if (has('lose-hp')) return has('discard-weapon') && (spareWeapons(view, me, registry).length > 0 || me.combinedHp < 3) ? 'discard-weapon' : 'lose-hp';
      return (weakest(seats.filter((s) => !isAlly(me, s))) ?? seats[0])?.id ?? null;
    case 'rouse-the-tiger':
      return (weakest(seats.filter((s) => s.id !== me.id && !isAlly(me, s))) ?? seats.find((s) => s.id !== me.id) ?? seats[0])?.id ?? null;
    case 'eternal-loyalty': {
      const short = (s: Seat) => s.maxCombinedHp - handSize(view, s);
      const ally = seats.filter((s) => s.id !== me.id && isAlly(me, s)).sort((a, b) => short(b) - short(a))[0];
      return (ally && short(ally) > short(me) ? ally : me).id;
    }
    case 'sudden-attack': {
      // A worn card (its worth is known), else the hidden hand.
      const equipment = choice.options.find((o) => o.shows.kind === 'card');
      return (equipment ?? choice.options[0])?.id ?? null;
    }
    default:
      return null;
  }
}

