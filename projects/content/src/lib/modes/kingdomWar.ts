import type { GameModeDefinition, GameState, ContentRegistry, Kingdom, DamageDealtEvent, Target, CardZone } from 'engine';
import { buildDeck, drawTop } from 'engine';

const KINGDOM_ORDER: Kingdom[] = ['Wei', 'Shu', 'Wu', 'Qun'];
const SUITS = ['spade', 'heart', 'club', 'diamond'] as const;

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
  setup: (seatIds, registry, rng) => {
    const generalIds = [...registry.generals.keys()].sort();
    const seats = seatIds.map((id, index) => {
      const kingdom = KINGDOM_ORDER[index % KINGDOM_ORDER.length];
      const mainGeneralId = generalIds[(index * 2) % generalIds.length];
      const deputyGeneralId = generalIds[(index * 2 + 1) % generalIds.length];
      const maxCombinedHp = registry.generals.get(mainGeneralId)!.maxHp + registry.generals.get(deputyGeneralId)!.maxHp;
      return {
        id,
        index,
        kingdom,
        generals: {
          main: { generalDefinitionId: mainGeneralId, revealed: false },
          deputy: { generalDefinitionId: deputyGeneralId, revealed: false },
        },
        combinedHp: maxCombinedHp,
        maxCombinedHp,
        hand: { zoneId: `${id}:hand` },
        equipped: { zoneId: `${id}:equip` },
        eliminated: false,
      };
    });

    const { cards, rng: afterShuffle } = buildDeck(buildDeckSpec(registry), rng);
    let zones: CardZone[] = [
      { id: 'drawPile', kind: 'drawPile' as const, cards },
      { id: 'discardPile', kind: 'discardPile' as const, cards: [] },
      ...seats.flatMap((s) => [
        { id: s.hand.zoneId, kind: 'hand' as const, ownerSeatId: s.id, cards: [] },
        { id: s.equipped.zoneId, kind: 'equip' as const, ownerSeatId: s.id, cards: [] },
      ]),
    ];
    for (const s of seats) {
      const drawResult = drawTop(zones, 'drawPile', s.hand.zoneId, 4);
      zones = drawResult.zones;
    }

    const state: GameState = {
      seats,
      players: seatIds.map((id) => ({ id: `player-${id}`, seatId: id, kind: 'bot' as const })),
      turn: { turnNumber: 1, ownerSeatId: seatIds[0], extraTurnStack: [] },
      phase: 'Judgment',
      zones,
      pendingResponse: null,
      log: [],
      rng: afterShuffle,
      result: null,
    };
    return { state, rng: afterShuffle };
  },

  checkWinCondition: (state) => {
    const alive = state.seats.filter((s) => !s.eliminated);
    if (alive.length === 0) return null;
    const losingSeatIds = state.seats.filter((s) => s.eliminated).map((s) => s.id);
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
      point: 'after:DamageDealtEvent',
      condition: (state, subject) => {
        const event = subject as DamageDealtEvent;
        if (event.damage.target.kind !== 'seat') return false;
        const seat = state.seats.find((s) => s.id === event.damage.target.seatId);
        return !!seat && !seat.generals.main.revealed && seat.combinedHp <= Math.floor(seat.maxCombinedHp / 2);
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
        return !!seat && !seat.generals.deputy.revealed && seat.combinedHp <= 0;
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
