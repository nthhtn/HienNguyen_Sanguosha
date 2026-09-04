import { CardZone, CardInstance } from '../domain/types';

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

export function drawTop(
  zones: CardZone[],
  fromZoneId: string,
  toZoneId: string,
  count: number
): { zones: CardZone[]; drawn: CardInstance[] } {
  const source = zones.find((z) => z.id === fromZoneId);
  if (!source) throw new Error(`Zone ${fromZoneId} not found`);
  const drawn = source.cards.slice(0, count);
  const result = zones.map((zone) => {
    if (zone.id === fromZoneId) return { ...zone, cards: zone.cards.slice(count) };
    if (zone.id === toZoneId) return { ...zone, cards: [...zone.cards, ...drawn] };
    return zone;
  });
  return { zones: result, drawn };
}
