import { isFaceUpZoneKind, redactEventsForSeat, redactStateForSeat } from 'engine';
import type { CardInstance, ContentRegistry, EngineEvent, GameState, Seat } from 'engine';

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
      if (v.rank !== 0) leaks.push(`${viewerSeatId}: ${path} shows hidden card ${v.instanceId}'s rank ${v.rank}`);
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

// The skill ids a General slot holds: its General's, any it gained, and the Form it chose.
function slotSkillIds(seat: Seat, slot: 'main' | 'deputy', registry: ContentRegistry): string[] {
  const general = seat.generals?.[slot];
  if (!general) return [];
  return [
    ...(registry.generals.get(general.generalDefinitionId)?.skills.map((s) => s.id) ?? []),
    ...(seat.gainedSkills ?? []).filter((g) => g.slot === slot).map((g) => g.skillId),
    ...(seat.forms?.slot === slot && seat.forms.chosen ? [seat.forms.chosen.skillId] : []),
  ];
}

// Skill ids `viewerSeatId` must not learn: those of other seats' face-down
// General slots, bar any it can see anyway (its own, or a shown General's).
export function secretSkillIds(state: GameState, viewerSeatId: string, registry: ContentRegistry): Set<string> {
  const secret = new Set<string>();
  const seen = new Set<string>();
  for (const seat of state.seats) {
    for (const slot of ['main', 'deputy'] as const) {
      const general = seat.generals?.[slot];
      if (!general) continue;
      const ids = slotSkillIds(seat, slot, registry);
      ids.forEach((id) => (seat.id === viewerSeatId || general.revealed ? seen : secret).add(id));
    }
  }
  seen.forEach((id) => secret.delete(id));
  return secret;
}

// Card and General identities, which may share an id with a skill (Dong Zhuo's Wine).
const IDENTITY_KEYS = new Set(['definitionId', 'generalDefinitionId', 'generalId']);
const SKILL_ID_KEYS = new Set(['skillId', 'abilityId', 'forAbilityId', 'conversionId']);

function wholeToken(ids: ReadonlySet<string>): RegExp | null {
  if (ids.size === 0) return null;
  const alternation = [...ids].sort((a, b) => b.length - a.length).map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`(?<![a-z0-9])(?:${alternation})(?![a-z0-9])`);
}

// Visits every string inside `value`, object keys included, with the key it sits under.
function walkStrings(value: unknown, visit: (text: string, key: string, path: string) => void, path: string, key = ''): void {
  if (typeof value === 'string') visit(value, key, path);
  else if (Array.isArray(value)) value.forEach((v, i) => walkStrings(v, visit, `${path}[${i}]`, key));
  else if (value !== null && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      visit(k, '', `${path} key ${k}`);
      walkStrings(v, visit, `${path}.${k}`, k);
    }
}

// Where `view` and `events` (both as sent to `viewerSeatId`) name a skill of
// another seat's face-down General, as a whole token in any string (bar card
// and General identities, which may share a skill's id: Dong Zhuo's Wine).
export function findSkillLeaks(state: GameState, view: object, events: readonly EngineEvent[], viewerSeatId: string, registry: ContentRegistry): string[] {
  const pattern = wholeToken(secretSkillIds(state, viewerSeatId, registry));
  if (!pattern) return [];
  const leaks: string[] = [];
  const visit = (text: string, key: string, path: string) => {
    // A card's own id (a conversion's `as`, a rescue card) names the card, not the skill.
    if (IDENTITY_KEYS.has(key) || (registry.cards.has(text) && !SKILL_ID_KEYS.has(key))) return;
    const hit = text.match(pattern);
    if (hit) leaks.push(`${viewerSeatId}: ${path} names hidden skill ${hit[0]} (${JSON.stringify(text)})`);
  };
  walkStrings(view, visit, 'view');
  events.forEach((event, i) => walkStrings(event, visit, `log ${event.kind} events[${i}]`));
  return leaks;
}

// Every leak one step (prev → next) causes, for every seat. With `registry`,
// also every hidden skill id a seat's view or its share of the new events names.
export function findStepLeaks(prev: GameState, next: GameState, registry?: ContentRegistry): string[] {
  const leaks: string[] = [];
  const events = next.log.slice(prev.log.length);
  for (const seat of next.seats) {
    const { rng, log, ...view } = redactStateForSeat(next, seat.id);
    leaks.push(...findViewLeaks(next, view, seat.id));
    if (registry) leaks.push(...findSkillLeaks(next, view, redactEventsForSeat(next, events, seat.id), seat.id, registry));
  }
  leaks.push(...findEventLeaks(next, events));
  leaks.push(...findReshuffleLeaks(prev, next));
  return leaks;
}
