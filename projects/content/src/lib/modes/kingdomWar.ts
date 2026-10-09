import type {
  GameModeDefinition,
  GameState,
  ContentRegistry,
  DamageDealtEvent,
  HpLostEvent,
  SeatEliminatedEvent,
  SkillTrigger,
  TriggerPoint,
  PhaseChangedEvent,
  CardZone,
  Seat,
  RngState,
} from 'engine';
import { buildDeck, drawTop, shuffle } from 'engine';
import { cardsData } from '../../../data/cards';
import { judgmentPhaseTrigger } from '../shared/delayed';

export const GENERALS_PER_SEAT = 5;
// A real Kingdom War table seats at most 10.
export const MAX_KINGDOM_WAR_SEATS = 10;

export function kingdomWarMaxSeats(registry: ContentRegistry): number {
  return Math.min(MAX_KINGDOM_WAR_SEATS, Math.floor(registry.generals.size / GENERALS_PER_SEAT));
}

function hasSameKingdomPair(generalIds: string[], registry: ContentRegistry): boolean {
  const kingdoms = generalIds.map((id) => registry.generals.get(id)!.kingdom);
  return new Set(kingdoms).size < kingdoms.length;
}

// Deals GENERALS_PER_SEAT unique generals to each seat from a seeded shuffle of
// the whole registry. With four kingdoms, five candidates always contain a
// same-kingdom pair (pigeonhole); the check guards a future fifth kingdom or a
// smaller deal rather than silently seating an unplayable hand.
function dealCandidates(seatIds: string[], registry: ContentRegistry, rng: RngState) {
  const { items: pool, rng: afterShuffle } = shuffle([...registry.generals.keys()].sort(), rng);
  const candidates: Record<string, string[]> = {};
  seatIds.forEach((seatId, index) => {
    const dealt = pool.slice(index * GENERALS_PER_SEAT, (index + 1) * GENERALS_PER_SEAT);
    if (!hasSameKingdomPair(dealt, registry)) {
      throw new Error(`Seat ${seatId} was dealt no same-kingdom pair: ${dealt.join(', ')}`);
    }
    candidates[seatId] = dealt;
  });
  return { candidates, rng: afterShuffle };
}

