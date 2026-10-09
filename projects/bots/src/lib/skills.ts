import type { Action, CardInstance, ContentRegistry, Effect, GameState, Judgment, PendingChoice, PendingSelection, Seat } from 'engine';
import { abilityUseKey, colourOf, conversionCards, conversionsOf, sameAbilityOwner } from 'engine';
import { definitionIdOf, handCards, isAlly, keepRank, leastUseful, mayReveal, ownCards } from './helpers';
import { wantsWind, windChoice, windSelection } from './wind';

// The General Skills spec's bot rules, skill by skill.

type UseSkill = Extract<Action, { kind: 'UseSkillAction' }>;
type UseConversion = Extract<Action, { kind: 'UseConversionAction' }>;

const living = (view: GameState) => view.seats.filter((s) => !s.eliminated);
const others = (view: GameState, me: Seat) => living(view).filter((s) => s.id !== me.id);
const hurt = (seat: Seat) => seat.combinedHp < seat.maxCombinedHp;
const byLowestHp = (seats: Seat[]) => [...seats].sort((a, b) => a.combinedHp - b.combinedHp || a.index - b.index);
const byHighestHp = (seats: Seat[]) => [...seats].sort((a, b) => b.combinedHp - a.combinedHp || a.index - b.index);
const handSize = (view: GameState, seat: Seat) => view.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0;

// A seat's gender as the table sees it: Main's while revealed, else Deputy's, else none.
export function genderOf(seat: Seat, registry: ContentRegistry): 'male' | 'female' | null {
  const generals = seat.generals;
  if (!generals) return null;
  const shown = generals.main.revealed ? generals.main : generals.deputy.revealed ? generals.deputy : null;
  return (shown && registry.generals.get(shown.generalDefinitionId)?.gender) ?? null;
}

// Whether a judgment card is good for the judged seat, by what reads it; null for a reader the bot doesn't know.
function goodForJudged(judgment: Judgment, card: CardInstance): boolean | null {
  const reader = judgment.reader.kind === 'card' ? judgment.reader.card.as : judgment.reader.owner.skillId;
  switch (reader) {
    case 'capture': return card.suit === 'heart';
    case 'starvation': return card.suit === 'club';
    case 'lightning': return !(card.suit === 'spade' && card.rank >= 2 && card.rank <= 9);
    case 'eight-trigrams':
    case 'iron-cavalry': return colourOf(card) === 'red';
    case 'river-goddess': return colourOf(card) === 'black';
    case 'unyielding': return card.suit !== 'heart';
    default: return null;
  }
}

// The delayed Tools the bot saves itself or an ally from.
const SAVES_FROM = new Set(['lightning', 'capture', 'starvation']);

// The hand card Devil replaces `judgment`'s card with, or null: only when it
// saves the bot or an ally from Lightning, Capture or Starvation, or hurts a
// non-ally, with the least useful card that flips the outcome.
export function devilCard(view: GameState, me: Seat, judgment: Judgment, registry: ContentRegistry, candidates: string[] = handCards(view, me).map((c) => c.instanceId)): string | null {
  const judged = view.seats.find((s) => s.id === judgment.seatId);
  const now = goodForJudged(judgment, judgment.card);
  if (!judged || now === null) return null;
  const wantGood = judged.id === me.id || isAlly(me, judged);
  if (wantGood && !(judgment.reader.kind === 'card' && SAVES_FROM.has(judgment.reader.card.as))) return null;
  if (now === wantGood) return null;
  const cards = view.zones.flatMap((z) => z.cards).filter((c) => candidates.includes(c.instanceId));
  const flips = cards.filter((c) => goodForJudged(judgment, c) === wantGood).map((c) => c.instanceId);
  return flips.length > 0 ? leastUseful(view, registry, flips)[0] : null;
}

const declined = (choice: PendingChoice): Effect | undefined => choice.options.find((o) => o.id === 'decline')?.effects[0];

// Whether to use a General's optional skill (an ask); null: not a skill ask.
export function wantsSkill(view: GameState, me: Seat, choice: PendingChoice, registry: ContentRegistry): boolean | null {
  if (choice.reason.kind !== 'ability' || choice.reason.owner.kind !== 'general') return null;
  const target = view.seats.find((s) => s.id === (choice.reason as { targetSeatId?: string }).targetSeatId);
  switch (choice.reason.abilityId) {
    case 'evil-hero':
    case 'feedback':
    case 'heavens-envy':
    case 'bestowed-rouse':
    case 'gathering-wisdom':
    case 'brave-gesture':
    case 'self-restraint':
    case 'river-goddess':
    case 'iron-cavalry':
    case 'astrology':
      return true;
    case 'unyielding':
      return !!target && !isAlly(me, target);
    case 'raid':
      return others(view, me).filter((s) => !isAlly(me, s) && handSize(view, s) > 0).length >= 2;
    case 'bare-the-chest':
      return handCards(view, me).filter((c) => c.definitionId === 'sha').length >= 2;
    case 'devil': {
      const shown = declined(choice);
      return shown?.kind === 'JudgmentShownEffect' && devilCard(view, me, shown.judgment, registry) !== null;
    }
    case 'displace':
      // A card to spare (ranked below Shan) and a non-ally other than the Sha's user to move it to.
      return ownCards(view, me).some((c) => keepRank(view, registry, c.instanceId) < 3) && others(view, me).some((s) => !isAlly(me, s) && s.id !== target?.id);
    default:
      return wantsWind(view, me, choice, registry);
  }
}

