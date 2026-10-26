import { baseSkillId } from 'content';
import type { CardInstance, ContentRegistry, Effect, GameState, PendingChoice, PendingSelection, Seat } from 'engine';
import { handCards, isAlly, keepRank, leastUseful, ownCards, isShaCard } from './helpers';
import { devilCard } from './skills';

// The stage 8 spec's bot rules for the Wind skills.

const others = (view: GameState, me: Seat) => view.seats.filter((s) => !s.eliminated && s.id !== me.id);
const hurt = (s: Seat) => s.combinedHp < s.maxCombinedHp;
const weakest = (seats: Seat[]) => [...seats].sort((a, b) => a.combinedHp - b.combinedHp || a.index - b.index)[0];
const declined = (choice: PendingChoice): Effect | undefined => choice.options.find((o) => o.id === 'decline')?.effects[0];
const heartLike = (c: CardInstance) => c.suit === 'heart' || c.suit === 'spade'; // spades count for Beauty's holder; Fantasy's selection filters exactly
const isEquipment = (registry: ContentRegistry, c: CardInstance) => registry.cards.get(c.definitionId)?.category === 'equipment';

export function wantsWind(view: GameState, me: Seat, choice: PendingChoice, registry: ContentRegistry): boolean | null {
  if (choice.reason.kind !== 'ability') return null;
  const target = view.seats.find((s) => s.id === (choice.reason as { targetSeatId?: string }).targetSeatId);
  const hand = handCards(view, me);
  switch (baseSkillId(choice.reason.abilityId)) {
    case 'entrench':
      return hand.length <= 2 && me.combinedHp >= 3 && !others(view, me).some((s) => isAlly(me, s, view) && hurt(s));
    case 'godspeed': {
      if (view.phase === 'Start') {
        const slot = view.zones.find((z) => z.id === me.judgment.zoneId)?.cards.length ?? 0;
        return slot === 0 && others(view, me).some((s) => !isAlly(me, s, view) && s.combinedHp <= 2);
      }
      // As the Play Phase begins: a hand Equipment card for a slot already filled, and no Sha to play.
      const worn = new Set((view.zones.find((z) => z.id === me.equipped.zoneId)?.cards ?? []).map((c) => registry.cards.get(c.definitionId)?.equipSlot));
      const spare = hand.some((c) => isEquipment(registry, c) && worn.has(registry.cards.get(c.definitionId)?.equipSlot));
      return spare && !hand.some((c) => isShaCard(registry, c.definitionId));
    }
    case 'strong-bow':
      return !!target && !isAlly(me, target, view);
    case 'refusing-death':
    case 'lightning-strike':
      return true;
    case 'fantasy': {
      const damage = declined(choice);
      const amount = damage?.kind === 'DamageEffect' ? damage.damage.amount : 1;
      return hand.some((c) => heartLike(c) && c.definitionId !== 'peach') && me.combinedHp - amount <= 2;
    }
    case 'dark-magic': {
      const shown = declined(choice);
      const black = ownCards(view, me).filter((c) => c.suit === 'spade' || c.suit === 'club').map((c) => c.instanceId);
      return shown?.kind === 'JudgmentShownEffect' && devilCard(view, me, shown.judgment, registry, black) !== null;
    }
    default:
      return null;
  }
}

export function windSelection(view: GameState, me: Seat, selection: PendingSelection, registry: ContentRegistry): string[] | 'cancel' | null {
  if (selection.reason.kind !== 'ability') return null;
  const eligible = selection.eligibleIds;
  switch (baseSkillId(selection.reason.abilityId)) {
    case 'godspeed':
    case 'refusing-death':
      return leastUseful(view, registry, eligible).slice(0, 1);
    case 'fantasy': {
      const spare = leastUseful(view, registry, eligible).filter((id) => keepRank(view, registry, id) < 4);
      return spare.length > 0 ? [spare[0]] : 'cancel';
    }
    case 'dark-magic': {
      const id = selection.then.kind === 'replace-judgment' ? devilCard(view, me, selection.then.judgment, registry, eligible) : null;
      return id ? [id] : 'cancel';
    }
    default:
      return null;
  }
}

export function windChoice(view: GameState, me: Seat, choice: PendingChoice): string | null {
  if (choice.reason.kind !== 'ability') return null;
  const reason = choice.reason;
  const seats = choice.options.flatMap((o) => (o.shows.kind === 'seat' ? [view.seats.find((s) => s.id === (o.shows as { seatId: string }).seatId)!] : []));
  switch (baseSkillId(reason.abilityId)) {
    case 'godspeed':
    case 'fantasy':
    case 'lightning-strike':
      return (weakest(seats.filter((s) => s.id !== me.id && !isAlly(me, s, view))) ?? seats.find((s) => s.id !== me.id) ?? seats[0])?.id ?? null;
    case 'bewilder': {
      const claimer = view.seats.find((s) => s.id === reason.owner.seatId);
      if (claimer && isAlly(me, claimer, view)) return 'believe';
      return me.combinedHp >= 3 && ['sha', 'peach', 'wuxie'].includes(reason.cardId ?? '') ? 'doubt' : 'believe';
    }
    default:
      return null;
  }
}
