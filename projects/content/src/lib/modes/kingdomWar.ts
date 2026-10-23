import type {
  GameModeDefinition,
  GameState,
  ContentRegistry,
  DamageDealtEvent,
  HpLostEvent,
  SeatEliminatedEvent,
  GeneralsChosenEvent,
  GeneralRevealedEvent,
  Effect,
  SkillTrigger,
  TriggerPoint,
  PhaseChangedEvent,
  CardZone,
  Seat,
  RngState,
} from 'engine';
import { buildDeck, drawTop, shuffle } from 'engine';
import { alternateCardData } from '../alternateCards';
import { deckFor } from '../decks';
import type { DeckDefinition, DeckId } from '../decks';
import { isAlternateGeneralId } from '../generalIds';
import { judgmentPhaseTrigger } from '../shared/delayed';
import { peachLockedTo } from '../shared/abilities';

export const GENERALS_PER_SEAT = 5;
// A real Kingdom War table seats at most 10.
export const MAX_KINGDOM_WAR_SEATS = 10;

// The sorted ids of the Generals a deck deals from: the `alternate:` ones for Alternate, every other id
// (fillers included) for Default.
export function generalPool(registry: ContentRegistry, deck: DeckId): string[] {
  return [...registry.generals.keys()].filter((id) => isAlternateGeneralId(id) === (deck === 'alternate')).sort();
}

export function kingdomWarMaxSeats(registry: ContentRegistry, deck: DeckId = 'default'): number {
  return Math.min(MAX_KINGDOM_WAR_SEATS, Math.floor(generalPool(registry, deck).length / GENERALS_PER_SEAT));
}

function hasSameKingdomPair(generalIds: string[], registry: ContentRegistry): boolean {
  const kingdoms = generalIds.map((id) => registry.generals.get(id)!.kingdom);
  return new Set(kingdoms).size < kingdoms.length;
}

// Deals GENERALS_PER_SEAT unique generals to each seat from a seeded shuffle of
// the whole registry. With four kingdoms, five candidates always contain a
// same-kingdom pair (pigeonhole); the check guards a future fifth kingdom or a
// smaller deal rather than silently seating an unplayable hand. The Generals
// nobody was dealt are the spare pool (those that deal spare Generals stay out).
function dealCandidates(seatIds: string[], registry: ContentRegistry, poolIds: string[], rng: RngState) {
  const { items: pool, rng: afterShuffle } = shuffle(poolIds, rng);
  const candidates: Record<string, string[]> = {};
  seatIds.forEach((seatId, index) => {
    const dealt = pool.slice(index * GENERALS_PER_SEAT, (index + 1) * GENERALS_PER_SEAT);
    if (!hasSameKingdomPair(dealt, registry)) {
      throw new Error(`Seat ${seatId} was dealt no same-kingdom pair: ${dealt.join(', ')}`);
    }
    candidates[seatId] = dealt;
  });
  const spare = pool.slice(seatIds.length * GENERALS_PER_SEAT).filter((id) => !(registry.generals.get(id)?.skills ?? []).some((s) => s.spareGenerals));
  return { candidates, spare, rng: afterShuffle };
}

// Exactly one card per printing in the chosen deck, at every table size: the
// deck holds each card's printed quantity. Big tables lean on the reshuffle.
// A card the registry has no definition for yet is left out of the deal.
// Cards go in registry order, so a deck's order (and with it a seeded shuffle)
// does not depend on how its data file is ordered.
function buildDeckSpec(registry: ContentRegistry, deck: DeckDefinition) {
  const entries = new Map(deck.entries.map((e) => [e.cardId, e]));
  return [...registry.cards.keys()].flatMap((cardId) => {
    // A card marked outOfDeck (made only by a skill) is never dealt.
    if (registry.cards.get(cardId)?.outOfDeck) return [];
    const entry = entries.get(cardId);
    // The Default deck holds every playable card; other decks may hold fewer.
    if (!entry && deck.id !== 'default') return [];
    // A card only the Alternate deck has is no part of Default.
    if (!entry && alternateCardData(cardId)) return [];
    // A card with no printings would silently never be dealt.
    if (!entry || entry.printings.length === 0) throw new Error(`Card "${cardId}" has no printings in the data, so it cannot be put in the deck`);
    return entry.printings.map(({ suit, rank }) => ({ definitionId: cardId, suit, rank }));
  });
}