// What to pick in a skill's selection: ids, 'cancel', or null (not a skill selection the bot knows).
export function skillSelection(view: GameState, me: Seat, selection: PendingSelection, registry: ContentRegistry): string[] | 'cancel' | null {
  if (selection.reason.kind !== 'ability' || selection.reason.owner.kind !== 'general') return null;
  const owner = selection.reason.owner;
  const eligible = selection.eligibleIds;
  const hand = new Set(handCards(view, me).map((c) => c.instanceId));
  switch (selection.reason.abilityId) {
    case 'devil': {
      const id = selection.then.kind === 'replace-judgment' ? devilCard(view, me, selection.then.judgment, registry) : null;
      return id ? [id] : 'cancel';
    }
    case 'displace': {
      const spare = leastUseful(view, registry, eligible).filter((id) => keepRank(view, registry, id) < 3);
      return spare.length > 0 ? [spare[0]] : 'cancel';
    }
    case 'kindness': {
      const given = view.turn.abilityUses?.[`${abilityUseKey(owner)}/given`] ?? 0;
      const count = Math.max(eligible.length - 3, hurt(me) && given < 2 ? 2 - given : 0, 1);
      return leastUseful(view, registry, eligible).slice(0, Math.min(count, eligible.length));
    }
    case 'reconsider': {
      const below = eligible.filter((id) => hand.has(id) && keepRank(view, registry, id) < 3);
      return below.length > 0 ? below : 'cancel';
    }
    case 'marriage':
    case 'green-vesicle':
    case 'sow-discord':
      return leastUseful(view, registry, eligible).slice(0, selection.min);
    case 'sow-revolt': {
      const seats = eligible.map((id) => view.seats.find((s) => s.id === id)!).filter(Boolean);
      return [(byLowestHp(seats.filter((s) => !isAlly(me, s)))[0] ?? seats[0]).id];
    }
    case 'bestowed-rouse':
      return 'cancel'; // keep both cards
    case 'bewilder': {
      // A true claim if a card is what was named; else the least useful (a bluff).
      const as = selection.then.kind === 'skill-step' ? (selection.then.step.data?.['as'] as string | undefined) : undefined;
      const truthful = eligible.find((id) => view.zones.some((z) => z.cards.some((c) => c.instanceId === id && c.definitionId === as)));
      return [truthful ?? leastUseful(view, registry, eligible)[0]];
    }
    default:
      return windSelection(view, me, selection, registry);
  }
}

const SUIT_ORDER: CardInstance['suit'][] = ['heart', 'spade', 'club', 'diamond'];

// The suit `seatId` has shown least this game (cards it played, and cards
// shown from it); hearts first on a tie.
function leastShownSuit(view: GameState, seatId: string): CardInstance['suit'] {
  const seen: Record<string, number> = {};
  for (const event of view.log) {
    if (event.kind === 'CardPlayedEvent' && event.seatId === seatId) for (const c of event.card.physical) seen[c.suit] = (seen[c.suit] ?? 0) + 1;
  }
  return [...SUIT_ORDER].sort((a, b) => (seen[a] ?? 0) - (seen[b] ?? 0))[0];
}

