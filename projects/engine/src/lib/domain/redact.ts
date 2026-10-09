import { CardInstance, CardZone, GameState, GeneralOwner, GeneralSelectionState, PendingChoice, PendingSelection, Seat, SeatGenerals } from './types';

const HIDDEN_GENERAL_ID = 'hidden';
const HIDDEN_CARD_DEFINITION_ID = 'hidden';

function maskCard(card: CardInstance): CardInstance {
  return { ...card, definitionId: HIDDEN_CARD_DEFINITION_ID, suit: 'spade', rank: 0 };
}

// Zones whose cards lie face-up for every seat to see.
export function isFaceUpZoneKind(kind: CardZone['kind']): boolean {
  return kind !== 'hand' && kind !== 'drawPile';
}

function redactZone(zone: CardZone, viewerSeatId: string, shown: ReadonlySet<string>): CardZone {
  const isViewersOwnHand = zone.kind === 'hand' && zone.ownerSeatId === viewerSeatId;
  const shouldMask = !isFaceUpZoneKind(zone.kind) && !isViewersOwnHand;
  if (!shouldMask) return zone;
  return { ...zone, cards: zone.cards.map((c) => (shown.has(c.instanceId) ? c : maskCard(c))) };
}

// Cards the viewer sees though their zone is hidden: those it is arranging.
function shownToViewer(state: GameState, viewerSeatId: string): ReadonlySet<string> {
  return new Set(state.pendingArrangement?.seatId === viewerSeatId ? state.pendingArrangement.cardInstanceIds : []);
}

// The instance ids `viewerSeatId` can't see where they lie: other seats'
// hands and the draw pile.
function hiddenInstanceIds(state: GameState, viewerSeatId: string, shown: ReadonlySet<string>): ReadonlySet<string> {
  return new Set(
    state.zones
      .filter((z) => !isFaceUpZoneKind(z.kind) && !(z.kind === 'hand' && z.ownerSeatId === viewerSeatId))
      .flatMap((z) => z.cards.map((c) => c.instanceId))
      .filter((id) => !shown.has(id))
  );
}

function isCardInstance(value: object): value is CardInstance {
  const v = value as Partial<CardInstance>;
  return typeof v.instanceId === 'string' && typeof v.definitionId === 'string' && typeof v.suit === 'string' && typeof v.rank === 'number';
}

// Masks every hidden card instance anywhere inside `value` (queued effects, a
// pending response or choice), the same way its zone masks it.
function maskHiddenCards<T>(value: T, hidden: ReadonlySet<string>): T {
  if (Array.isArray(value)) return value.map((v) => maskHiddenCards(v, hidden)) as T;
  if (value === null || typeof value !== 'object') return value;
  if (isCardInstance(value)) return (hidden.has(value.instanceId) ? maskCard(value) : value) as T;
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskHiddenCards(v, hidden)])) as T;
}

// The skill ids of another seat's hidden Generals that `value` mentions (a
// GeneralOwner whose slot is still hidden): the viewer mustn't learn them.
function hiddenSkillIds(value: unknown, state: GameState, viewerSeatId: string, found = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => hiddenSkillIds(v, state, viewerSeatId, found));
  else if (value !== null && typeof value === 'object') {
    const v = value as Partial<GeneralOwner>;
    if (v.kind === 'general' && typeof v.seatId === 'string' && (v.slot === 'main' || v.slot === 'deputy') && typeof v.skillId === 'string' && v.seatId !== viewerSeatId) {
      const general = state.seats.find((s) => s.id === v.seatId)?.generals?.[v.slot];
      if (general && !general.revealed) found.add(v.skillId);
    }
    Object.values(value).forEach((x) => hiddenSkillIds(x, state, viewerSeatId, found));
  }
  return found;
}

const SKILL_ID_KEYS = new Set(['skillId', 'abilityId', 'forAbilityId', 'conversionId']);

