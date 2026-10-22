import { baseSkillId } from 'content';
import type { ContentRegistry, GameState, PendingChoice, PendingSelection, Seat } from 'engine';
import { cardCountsAs } from 'engine';
import { handCards, isAlly, keepRank, leastUseful } from './helpers';

// The stage 11 spec's bot rules for the Mountain skills.

const others = (view: GameState, me: Seat) => view.seats.filter((s) => !s.eliminated && s.id !== me.id);
const handSize = (view: GameState, seat: Seat) => view.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0;
const ours = (me: Seat, seat: Seat) => seat.id === me.id || isAlly(me, seat);
const zoneOf = (view: GameState, zoneId: string) => view.zones.find((z) => z.id === zoneId);
const seatsOf = (view: GameState, choice: PendingChoice) =>
  choice.options.flatMap((o) => (o.shows.kind === 'seat' ? [view.seats.find((s) => s.id === (o.shows as { seatId: string }).seatId)!] : []));

export interface BotMove { from: string; to: string; cardId: string }

// Clever Change's Play Phase move: a delayed Tool off our side onto a non-ally
// not holding one of that name, else a worn card off a non-ally onto our side
// where its slot is free.
export function bestMove(view: GameState, me: Seat, registry: ContentRegistry): BotMove | null {
  const living = view.seats.filter((s) => !s.eliminated);
  for (const from of living.filter((s) => ours(me, s))) {
    const judged = zoneOf(view, from.judgment.zoneId);
    for (const card of judged?.cards ?? []) {
      const name = cardCountsAs(judged!, card);
      const to = living.find((s) => {
        const there = zoneOf(view, s.judgment.zoneId);
        return !ours(me, s) && !(there?.cards ?? []).some((d) => cardCountsAs(there!, d) === name);
      });
      if (to) return { from: from.id, to: to.id, cardId: card.instanceId };
    }
  }
  const slotOf = (definitionId: string) => registry.cards.get(definitionId)?.equipSlot;
  for (const from of living.filter((s) => !ours(me, s))) {
    for (const card of zoneOf(view, from.equipped.zoneId)?.cards ?? []) {
      const slot = slotOf(card.definitionId);
      const to = slot && living.find((s) => ours(me, s) && !(zoneOf(view, s.equipped.zoneId)?.cards ?? []).some((w) => slotOf(w.definitionId) === slot));
      if (to) return { from: from.id, to: to.id, cardId: card.instanceId };
    }
  }
  return null;
}

// Zuo Ci's preference among Form skills: ones the bots can play, best first.
const FORM_PREFERENCE = ['brave-gesture', 'gathering-wisdom', 'astrology', 'kindness', 'reconsider', 'pleasure', 'lament', 'instigate'];

// The Lament's source, read off the ask's Use effects (the step it will queue).
function lamentSource(choice: PendingChoice): string | undefined {
  // A hidden owner's ask reveals first: the skill's step is not always the first effect.
  const step = choice.options.find((o) => o.id === 'use')?.effects.find((e) => e.kind === 'SkillStepEffect') as { data?: Record<string, unknown> } | undefined;
  return step?.data?.['source'] as string | undefined;
}

export function wantsMountain(view: GameState, me: Seat, choice: PendingChoice, registry: ContentRegistry): boolean | null {
  const reason = choice.reason;
  if (reason.kind !== 'ability') return null;
  switch (baseSkillId(reason.abilityId)) {
    case 'military-farm':
    case 'incarnation':
    case 'stubborn':
      return true;
    case 'decentralization':
      return handCards(view, me).length > 3;
    case 'lament': {
      const victim = view.seats.find((s) => s.id === reason.targetSeatId);
      const source = view.seats.find((s) => s.id === lamentSource(choice));
      // Good for its own side; a club or spade must not land on an ally.
      return !!victim && ours(me, victim) && (!source || source.id === victim.id || !ours(me, source));
    }
    case 'clever-change': {
      // Draw: two non-allies with hands worth taking from. Play: a move that helps. Never Judgment or Discard.
      if (view.phase === 'Draw') return others(view, me).filter((s) => !isAlly(me, s) && handSize(view, s) >= 2).length >= 2;
      if (view.phase === 'Play') return bestMove(view, me, registry) !== null;
      return false;
    }
    default:
      return null;
  }
}