// Cards that can save a dying seat: anyone's Peach, and the dying seat's own Wine.
export const RESCUE_CARD_IDS = { any: ['peach'], self: ['wine'] };

// Living seats in turn order, starting with `firstSeatId`.
function turnOrderFrom(state: GameState, firstSeatId: string): string[] {
  const living = [...state.seats].filter((s) => !s.eliminated).sort((a, b) => a.index - b.index);
  const start = Math.max(0, living.findIndex((s) => s.id === firstSeatId));
  return [...living.slice(start), ...living.slice(0, start)].map((s) => s.id);
}

// One DealSpareGeneralsEffect per chosen General that deals spare Generals.
function spareDeals(state: GameState, seatId: string, registry?: ContentRegistry): Effect[] {
  const generals = state.seats.find((s) => s.id === seatId)?.generals;
  if (!generals || !registry) return [];
  return (['main', 'deputy'] as const).flatMap((slot) =>
    (registry.generals.get(generals[slot].generalDefinitionId)?.skills ?? []).flatMap((s) =>
      s.spareGenerals ? [{ kind: 'DealSpareGeneralsEffect' as const, seatId, slot, count: s.spareGenerals }] : []
    )
  );
}

// The seat whose HP just dropped: a damaged seat, or one that lost HP.
function droppedSeatId(subject: unknown): string | null {
  const event = subject as DamageDealtEvent | HpLostEvent;
  if (event.kind === 'HpLostEvent') return event.seatId;
  return event.damage.target.kind === 'seat' ? event.damage.target.seatId : null;
}

// What happens when a seat's HP drops, by damage or by losing HP: at 0 or below
// it is dying (the rescue round asks every living seat in turn order from the
// turn owner). Nothing is revealed by an HP drop; a death reveals both Generals.
function hpDropTriggers(point: TriggerPoint): SkillTrigger[] {
  const seatOf = (state: GameState, subject: unknown) => state.seats.find((s) => s.id === droppedSeatId(subject));
  return [
    {
      point,
      condition: (state, subject) => {
        const seat = seatOf(state, subject);
        return !!seat && !seat.eliminated && seat.combinedHp <= 0;
      },
      effect: (state, subject, _owner, registry) => {
        const seat = seatOf(state, subject)!;
        const event = subject as DamageDealtEvent | HpLostEvent;
        const amount = event.kind === 'HpLostEvent' ? event.amount : event.damage.amount;
        const everyone = turnOrderFrom(state, state.turn.ownerSeatId);
        // Complete Kill: in its owner's turn only the owner and the dying seat are asked.
        const locked = registry ? peachLockedTo(state, registry) : null;
        return [{
          kind: 'DyingEffect',
          seatId: seat.id,
          order: locked ? everyone.filter((id) => id === locked || id === seat.id) : everyone,
          rescueCardIds: RESCUE_CARD_IDS,
          entering: true,
          // How many points of HP this drop took below 1 (Refusing Death turns one card each).
          pointsBelowOne: Math.min(amount, 1 - seat.combinedHp),
          // The seat whose damage brought it down, for Heartbroken.
          ...(event.kind === 'DamageDealtEvent' && event.damage.source?.kind === 'seat' && event.damage.source.seatId !== seat.id ? { killerSeatId: event.damage.source.seatId } : {}),
        }];
      },
    },
  ];
}

// The first-reveal rule needs a table of at least this many seats.
export const FIRST_REVEAL_MIN_SEATS = 5;

// Whether the reveal just logged is the first time both of `seatId`'s Generals
// stand revealed: a General hidden and revealed again (GeneralHiddenEvent) pays
// no second bonus. With no General of the seat ever hidden, that is every reveal
// that leaves both revealed (as before hiding existed, built states included).
function firstTimeBothRevealed(state: GameState, seatId: string): boolean {
  const ofSeat = state.log.filter((e) => (e.kind === 'GeneralRevealedEvent' || e.kind === 'GeneralHiddenEvent') && e.seatId === seatId);
  if (!ofSeat.some((e) => e.kind === 'GeneralHiddenEvent')) return true;
  const shown = new Set<string>();
  let times = 0;
  for (const e of ofSeat) {
    if (e.kind === 'GeneralHiddenEvent') {
      shown.delete(e.slot);
    } else if (e.kind === 'GeneralRevealedEvent' && !shown.has(e.slot)) {
      shown.add(e.slot);
      if (shown.size === 2 && !e.onDeath) times++;
    }
  }
  return times === 1;
}

