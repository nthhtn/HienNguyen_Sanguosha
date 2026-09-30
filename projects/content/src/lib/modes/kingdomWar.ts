import type {
  GameModeDefinition,
  GameState,
  ContentRegistry,
  DamageDealtEvent,
  PhaseChangedEvent,
  Target,
  CardZone,
  Seat,
  RngState,
} from 'engine';
import { buildDeck, drawTop, shuffle } from 'engine';

const SUITS = ['spade', 'heart', 'club', 'diamond'] as const;

export const GENERALS_PER_SEAT = 5;

export function kingdomWarMaxSeats(registry: ContentRegistry): number {
  return Math.floor(registry.generals.size / GENERALS_PER_SEAT);
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

function buildDeckSpec(registry: ContentRegistry) {
  const entries: { definitionId: string; suit: (typeof SUITS)[number]; rank: number }[] = [];
  let i = 0;
  for (const cardId of registry.cards.keys()) {
    for (let copy = 0; copy < 4; copy++) {
      entries.push({ definitionId: cardId, suit: SUITS[i % SUITS.length], rank: (i % 13) + 1 });
      i++;
    }
  }
  return entries;
}

function seatIdOfTarget(target: Target): string {
  if (target.kind !== 'seat') throw new Error('Expected a seat target');
  return target.seatId;
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
      equipped: { zoneId: `${id}:equip` },
      eliminated: false,
    }));

    const { cards, rng: afterShuffle } = buildDeck(buildDeckSpec(registry), afterDeal);
    let zones: CardZone[] = [
      { id: 'drawPile', kind: 'drawPile' as const, cards },
      { id: 'discardPile', kind: 'discardPile' as const, cards: [] },
      ...seats.flatMap((s) => [
        { id: s.hand.zoneId, kind: 'hand' as const, ownerSeatId: s.id, cards: [] },
        { id: s.equipped.zoneId, kind: 'equip' as const, ownerSeatId: s.id, cards: [] },
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
      players: seatIds.map((id) => ({ id: `player-${id}`, seatId: id, kind: 'bot' as const })),
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
    {
      point: 'after:PhaseChangedEvent',
      condition: (_state, subject) => {
        const event = subject as PhaseChangedEvent;
        return event.phase === 'Draw';
      },
      effect: (_state, subject) => {
        const event = subject as PhaseChangedEvent;
        return [{ kind: 'DrawCardsEffect', seatId: event.seatId, count: 2 }];
      },
    },
    {
      point: 'after:DamageDealtEvent',
      condition: (state, subject) => {
        const event = subject as DamageDealtEvent;
        if (event.damage.target.kind !== 'seat') return false;
        const seat = state.seats.find((s) => s.id === event.damage.target.seatId);
        return !!seat && !!seat.generals && !seat.generals.main.revealed && seat.combinedHp <= Math.floor(seat.maxCombinedHp / 2);
      },
      effect: (_state, subject) => {
        const event = subject as DamageDealtEvent;
        return [{ kind: 'RevealGeneralAction', seatId: seatIdOfTarget(event.damage.target), slot: 'main' as const }];
      },
    },
    {
      point: 'after:DamageDealtEvent',
      condition: (state, subject) => {
        const event = subject as DamageDealtEvent;
        if (event.damage.target.kind !== 'seat') return false;
        const seat = state.seats.find((s) => s.id === event.damage.target.seatId);
        return !!seat && !!seat.generals && !seat.generals.deputy.revealed && seat.combinedHp <= 0;
      },
      effect: (_state, subject) => {
        const event = subject as DamageDealtEvent;
        return [{ kind: 'RevealGeneralAction', seatId: seatIdOfTarget(event.damage.target), slot: 'deputy' as const }];
      },
    },
    {
      point: 'after:DamageDealtEvent',
      condition: (state, subject) => {
        const event = subject as DamageDealtEvent;
        if (event.damage.target.kind !== 'seat') return false;
        const seat = state.seats.find((s) => s.id === event.damage.target.seatId);
        return !!seat && !seat.eliminated && seat.combinedHp <= 0;
      },
      effect: (_state, subject) => {
        const event = subject as DamageDealtEvent;
        return [{ kind: 'EliminateSeatEffect', seatId: seatIdOfTarget(event.damage.target) }];
      },
    },
  ],
};
