import type { EngineEvent } from 'engine';
import type { NoticeText, ResolutionNoticeDefinition, ResolutionSpan } from '../resolutionNotice';

type Drew = Extract<EngineEvent, { kind: 'CardsDrawnEvent' }>;

// The draws a resolution made, in order. None means it did not take effect (a Wuxie cancelled it).
const draws = (span: ResolutionSpan) => span.events.filter((e): e is Drew => e.kind === 'CardsDrawnEvent');

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