// `value` with every mention of `skills` (as a skill, ability or conversion id) replaced by 'hidden'.
function maskSkills<T>(value: T, skills: ReadonlySet<string>): T {
  if (skills.size === 0) return value;
  if (Array.isArray(value)) return value.map((v) => maskSkills(v, skills)) as T;
  if (value === null || typeof value !== 'object') return value;
  // A conversion of a hidden owner (UsedCard.via) names it by its own id.
  const owner = (value as { owner?: Partial<GeneralOwner> }).owner;
  const hiddenOwner = owner?.kind === 'general' && typeof owner.skillId === 'string' && skills.has(owner.skillId);
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [
      k,
      typeof v === 'string' && ((SKILL_ID_KEYS.has(k) && skills.has(v)) || (hiddenOwner && k === 'conversionId')) ? HIDDEN_GENERAL_ID : maskSkills(v, skills),
    ])
  ) as T;
}

// A pending selection as the viewer may see it: hidden cards masked, and no
// eligible id of a card it can't see (which cards a skill accepts would tell).
function redactPendingSelection(selection: PendingSelection, hidden: ReadonlySet<string>): PendingSelection {
  const masked = maskHiddenCards(selection, hidden);
  return { ...masked, eligibleIds: masked.eligibleIds.filter((id) => !hidden.has(id)) };
}

function isKingdomRevealed(generals: SeatGenerals): boolean {
  return generals.main.revealed || generals.deputy.revealed;
}

function redactSeat(seat: Seat, viewerSeatId: string): Seat {
  // A seat with no generals yet has nothing to mask (its kingdom is 'hidden').
  if (seat.id === viewerSeatId || !seat.generals) return seat;
  const { main, deputy } = seat.generals;
  // Spare Generals: none shown while their holder is hidden, and never which.
  const { forms, ...rest } = seat;
  const holderShown = !!forms && seat.generals[forms.slot].revealed;
  return {
    ...rest,
    ...(forms && holderShown ? { forms: { ...forms, held: forms.held.map(() => HIDDEN_GENERAL_ID) } } : {}),
    kingdom: isKingdomRevealed(seat.generals) ? seat.kingdom : 'hidden',
    generals: {
      main: main.revealed ? main : { ...main, generalDefinitionId: HIDDEN_GENERAL_ID },
      deputy: deputy.revealed ? deputy : { ...deputy, generalDefinitionId: HIDDEN_GENERAL_ID },
    },
  };
}

function redactSelection(selection: GeneralSelectionState | null, viewerSeatId: string): GeneralSelectionState | null {
  if (!selection) return null;
  const candidates = Object.fromEntries(
    Object.entries(selection.candidates).map(([seatId, ids]) => [
      seatId,
      seatId === viewerSeatId ? ids : ids.map(() => HIDDEN_GENERAL_ID),
    ])
  );
  return { candidates };
}

export function redactStateForSeat(state: GameState, viewerSeatId: string): GameState {
  const shown = shownToViewer(state, viewerSeatId);
  const hidden = hiddenInstanceIds(state, viewerSeatId, shown);
  // Another seat's hidden General's skills, named in what it is deciding or what is queued.
  const skills = hiddenSkillIds([state.pendingResponse, state.pendingChoice, state.pendingSelection, state.pendingArrangement, state.resolutionQueue], state, viewerSeatId);
  const hideSecret = (choice: PendingChoice): PendingChoice => (choice.secret && choice.seatId !== viewerSeatId ? { ...choice, options: [] } : choice);
  return {
    ...state,
    ...(state.spareGenerals ? { spareGenerals: [] } : {}),
    seats: state.seats.map((seat) => redactSeat(seat, viewerSeatId)),
    zones: state.zones.map((zone) => redactZone(zone, viewerSeatId, shown)),
    generalSelection: redactSelection(state.generalSelection, viewerSeatId),
    pendingResponse: maskSkills(maskHiddenCards(state.pendingResponse, hidden), skills),
    ...(state.pendingChoice ? { pendingChoice: maskSkills(maskHiddenCards(hideSecret(state.pendingChoice), hidden), skills) } : {}),
    ...(state.pendingSelection ? { pendingSelection: maskSkills(redactPendingSelection(state.pendingSelection, hidden), skills) } : {}),
    ...(state.pendingArrangement ? { pendingArrangement: maskSkills(state.pendingArrangement, skills) } : {}),
    ...(state.resolutionQueue ? { resolutionQueue: maskSkills(maskHiddenCards(state.resolutionQueue, hidden), skills) } : {}),
  };
}