// Common table rules on revealing Generals. Both fire after the reveal is logged.
const revealBonusTriggers: SkillTrigger[] = [
  // Optional rule: the first General revealed at the table draws 2 cards.
  {
    point: 'after:GeneralRevealedEvent',
    condition: (state, subject) =>
      !!state.rules?.firstRevealDraw &&
      state.seats.length >= FIRST_REVEAL_MIN_SEATS &&
      !(subject as GeneralRevealedEvent).onDeath &&
      state.log.filter((e) => e.kind === 'GeneralRevealedEvent' && !e.onDeath).length === 1,
    effect: (_state, subject) => [{ kind: 'DrawCardsEffect', seatId: (subject as GeneralRevealedEvent).seatId, count: 2 }],
  },
  // A combined max HP that was rounded down (the printed sum is odd): revealing
  // the second General draws 1 card.
  {
    point: 'after:GeneralRevealedEvent',
    condition: (state, subject, _owner, registry) => {
      const event = subject as GeneralRevealedEvent;
      if (event.onDeath) return false;
      const generals = state.seats.find((s) => s.id === event.seatId)?.generals;
      if (!generals || !generals.main.revealed || !generals.deputy.revealed || !registry) return false;
      if (!firstTimeBothRevealed(state, event.seatId)) return false;
      const printed = [generals.main, generals.deputy].map((g) => registry.generals.get(g.generalDefinitionId)?.maxHp ?? 0);
      return (printed[0] + printed[1]) % 2 === 1;
    },
    effect: (_state, subject) => [{ kind: 'DrawCardsEffect', seatId: (subject as GeneralRevealedEvent).seatId, count: 1 }],
  },
];