// Exactly one card per printing in the data, at every table size: the deck
// holds each card's printed quantity. Big tables lean on the reshuffle.
// Only a card's own printings: the extra copies other expansions add (tagged
// with their expansion) stay out until expansions can be switched on.
function buildDeckSpec(registry: ContentRegistry) {
  return [...registry.cards.keys()].flatMap((cardId) => {
    // Made only by a skill (Blaze): never dealt.
    if (registry.cards.get(cardId)?.outOfDeck) return [];
    const all = Object.prototype.hasOwnProperty.call(cardsData, cardId) ? cardsData[cardId].printings ?? [] : [];
    const printings = all.filter((p) => !p.expansion);
    // A card with no printings would silently never be dealt.
    if (printings.length === 0) throw new Error(`Card "${cardId}" has no printings in the data, so it cannot be put in the deck`);
    return printings.map(({ suit, rank }) => ({ definitionId: cardId, suit, rank }));
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

// The seat whose HP just dropped: a damaged seat, or one that lost HP.
function droppedSeatId(subject: unknown): string | null {
  const event = subject as DamageDealtEvent | HpLostEvent;
  if (event.kind === 'HpLostEvent') return event.seatId;
  return event.damage.target.kind === 'seat' ? event.damage.target.seatId : null;
}

// What happens when a seat's HP drops, by damage or by losing HP: at half its
// max HP or below its Main General is revealed; at 0 or below its Deputy too,
// and it is dying (the rescue round asks every living seat in turn order from
// the turn owner).
function hpDropTriggers(point: TriggerPoint): SkillTrigger[] {
  const seatOf = (state: GameState, subject: unknown) => state.seats.find((s) => s.id === droppedSeatId(subject));
  return [
    {
      point,
      condition: (state, subject) => {
        const seat = seatOf(state, subject);
        return !!seat && !!seat.generals && !seat.generals.main.revealed && seat.combinedHp <= Math.floor(seat.maxCombinedHp / 2);
      },
      effect: (_state, subject) => [{ kind: 'RevealGeneralAction', seatId: droppedSeatId(subject)!, slot: 'main' as const }],
    },
    {
      point,
      condition: (state, subject) => {
        const seat = seatOf(state, subject);
        return !!seat && !!seat.generals && !seat.generals.deputy.revealed && seat.combinedHp <= 0;
      },
      effect: (_state, subject) => [{ kind: 'RevealGeneralAction', seatId: droppedSeatId(subject)!, slot: 'deputy' as const }],
    },
    {
      point,
      condition: (state, subject) => {
        const seat = seatOf(state, subject);
        return !!seat && !seat.eliminated && seat.combinedHp <= 0;
      },
      effect: (state, subject) => {
        const seat = seatOf(state, subject)!;
        const event = subject as DamageDealtEvent | HpLostEvent;
        const amount = event.kind === 'HpLostEvent' ? event.amount : event.damage.amount;
        return [{
          kind: 'DyingEffect',
          seatId: seat.id,
          order: turnOrderFrom(state, state.turn.ownerSeatId),
          rescueCardIds: RESCUE_CARD_IDS,
          entering: true,
          // How many points of HP this drop took below 1 (Refusing Death turns one card each).
          pointsBelowOne: Math.min(amount, 1 - seat.combinedHp),
        }];
      },
    },
  ];
}

export const kingdomWarMode: GameModeDefinition = {
  id: 'kingdom-war',
  maxSeats: kingdomWarMaxSeats,

  setup: (seatIds, registry, rng) => {
    const limit = kingdomWarMaxSeats(registry);
    if (seatIds.length < 2 || seatIds.length > limit) {
      throw new Error(
        `Kingdom War needs between 2 and ${limit} seats with ${registry.generals.size} generals; got ${seatIds.length}`
      );
    }
    const { candidates, rng: afterDeal } = dealCandidates(seatIds, registry, rng);

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
      equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` }, pile: { zoneId: `${id}:pile` },
      eliminated: false,
    }));

    const { cards, rng: afterShuffle } = buildDeck(buildDeckSpec(registry), afterDeal);
    let zones: CardZone[] = [
      { id: 'drawPile', kind: 'drawPile' as const, cards },
      { id: 'discardPile', kind: 'discardPile' as const, cards: [] },
      { id: 'processing', kind: 'processing' as const, cards: [] },
      ...seats.flatMap((s) => [
        { id: s.hand.zoneId, kind: 'hand' as const, ownerSeatId: s.id, cards: [] },
        { id: s.equipped.zoneId, kind: 'equip' as const, ownerSeatId: s.id, cards: [] },
        { id: s.judgment.zoneId, kind: 'judgment' as const, ownerSeatId: s.id, cards: [] },
        { id: `${s.id}:pile`, kind: 'pile' as const, ownerSeatId: s.id, cards: [] },
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
    // A seat that is out discards every card it holds: hand, equipment and
    // Judgment slot (so a Lightning there stays in the game).
    {
      point: 'after:SeatEliminatedEvent',
      condition: () => true,
      effect: (state, subject) => {
        const { seatId } = subject as SeatEliminatedEvent;
        const seat = state.seats.find((s) => s.id === seatId);
        return seat ? [seat.hand, seat.equipped, seat.judgment, ...(seat.pile ? [seat.pile] : [])].map(({ zoneId }) => ({ kind: 'DiscardZoneEffect', zoneId })) : [];
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
    ...hpDropTriggers('after:DamageDealtEvent'),
    ...hpDropTriggers('after:HpLostEvent'),
  ],
};
