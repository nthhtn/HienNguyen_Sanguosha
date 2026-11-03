import type { CardInstance, ContentRegistry, GameState } from 'engine';
import { buildContentRegistry } from './registry';
import { attackRange, getSeatDistance, seatDistance } from './shared/queries';
import { shaTargetIds } from './shared/shaRules';

// The Wiki's Distance table: a few seats round a table, asked the game's own questions. The Wiki holds no distance rule of
// its own; it builds a small valid table and reads back what the game says.

// A seat at the table. Seats are numbered 1 to N round the table; seat 1 is the attacker. `mount`: a horse card id the seat wears.
export interface WikiDistanceSeat {
  n: number;
  out?: boolean;
  mount?: string;
}

export interface WikiDistanceInput {
  seats: WikiDistanceSeat[];
  // A weapon card id worn by seat 1.
  weapon?: string;
}

// `steps` and `distance` are null for seat 1 and for a seat that is out.
export interface WikiDistanceSeatResult {
  n: number;
  // Steps the short way round the living seats.
  steps: number | null;
  // The distance for targeting: steps with Mounts counted, never below 1.
  distance: number | null;
  // Whether a Sha from seat 1 may target this seat.
  canReach: boolean;
}

export interface WikiDistanceResult {
  // Seat 1's attack range.
  range: number;
  seats: WikiDistanceSeatResult[];
}

let registry: ContentRegistry | undefined;
const registryOnce = (): ContentRegistry => (registry ??= buildContentRegistry());

const seatId = (n: number) => `seat-${n}`;
const KINGDOMS = ['Wei', 'Shu', 'Wu', 'Qun'] as const;

function stateOf(input: WikiDistanceInput): GameState {
  const worn = (n: number): CardInstance[] => {
    const seat = input.seats.find((s) => s.n === n);
    const cards: CardInstance[] = [];
    if (seat?.mount) cards.push({ instanceId: `mount-${n}`, definitionId: seat.mount, suit: 'spade', rank: 7 });
    if (n === 1 && input.weapon) cards.push({ instanceId: 'weapon-1', definitionId: input.weapon, suit: 'spade', rank: 7 });
    return cards;
  };
  return {
    seats: input.seats.map((seat, index) => ({
      id: seatId(seat.n), index, kingdom: KINGDOMS[index % KINGDOMS.length], eliminated: !!seat.out,
      generals: { main: { generalDefinitionId: 'wiki', revealed: true }, deputy: { generalDefinitionId: 'wiki', revealed: true } },
      combinedHp: 4, maxCombinedHp: 4,
      hand: { zoneId: `${seatId(seat.n)}:hand` }, equipped: { zoneId: `${seatId(seat.n)}:equip` }, judgment: { zoneId: `${seatId(seat.n)}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: seatId(1), extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...input.seats.flatMap((seat) => [
        { id: `${seatId(seat.n)}:hand`, kind: 'hand' as const, ownerSeatId: seatId(seat.n), cards: [] },
        { id: `${seatId(seat.n)}:equip`, kind: 'equip' as const, ownerSeatId: seatId(seat.n), cards: worn(seat.n) },
        { id: `${seatId(seat.n)}:judgment`, kind: 'judgment' as const, ownerSeatId: seatId(seat.n), cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

// Distance, range and reach for each seat, from seat 1, as the game counts them.
export function wikiDistanceTable(input: WikiDistanceInput): WikiDistanceResult {
  const state = stateOf(input);
  const cards = registryOnce();
  const reachable = new Set(shaTargetIds(state, seatId(1), cards));
  return {
    range: attackRange(state, seatId(1), cards),
    seats: input.seats.map((seat) => {
      if (seat.n === 1 || seat.out) return { n: seat.n, steps: null, distance: null, canReach: false };
      return {
        n: seat.n,
        steps: getSeatDistance(state, seatId(1), seatId(seat.n)),
        distance: seatDistance(state, seatId(1), seatId(seat.n), cards),
        canReach: reachable.has(seatId(seat.n)),
      };
    }),
  };
}

// The weapons the Distance table offers, with their range as the game defines it.
const DEMO_WEAPONS = ['gender-swords', 'green-dragon-blade', 'fire-fan'];

export function wikiDistanceWeapons(): { id: string; range: number }[] {
  return DEMO_WEAPONS.map((id) => {
    const range = registryOnce().cards.get(id)?.weaponRange;
    if (range === undefined) throw new Error(`The Distance table's weapon has no range: ${id}`);
    return { id, range };
  });
}