// The option to pick in a skill's choice of a seat, suit or label (or who gets
// given cards); null when it isn't one the bot knows.
export function skillChoice(view: GameState, me: Seat, choice: PendingChoice): string | null {
  if (choice.reason.kind !== 'ability' || choice.reason.owner.kind !== 'general') return null;
  const seats = choice.options.flatMap((o) => (o.shows.kind === 'seat' ? [view.seats.find((s) => s.id === (o.shows as { seatId: string }).seatId)!] : []));
  const ally = seats.find((s) => s.id !== me.id && isAlly(me, s));
  const firstNonAlly = byLowestHp(seats.filter((s) => s.id !== me.id && !isAlly(me, s)))[0];
  switch (choice.reason.abilityId) {
    case 'kindness':
    case 'bestowed-rouse':
    case 'marriage':
      return (ally ?? seats[0])?.id ?? null;
    case 'green-vesicle':
      return (seats.find((s) => s.id === me.id) ?? ally ?? seats[0])?.id ?? null;
    case 'displace':
      return (firstNonAlly ?? seats[0])?.id ?? null;
    case 'sow-discord':
      // The first pick (no target yet): a non-ally; the second: the likelier winner.
      return (choice.reason.targetSeatId ? byHighestHp(seats)[0] : (firstNonAlly ?? seats[0]))?.id ?? null;
    case 'sow-revolt':
      return leastShownSuit(view, choice.reason.owner.seatId);
    case 'unyielding': {
      const pick = handSize(view, me) > 3 ? 'discard' : me.combinedHp > 1 ? 'damage' : 'discard';
      return choice.options.some((o) => o.id === pick) ? pick : choice.options[0].id;
    }
    default:
      return windChoice(view, me, choice);
  }
}

// Whether the bot uses `skillId` now, in its Play Phase.
function wantsActive(view: GameState, me: Seat, skillId: string, registry: ContentRegistry): boolean {
  const hand = handCards(view, me);
  const spare = hand.filter((c) => keepRank(view, registry, c.instanceId) < 4);
  const allies = others(view, me).filter((s) => isAlly(me, s));
  switch (skillId) {
    case 'battered-body':
      return me.combinedHp > 3 || (me.combinedHp > 2 && hand.some((c) => c.definitionId === 'peach'));
    case 'reconsider':
      return hand.some((c) => keepRank(view, registry, c.instanceId) < 3);
    case 'green-vesicle':
      return spare.length > 0 && (hurt(me) || allies.some(hurt));
    case 'marriage':
      return spare.length >= 2 && (hurt(me) || allies.some((s) => hurt(s) && genderOf(s, registry) === 'male'));
    case 'sow-revolt':
      return others(view, me).some((s) => !isAlly(me, s));
    case 'sow-discord': {
      const males = others(view, me).filter((s) => genderOf(s, registry) === 'male');
      return males.length >= 2 && males.some((s) => !isAlly(me, s));
    }
    case 'kindness': {
      const owner = { kind: 'general' as const, seatId: me.id, slot: 'main' as const, skillId };
      const given = (['main', 'deputy'] as const).reduce((n, slot) => n + (view.turn.abilityUses?.[`${abilityUseKey({ ...owner, slot })}/given`] ?? 0), 0);
      return allies.length > 0 && (hand.length > 3 || (hurt(me) && given < 2 && hand.length >= 2));
    }
    default:
      return false;
  }
}

const ACTIVE_ORDER = { early: ['battered-body', 'reconsider', 'green-vesicle', 'marriage'], late: ['sow-revolt', 'sow-discord', 'kindness'] } as const;

// The active skill to use now from `group`, if any: offered, wanted, and its
// General revealed or the bot willing to reveal it.
export function pickActiveSkill(view: GameState, me: Seat, legal: Action[], registry: ContentRegistry, group: 'early' | 'late'): UseSkill | undefined {
  const offered = legal.filter((a): a is UseSkill => a.kind === 'UseSkillAction' && a.owner.kind === 'general');
  for (const skillId of ACTIVE_ORDER[group]) {
    const action = offered.find((a) => a.owner.kind === 'general' && a.owner.skillId === skillId);
    if (!action || action.owner.kind !== 'general') continue;
    const revealed = !!me.generals?.[action.owner.slot].revealed;
    if ((revealed || mayReveal(me)) && wantsActive(view, me, skillId, registry)) return action;
  }
  return undefined;
}

// Whether a conversion is worth it: the bot may reveal its General if needed,
// and the least useful cards it would take hold no Peach.
export function conversionSpare(view: GameState, me: Seat, action: UseConversion, registry: ContentRegistry): boolean {
  const owned = conversionsOf(view, me.id, registry).find((o) => o.conversion.id === action.via.conversionId && sameAbilityOwner(o.owner, action.via.owner));
  if (!owned || (owned.needsReveal && !mayReveal(me))) return false;
  // A deferred claim (Bewilder): the bot bluffs only with more than 4 cards; a
  // true claim it makes with the real card itself.
  if (owned.conversion.deferred) return handCards(view, me).length > 4;
  const cards = leastUseful(view, registry, conversionCards(view, me.id, owned.conversion, registry).map((c) => c.instanceId)).slice(0, owned.conversion.cards);
  return cards.length === owned.conversion.cards && !cards.some((id) => definitionIdOf(view, id) === 'peach');
}

// The conversion abilities whose card selection the bot fills (least useful first).
export const CONVERSION_SKILLS: ReadonlySet<string> = new Set(['fighting-saint', 'dragon-courage', 'overturned-country', 'first-aid', 'country-scene', 'surprise']);
