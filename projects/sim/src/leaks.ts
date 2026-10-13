import { isFaceUpZoneKind, redactStateForSeat } from 'engine';
import type { CardInstance, EngineEvent, GameState } from 'engine';

const HIDDEN = 'hidden';

// General ids `viewerSeatId` must not learn: other seats' face-down Generals,
// the spare Generals they hold (bar the chosen one), other seats' selection
// candidates, and the Generals nobody was dealt. With no viewer (the shared
// log), every seat's.
export function secretGeneralIds(state: GameState, viewerSeatId: string | null): Set<string> {
  const ids = new Set<string>();
  for (const seat of state.seats) {
    if (seat.id === viewerSeatId) continue;
    if (seat.generals) {
      for (const general of [seat.generals.main, seat.generals.deputy]) if (!general.revealed) ids.add(general.generalDefinitionId);
    }
    for (const id of seat.forms?.held ?? []) if (id !== seat.forms?.chosen?.generalId) ids.add(id);
  }
  for (const [seatId, candidates] of Object.entries(state.generalSelection?.candidates ?? {})) {
    if (seatId !== viewerSeatId) candidates.forEach((id) => ids.add(id));
  }
  (state.spareGenerals ?? []).forEach((id) => ids.add(id));
  return ids;
}

// The real cards `viewerSeatId` can't see, by instance id: other seats' hands
// and the draw pile, bar the cards it is arranging.
function hiddenCards(state: GameState, viewerSeatId: string): Map<string, CardInstance> {
  const shown = new Set(state.pendingArrangement?.seatId === viewerSeatId ? state.pendingArrangement.cardInstanceIds : []);
  const hidden = new Map<string, CardInstance>();
  for (const zone of state.zones) {
    if (isFaceUpZoneKind(zone.kind) || (zone.kind === 'hand' && zone.ownerSeatId === viewerSeatId)) continue;
    for (const card of zone.cards) if (!shown.has(card.instanceId)) hidden.set(card.instanceId, card);
  }
  return hidden;
}

function isCardInstance(value: unknown): value is CardInstance {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Partial<CardInstance>;
  return typeof v.instanceId === 'string' && typeof v.definitionId === 'string' && typeof v.suit === 'string' && typeof v.rank === 'number';
}

// Visits every value inside `value`, with a readable path for the report.
function walk(value: unknown, visit: (v: unknown, path: string) => void, path: string): void {
  visit(value, path);
  if (Array.isArray(value)) value.forEach((v, i) => walk(v, visit, `${path}[${i}]`));
  else if (value !== null && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, visit, `${path}.${k}`);
}

// What `view` (as sent to `viewerSeatId`) gives away that it must not.
export function findViewLeaks(state: GameState, view: object, viewerSeatId: string): string[] {
  const leaks: string[] = [];
  if ('rng' in view) leaks.push(`${viewerSeatId}: the view carries the RNG state`);
  if ('log' in view) leaks.push(`${viewerSeatId}: the view carries the log, which is sent separately`);
  const generals = secretGeneralIds(state, viewerSeatId);
  const cards = hiddenCards(state, viewerSeatId);
  walk(
    view,
    (v, path) => {
      if (typeof v === 'string' && generals.has(v)) leaks.push(`${viewerSeatId}: ${path} names hidden General ${v}`);
      if (!isCardInstance(v)) return;
      const real = cards.get(v.instanceId);
      if (!real) return;
      if (v.definitionId !== HIDDEN) leaks.push(`${viewerSeatId}: ${path} shows hidden card ${v.instanceId} as ${v.definitionId}`);
      if (v.instanceId.includes(real.definitionId)) leaks.push(`${viewerSeatId}: ${path} hidden card id ${v.instanceId} names its card ${real.definitionId}`);
    },
    'view'
  );
  return leaks;
}

// What `events` (the log every seat sees) give away, judged against `state`,
// the state right after them.
export function findEventLeaks(state: GameState, events: readonly EngineEvent[]): string[] {
  const leaks: string[] = [];
  const generals = secretGeneralIds(state, null);
  const zoneKinds = new Map(state.zones.map((z) => [z.id, z.kind]));
  events.forEach((event, i) => {
    walk(
      event,
      (v, path) => {
        if (typeof v === 'string' && generals.has(v)) leaks.push(`log ${event.kind}: ${path} names hidden General ${v}`);
      },
      `events[${i}]`
    );
    if (event.kind === 'CardMovedEvent' && event.card) {
      const kind = zoneKinds.get(event.toZoneId);
      if (kind && !isFaceUpZoneKind(kind)) leaks.push(`log CardMovedEvent into ${event.toZoneId} shows ${event.card.definitionId}`);
    }
  });
  return leaks;
}

// Reshuffled cards were face up in the discard pile: under their old ids,
// everyone would know the new draw pile's order and what each seat draws.
export function findReshuffleLeaks(prev: GameState, next: GameState): string[] {
  const events = next.log.slice(prev.log.length);
  if (!events.some((e) => e.kind === 'DiscardPileReshuffledEvent')) return [];
  const before = new Set(prev.zones.filter((z) => z.kind === 'discardPile').flatMap((z) => z.cards.map((c) => c.instanceId)));
  const inDrawPile = next.zones.filter((z) => z.kind === 'drawPile').flatMap((z) => z.cards.map((c) => c.instanceId));
  const drawn = events.flatMap((e) => (e.kind === 'CardsDrawnEvent' ? e.cardInstanceIds : []));
  return [...new Set([...inDrawPile, ...drawn])]
    .filter((id) => before.has(id))
    .map((id) => `reshuffled card ${id} kept the id it had in the discard pile`);
}

// Every leak one step (prev → next) causes, for every seat.
export function findStepLeaks(prev: GameState, next: GameState): string[] {
  const leaks: string[] = [];
  for (const seat of next.seats) {
    const { rng, log, ...view } = redactStateForSeat(next, seat.id);
    leaks.push(...findViewLeaks(next, view, seat.id));
  }
  leaks.push(...findEventLeaks(next, next.log.slice(prev.log.length)));
  leaks.push(...findReshuffleLeaks(prev, next));
  return leaks;
}