export function wantsMountainActive(view: GameState, me: Seat, skillId: string, registry: ContentRegistry): boolean | null {
  switch (baseSkillId(skillId)) {
    case 'instigate':
      return others(view, me).some((s) => !isAlly(me, s) && handSize(view, s) <= 1);
    case 'direct-instruction': {
      const slotOf = (id: string) => registry.cards.get(id)?.equipSlot;
      const equipment = handCards(view, me).filter((c) => registry.cards.get(c.definitionId)?.category === 'equipment');
      return equipment.some((c) =>
        others(view, me).some((s) => isAlly(me, s) && !(zoneOf(view, s.equipped.zoneId)?.cards ?? []).some((w) => slotOf(w.definitionId) === slotOf(c.definitionId)))
      );
    }
    default:
      return null;
  }
}

export function mountainChoice(view: GameState, me: Seat, choice: PendingChoice, registry: ContentRegistry): string | null {
  if (choice.reason.kind !== 'ability') return null;
  const seats = seatsOf(view, choice);
  const ally = seats.find((s) => s.id !== me.id && isAlly(me, s));
  switch (baseSkillId(choice.reason.abilityId)) {
    case 'follow-the-master':
      return choice.options.some((o) => o.id === 'recover') ? 'recover' : null;
    case 'incarnation': {
      const skillOf = (id: string) => id.split('/')[1];
      const best = FORM_PREFERENCE.find((skill) => choice.options.some((o) => baseSkillId(skillOf(o.id)) === skill));
      return (choice.options.find((o) => baseSkillId(skillOf(o.id)) === best) ?? choice.options[0])?.id ?? null;
    }
    case 'decentralization': {
      const allies = seats.filter((s) => s.id !== me.id && isAlly(me, s)).sort((a, b) => handSize(view, b) - handSize(view, a) || a.index - b.index);
      const foes = seats.filter((s) => !isAlly(me, s)).sort((a, b) => handSize(view, a) - handSize(view, b) || a.index - b.index);
      return (allies[0] ?? foes[0] ?? seats[0])?.id ?? null;
    }
    case 'direct-instruction':
      return (ally ?? seats[0])?.id ?? null;
    case 'clever-change': {
      const move = bestMove(view, me, registry);
      const cardOptions = choice.options.every((o) => o.shows.kind === 'card');
      const want = move ? (cardOptions ? move.cardId : move.to) : null;
      return (choice.options.find((o) => o.id === want) ?? choice.options[0])?.id ?? null;
    }
    case 'stubborn': {
      // Give back the least useful of the discarded cards.
      const ids = choice.options.map((o) => o.id);
      return leastUseful(view, registry, ids)[0] ?? null;
    }
    default:
      return null;
  }
}

export function mountainSelection(view: GameState, me: Seat, selection: PendingSelection, registry: ContentRegistry): string[] | 'cancel' | null {
  if (selection.reason.kind !== 'ability') return null;
  const eligible = selection.eligibleIds;
  const step = selection.then.kind === 'skill-step' ? selection.then.step.step : null;
  // Eligible seats passing `pick`, the fullest hands first (`most`) or the emptiest first.
  const seatsByHand = (pick: (s: Seat) => boolean, order: 'most' | 'fewest') =>
    eligible
      .map((id) => view.seats.find((s) => s.id === id)!)
      .filter((s) => !!s && pick(s))
      .sort((a, b) => (order === 'most' ? handSize(view, b) - handSize(view, a) : handSize(view, a) - handSize(view, b)) || a.index - b.index);
  switch (baseSkillId(selection.reason.abilityId)) {
    case 'clever-change': {
      if (selection.of === 'cards') return leastUseful(view, registry, eligible).slice(0, 1);
      if (step === 'draw-take') {
        const foes = seatsByHand((s) => !isAlly(me, s), 'most').slice(0, 2).map((s) => s.id);
        return foes.length > 0 ? foes : [eligible[0]];
      }
      const move = bestMove(view, me, registry);
      return [move && eligible.includes(move.from) ? move.from : eligible[0]];
    }
    case 'pleasure': {
      // Pay only with a card it can spare (ranked below Shan).
      const spare = leastUseful(view, registry, eligible).filter((id) => keepRank(view, registry, id) < 3);
      return spare.length > 0 ? [spare[0]] : 'cancel';
    }
    case 'decentralization':
      return leastUseful(view, registry, eligible).slice(0, 1);
    case 'lament': {
      // The payment (cancel when only a Shan or Peach would go) or the club discard (it must pick).
      const least = leastUseful(view, registry, eligible).slice(0, selection.min);
      if (least.length === 0) return 'cancel';
      if (selection.then.kind === 'discard') return least;
      return keepRank(view, registry, least[0]) < 3 ? [least[0]] : 'cancel';
    }
    case 'direct-instruction':
      return eligible.slice(0, 1);
    case 'instigate': {
      const foes = seatsByHand((s) => !isAlly(me, s), 'fewest');
      return foes.length > 0 ? [foes[0].id] : 'cancel';
    }
    default:
      return null;
  }
}
