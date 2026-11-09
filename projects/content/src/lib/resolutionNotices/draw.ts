import type { EngineEvent } from 'engine';
import type { NoticeText, ResolutionNoticeDefinition, ResolutionSpan } from '../resolutionNotice';

type Drew = Extract<EngineEvent, { kind: 'CardsDrawnEvent' }>;

// The draws a resolution made, in order. None means it did not take effect (a Wuxie cancelled it).
const draws = (span: ResolutionSpan) => span.events.filter((e): e is Drew => e.kind === 'CardsDrawnEvent');
const drawn = (list: Drew[], seatId: string) => list.filter((d) => d.seatId === seatId).reduce((n, d) => n + d.cardInstanceIds.length, 0);

// Draw Two: the user drew 2 cards.
export const drawTwoNotice: ResolutionNoticeDefinition = {
  describe: (span) =>
    draws(span).length === 0
      ? null
      : {
          source: { kind: 'card', id: 'draw-two' },
          seatIds: [span.userSeatId],
          steps: [],
          cards: [],
          outcome: { tone: 'good', symbol: '+', headline: { key: 'notice.draw.drawn' }, text: { key: 'notice.drawTwo.text', params: { userSeat: span.userSeatId } } },
        },
};

// Amass: each seat of the group drew 2 and discarded 2.
export const amassNotice: ResolutionNoticeDefinition = {
  describe: (span) => {
    const seats = [...new Set(draws(span).map((d) => d.seatId))];
    if (seats.length === 0) return null;
    const text: NoticeText = seats.length === 1 ? { key: 'notice.amass.one', params: { userSeat: seats[0] } } : { key: 'notice.amass.many', params: { count: seats.length } };
    return {
      source: { kind: 'card', id: 'amass' },
      seatIds: seats,
      steps: [],
      cards: [],
      outcome: {
        tone: 'good',
        symbol: '+',
        headline: { key: 'notice.draw.drawn' },
        text,
      },
    };
  },
};

// Ally Far Attack Near: the target drew 1 and the user drew 3.
export const allyFarAttackNearNotice: ResolutionNoticeDefinition = {
  describe: (span) => {
    const list = draws(span);
    const target = span.targetSeatIds[0];
    if (list.length === 0 || !target) return null;
    return {
      source: { kind: 'card', id: 'ally-far-attack-near' },
      seatIds: [span.userSeatId, target],
      steps: [],
      cards: [],
      outcome: {
        tone: 'good',
        symbol: '+',
        headline: { key: 'notice.draw.drawn' },
        text: { key: 'notice.allyFarAttackNear.text', params: { userSeat: span.userSeatId, targetSeat: target, targetCount: drawn(list, target), userCount: drawn(list, span.userSeatId) } },
      },
    };
  },
};
