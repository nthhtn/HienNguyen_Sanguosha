import type { CardInstance, EngineEvent, GameState } from 'engine';
import type { NoticeText, ResolutionNoticeDefinition, ResolutionSpan } from '../resolutionNotice';

type Moved = Extract<EngineEvent, { kind: 'CardMovedEvent' }>;

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

// Coerce: the holder must use Sha on the victim; without one, the holder's weapon goes to the user.
export const coerceNotice: ResolutionNoticeDefinition = {
  describe: (span, view) => {
    const [holder, victim] = span.targetSeatIds;
    const holderEquip = view.seats.find((s) => s.id === holder)?.equipped.zoneId;
    const userHand = view.seats.find((s) => s.id === span.userSeatId)?.hand.zoneId;
    const taken = moves(span).find((m) => m.fromZoneId === holderEquip && m.toZoneId === userHand);
    if (!taken || !victim) return null;
    const weapon = faceInView(view, taken.cardInstanceId);
    const steps: NoticeText[] = [
      { key: 'notice.coerce.mustSha', params: { holderSeat: holder, victimSeat: victim, shaCard: 'sha' } },
      { key: 'notice.coerce.noSha', params: { holderSeat: holder, shaCard: 'sha' } },
    ];
    return {
      source: { kind: 'card', id: 'coerce' },
      seatIds: [span.userSeatId, holder, victim],
      steps,
      cards: weapon ? [{ card: weapon }] : [],
      outcome: { tone: 'good', symbol: '✋', headline: { key: 'notice.coerce.taken' }, text: { key: 'notice.coerce.takenText', params: { userSeat: span.userSeatId, holderSeat: holder } } },
    };
  },
};
