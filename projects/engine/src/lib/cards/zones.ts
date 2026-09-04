import { CardZone, CardInstance } from '../domain/types';
import { RngState, shuffle } from '../rng/rng';

export function moveCard(zones: CardZone[], cardInstanceId: string, toZoneId: string): CardZone[] {
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
// are available are drawn and no error is thrown.
export function drawTop(
  zones: CardZone[],
  fromZoneId: string,
  toZoneId: string,
  count: number,
  rng: RngState
): { zones: CardZone[]; drawn: CardInstance[]; rng: RngState } {
  const source = zones.find((z) => z.id === fromZoneId);
  if (!source) throw new Error(`Zone ${fromZoneId} not found`);

  let currentZones = zones;
  let currentRng = rng;

  if (source.cards.length < count) {
    const discardZone = currentZones.find((z) => z.kind === 'discardPile');
    if (discardZone && discardZone.cards.length > 0) {
      const shuffled = shuffle(discardZone.cards, currentRng);
      currentRng = shuffled.rng;
      currentZones = currentZones.map((zone) => {
        if (zone.id === discardZone.id) return { ...zone, cards: [] };
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
  return { zones: result, drawn, rng: currentRng };
}
