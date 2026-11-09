import type { CardInstance, EngineEvent, GameState } from 'engine';
import type { ResolutionNoticeDefinition, ResolutionSpan } from '../resolutionNotice';

type Moved = Extract<EngineEvent, { kind: 'CardMovedEvent' }>;
type Chose = Extract<EngineEvent, { kind: 'ChoiceMadeEvent' }>;
type Played = Extract<EngineEvent, { kind: 'CardPlayedEvent' }>;

// A card the viewer's own view shows face up, wherever it now lies. A card that went into someone's hand
// has no face in the log; only a seat that can see it has it in its view, and everyone else gets a back.
export function faceInView(view: GameState, instanceId: string): CardInstance | null {
  for (const zone of view.zones) {
    const found = zone.cards.find((c) => c.instanceId === instanceId);
    if (found) return found.definitionId === 'hidden' ? null : found;
  }
  return null;
}

const moves = (span: ResolutionSpan) => span.events.filter((e): e is Moved => e.kind === 'CardMovedEvent');
const discardPileId = (view: GameState) => view.zones.find((z) => z.kind === 'discardPile')?.id ?? 'discardPile';

// Steal: the user picked a card of the target and took it into their hand.
export const stealNotice: ResolutionNoticeDefinition = {
  describe: (span, view) => {
    const choice = span.events.find((e): e is Chose => e.kind === 'ChoiceMadeEvent' && e.seatId === span.userSeatId);
    const taken = moves(span).find((m) => m.toZoneId === view.seats.find((s) => s.id === span.userSeatId)?.hand.zoneId);
    if (!choice || !taken) return null;
    const target = span.targetSeatIds[0];
    const worn = choice.shows.kind === 'card' ? choice.shows.card : null;
    const params = { userSeat: span.userSeatId, targetSeat: target };
    return {
      source: { kind: 'card', id: 'steal' },
      seatIds: [span.userSeatId, target],
      steps: [],
      cards: [{ card: worn ?? faceInView(view, taken.cardInstanceId) }],
      outcome: worn
        ? { tone: 'good', symbol: '✋', headline: { key: 'notice.steal.equipment' }, text: { key: 'notice.steal.equipmentText', params: { ...params, card: worn.definitionId } } }
        : { tone: 'good', symbol: '✋', headline: { key: 'notice.steal.hand' }, text: { key: 'notice.steal.handText', params } },
    };
  },
};

// Break: the user picked a card of the target and it was discarded face up.
export const breakNotice: ResolutionNoticeDefinition = {
  describe: (span, view) => {
    const choice = span.events.some((e) => e.kind === 'ChoiceMadeEvent' && e.seatId === span.userSeatId);
    // The Break itself also lands in the discard pile; the card that was picked is the one that is not it.
    const played = span.events.find((e): e is Played => e.kind === 'CardPlayedEvent');
    const own = new Set(played?.card.physical.map((c) => c.instanceId));
    const discarded = moves(span).find((m) => m.toZoneId === discardPileId(view) && m.card && !own.has(m.cardInstanceId));
    if (!choice || !discarded?.card) return null;
    const target = span.targetSeatIds[0];
    return {
      source: { kind: 'card', id: 'break' },
      seatIds: [span.userSeatId, target],
      steps: [],
      cards: [{ card: discarded.card }],
      outcome: { tone: 'good', symbol: '✂', headline: { key: 'notice.break.discarded' }, text: { key: 'notice.break.discardedText', params: { targetSeat: target, card: discarded.card.definitionId } } },
    };
  },
};

// Coerce: the holder must use Sha on the victim; without one, the holder's weapon goes to the user.
export const coerceNotice: ResolutionNoticeDefinition = {
  describe: (span, view) => {
    const [holder, victim] = span.targetSeatIds;
    const holderEquip = view.seats.find((s) => s.id === holder)?.equipped.zoneId;
    const userHand = view.seats.find((s) => s.id === span.userSeatId)?.hand.zoneId;
    const taken = moves(span).find((m) => m.fromZoneId === holderEquip && m.toZoneId === userHand);
    if (!taken || !victim) return null;
    const weapon = faceInView(view, taken.cardInstanceId);
    return {
      source: { kind: 'card', id: 'coerce' },
      seatIds: [span.userSeatId, holder, victim],
      steps: [
        { key: 'notice.coerce.mustSha', params: { holderSeat: holder, victimSeat: victim, shaCard: 'sha' } },
        { key: 'notice.coerce.noSha', params: { holderSeat: holder, shaCard: 'sha' } },
      ],
      cards: weapon ? [{ card: weapon }] : [],
      outcome: { tone: 'good', symbol: '✋', headline: { key: 'notice.coerce.taken' }, text: { key: 'notice.coerce.takenText', params: { userSeat: span.userSeatId, holderSeat: holder } } },
    };
  },
};
