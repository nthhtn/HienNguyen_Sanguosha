import type { CardInstance, EngineEvent } from 'engine';
import type { NoticeCard, NoticeText, ResolutionNoticeDefinition } from '../resolutionNotice';

// Blaze: the target shows a card; the user may discard a card of the same suit to deal 1 fire damage.
// Nothing shown means Wuxie stopped it before it began: no notice.
export const blazeNotice: ResolutionNoticeDefinition = {
  describe: (span, view) => {
    const shownAt = span.events.findIndex((e) => e.kind === 'CardShownEvent' && e.abilityId === 'blaze');
    if (shownAt < 0) return null;
    const shown = span.events[shownAt] as Extract<EngineEvent, { kind: 'CardShownEvent' }>;
    const target = span.targetSeatIds[0];
    const after = span.events.slice(shownAt + 1);
    const discardPileId = view.zones.find((z) => z.kind === 'discardPile')?.id ?? 'discardPile';
    const discard = after.find((e): e is Extract<EngineEvent, { kind: 'CardMovedEvent' }> => e.kind === 'CardMovedEvent' && e.toZoneId === discardPileId && e.card !== undefined);
    const damage = after.find((e): e is Extract<EngineEvent, { kind: 'DamageDealtEvent' }> => e.kind === 'DamageDealtEvent' && e.damage.target.seatId === target);
    const steps: NoticeText[] = [
      { key: 'notice.blaze.shown', params: { targetSeat: target } },
      discard ? { key: 'notice.blaze.discarded', params: { userSeat: span.userSeatId } } : { key: 'notice.blaze.noDiscard', params: { userSeat: span.userSeatId } },
    ];
    const cards: NoticeCard[] = [{ card: shown.card as CardInstance }, ...(discard?.card ? [{ card: discard.card }] : [])];
    return {
      source: { kind: 'card', id: 'blaze' },
      seatIds: [span.userSeatId, target],
      steps,
      cards,
      outcome: damage
        ? { tone: 'good', symbol: '🔥', headline: { key: 'notice.blaze.hit', params: { card: 'blaze' } }, text: { key: 'notice.blaze.hitText', params: { targetSeat: target, amount: damage.damage.amount } }, hp: { seatId: target } }
        : { tone: 'bad', symbol: '✕', headline: { key: 'notice.blaze.missed', params: { card: 'blaze' } }, text: { key: 'notice.blaze.missedText' } },
    };
  },
};
