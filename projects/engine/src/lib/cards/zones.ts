import { CardZone, CardInstance, GameState } from '../domain/types';
import { RngState, shuffle } from '../rng/rng';

// Locates a "well-known" zone (the draw pile, the discard pile, ...) by its
// `kind` rather than by a hardcoded id string. A GameModeDefinition is free to
// name its zones whatever it likes, so `kind` is the only reliable way for
// generic engine code to find them.
export function findZoneByKind(zones: CardZone[], kind: CardZone['kind']): CardZone | undefined {
  return zones.find((zone) => zone.kind === kind);
}

export function requireZoneOfKind(zones: CardZone[], kind: CardZone['kind']): CardZone {
  const zone = findZoneByKind(zones, kind);
  if (!zone) throw new Error(`No zone of kind '${kind}' exists in this game state`);
  return zone;
}

// A seat's Judgment slot (Seat.judgment), where its delayed Tools wait.
export function judgmentZoneOf(state: GameState, seatId: string): CardZone | undefined {
  const seat = state.seats.find((s) => s.id === seatId);
  return seat && state.zones.find((z) => z.id === seat.judgment.zoneId);
}

// The top `count` cards of the draw pile, top first (fewer if it holds fewer).
// They stay where they are (Astrology looks at them).
export function drawPileTop(state: GameState, count: number): CardInstance[] {
  return requireZoneOfKind(state.zones, 'drawPile').cards.slice(0, Math.max(0, count));
}

export function moveCard(zones: CardZone[], cardInstanceId: string, toZoneId: string): CardZone[] {
  // Validate the destination BEFORE detaching the card: an unknown destination
  // used to silently delete the card instance from the game.
  if (!zones.some((zone) => zone.id === toZoneId)) {
    throw new Error(`Destination zone ${toZoneId} not found (cannot move card ${cardInstanceId})`);
  }
  let moving: CardInstance | undefined;
  const withoutCard = zones.map((zone) => {
    const found = zone.cards.find((c) => c.instanceId === cardInstanceId);
    if (!found) return zone;
    moving = found;
    return { ...zone, cards: zone.cards.filter((c) => c.instanceId !== cardInstanceId) };
  });
  if (!moving) throw new Error(`Card ${cardInstanceId} not found in any zone`);
  return withoutCard.map((zone) =>
    zone.id === toZoneId ? { ...zone, cards: [...zone.cards, moving as CardInstance] } : zone
  );
}

// Draws the top `count` cards from `fromZoneId` into `toZoneId`. If `fromZoneId`
// doesn't hold enough cards to satisfy the request and a zone of kind
// 'discardPile' holds one or more cards, that discard pile is shuffled (via the
// same seeded shuffle used to build the initial deck) and moved into
// `fromZoneId` before drawing continues. Reshuffling happens at most once per
// call — if the combined total still can't satisfy `count`, as many cards as
// are available are drawn and no error is thrown. `reshuffled` is how many
// cards the reshuffle moved (0 when there was none). Cards named in
// `keepInDiscard` stay in the discard pile (e.g. the Tool being resolved).
export function drawTop(
  zones: CardZone[],
  fromZoneId: string,
  toZoneId: string,
  count: number,
  rng: RngState,
  keepInDiscard: readonly string[] = []
): { zones: CardZone[]; drawn: CardInstance[]; rng: RngState; reshuffled: number } {
  const source = zones.find((z) => z.id === fromZoneId);
  if (!source) throw new Error(`Zone ${fromZoneId} not found`);
  // Same asymmetry as moveCard had: an unknown destination would remove the
  // drawn cards from the source and never re-insert them anywhere.
  if (!zones.some((z) => z.id === toZoneId)) {
    throw new Error(`Destination zone ${toZoneId} not found (cannot draw into it)`);
  }

  let currentZones = zones;
  let currentRng = rng;
  let reshuffled = 0;

  if (source.cards.length < count) {
    const discardZone = findZoneByKind(currentZones, 'discardPile');
    const reshuffling = discardZone?.cards.filter((c) => !keepInDiscard.includes(c.instanceId)) ?? [];
    if (discardZone && reshuffling.length > 0) {
      const shuffled = shuffle(reshuffling, currentRng);
      currentRng = shuffled.rng;
      reshuffled = reshuffling.length;
      currentZones = currentZones.map((zone) => {
        if (zone.id === discardZone.id) return { ...zone, cards: zone.cards.filter((c) => keepInDiscard.includes(c.instanceId)) };
        if (zone.id === fromZoneId) return { ...zone, cards: [...zone.cards, ...shuffled.items] };
        return zone;
      });
    }
  }

  const refreshedSource = currentZones.find((z) => z.id === fromZoneId)!;
  const drawn = refreshedSource.cards.slice(0, count);
  const result = currentZones.map((zone) => {
    if (zone.id === fromZoneId) return { ...zone, cards: zone.cards.slice(count) };
    if (zone.id === toZoneId) return { ...zone, cards: [...zone.cards, ...drawn] };
    return zone;
  });
  return { zones: result, drawn, rng: currentRng, reshuffled };
}