export const kingdomWarMode: GameModeDefinition = {
  id: 'kingdom-war',
  maxSeats: kingdomWarMaxSeats,

  setup: (seatIds, registry, rng, rules) => {
    const deck = deckFor(rules?.deck);
    const poolIds = generalPool(registry, deck.id);
    const limit = kingdomWarMaxSeats(registry, deck.id);
    if (seatIds.length < 2 || seatIds.length > limit) {
      throw new Error(
        `Kingdom War needs between 2 and ${limit} seats with ${poolIds.length} generals; got ${seatIds.length}`
      );
    }
    const { candidates, spare, rng: afterDeal } = dealCandidates(seatIds, registry, poolIds, rng);

    // Generals, kingdom and HP are set when each seat resolves its
    // ChooseGeneralsAction during the GeneralSelection phase.
    const seats: Seat[] = seatIds.map((id, index) => ({
      id,
      index,
      kingdom: 'hidden',
      generals: null,
      combinedHp: 0,
      maxCombinedHp: 0,
      hand: { zoneId: `${id}:hand` },
      equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, pile: { zoneId: `${id}:pile` }, stash: { zoneId: `${id}:stash` },
      eliminated: false,
    }));

    const { cards, rng: afterShuffle } = buildDeck(buildDeckSpec(registry, deck), afterDeal);
    let zones: CardZone[] = [
      { id: 'drawPile', kind: 'drawPile' as const, cards },
      { id: 'discardPile', kind: 'discardPile' as const, cards: [] },
      { id: 'processing', kind: 'processing' as const, cards: [] },
      ...seats.flatMap((s) => [
        { id: s.hand.zoneId, kind: 'hand' as const, ownerSeatId: s.id, cards: [] },
        { id: s.equipped.zoneId, kind: 'equip' as const, ownerSeatId: s.id, cards: [] },
        { id: s.judgment.zoneId, kind: 'judgment' as const, ownerSeatId: s.id, cards: [] },
        { id: `${s.id}:pile`, kind: 'pile' as const, ownerSeatId: s.id, cards: [] },
        { id: `${s.id}:stash`, kind: 'pile' as const, ownerSeatId: s.id, cards: [] },
      ]),
    ];
    let currentRng = afterShuffle;
    for (const s of seats) {
      const drawResult = drawTop(zones, 'drawPile', s.hand.zoneId, 4, currentRng);
      zones = drawResult.zones;
      currentRng = drawResult.rng;
    }

    const state: GameState = {
      seats,
      // Default names by seat position; the application layer may rename players.
      players: seatIds.map((id, index) => ({ id: `player-${id}`, seatId: id, kind: 'bot' as const, name: `Seat ${index}` })),
      turn: { turnNumber: 1, ownerSeatId: seatIds[0], extraTurnStack: [] },
      phase: 'GeneralSelection',
      zones,
      pendingResponse: null,
      log: [],
      rng: currentRng,
      result: null,
      generalSelection: { candidates },
      spareGenerals: spare,
      ...(rules ? { rules } : {}),
    };
    return { state, rng: currentRng };
  },

  checkWinCondition: (state) => {
    const alive = state.seats.filter((s) => !s.eliminated);
    const losingSeatIds = state.seats.filter((s) => s.eliminated).map((s) => s.id);
    // Every seat eliminated at once (e.g. a mutual-damage effect): a draw. This
    // must produce a real GameResult — returning null here would mean "the game
    // continues", which for a table with no living seats never terminates.
    if (alive.length === 0) {
      return { endedAt: state.turn.turnNumber, winningSeatIds: [], losingSeatIds };
    }
    if (alive.length === 1) {
      return { endedAt: state.turn.turnNumber, winningSeatIds: [alive[0].id], losingSeatIds };
    }
    const kingdoms = new Set(alive.map((s) => s.kingdom));
    if (kingdoms.size === 1 && alive[0].kingdom !== 'Qun') {
      return {
        endedAt: state.turn.turnNumber,
        winningKingdom: alive[0].kingdom,
        winningSeatIds: alive.map((s) => s.id),
        losingSeatIds,
      };
    }
    return null;
  },

  triggers: [
    judgmentPhaseTrigger,
    ...revealBonusTriggers,
    // A seat that is out discards every card it holds: hand, equipment and
    // Judgment slot (so a Lightning there stays in the game).
    {
      point: 'after:SeatEliminatedEvent',
      condition: () => true,
      effect: (state, subject) => {
        const { seatId } = subject as SeatEliminatedEvent;
        const seat = state.seats.find((s) => s.id === seatId);
        return seat ? [seat.hand, seat.equipped, seat.judgment, ...(seat.pile ? [seat.pile] : []), ...(seat.stash ? [seat.stash] : [])].map(({ zoneId }) => ({ kind: 'DiscardZoneEffect', zoneId })) : [];
      },
    },
    // Kill reward and penalty: the seat whose damage killed another. Another
    // Kingdom (a killer with no revealed General always counts as one) draws one
    // card per living seat of the dead seat's Kingdom, the dead seat included;
    // the same Kingdom discards its whole hand. Qun is one Kingdom like the rest.
    {
      point: 'after:SeatEliminatedEvent',
      condition: (state, subject) => {
        const { seatId, killerSeatId } = subject as SeatEliminatedEvent;
        return !!killerSeatId && killerSeatId !== seatId && state.seats.some((s) => s.id === killerSeatId && !s.eliminated);
      },
      effect: (state, subject) => {
        const { seatId, killerSeatId } = subject as SeatEliminatedEvent;
        const dead = state.seats.find((s) => s.id === seatId)!;
        const killer = state.seats.find((s) => s.id === killerSeatId)!;
        const revealedAny = !!killer.generals && (killer.generals.main.revealed || killer.generals.deputy.revealed);
        if (revealedAny && killer.kingdom === dead.kingdom) return [{ kind: 'DiscardZoneEffect', zoneId: killer.hand.zoneId }];
        const count = state.seats.filter((s) => s.kingdom === dead.kingdom && (!s.eliminated || s.id === dead.id)).length;
        return [{ kind: 'DrawCardsEffect', seatId: killer.id, count }];
      },
    },
    {
      point: 'after:PhaseChangedEvent',
      condition: (_state, subject) => {
        const event = subject as PhaseChangedEvent;
        return event.phase === 'Draw';
      },
      effect: (_state, subject) => {
        const event = subject as PhaseChangedEvent;
        return [{ kind: 'DrawPhaseEffect', seatId: event.seatId, count: 2 }];
      },
    },
    // A seat that chose a General with spare Generals to deal gets them (Incarnation).
    {
      point: 'after:GeneralsChosenEvent',
      condition: (state, subject, _owner, registry) => spareDeals(state, (subject as GeneralsChosenEvent).seatId, registry).length > 0,
      effect: (state, subject, _owner, registry) => spareDeals(state, (subject as GeneralsChosenEvent).seatId, registry),
    },
    ...hpDropTriggers('after:DamageDealtEvent'),
    ...hpDropTriggers('after:HpLostEvent'),
  ],
};
