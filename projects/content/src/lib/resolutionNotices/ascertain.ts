import type { ResolutionNoticeDefinition } from '../resolutionNotice';

// Ascertain: the user secretly looked at the target's hand or a hidden General. The log says only that a
// secret pick was made, so the notice shows who looked at whom and no card. A recast has no target and a
// cancelled one has no pick: neither gets a notice.
export const ascertainNotice: ResolutionNoticeDefinition = {
  describe: (span) => {
    const target = span.targetSeatIds[0];
    const looked = span.events.some((e) => e.kind === 'ChoiceMadeEvent' && e.secret && e.seatId === span.userSeatId);
    if (!target || !looked) return null;
    return {
      source: { kind: 'card', id: 'ascertain' },
      seatIds: [span.userSeatId, target],
      steps: [],
      cards: [],
      outcome: { tone: 'neutral', symbol: '👁', headline: { key: 'notice.ascertain.looked' }, text: { key: 'notice.ascertain.text', params: { userSeat: span.userSeatId, targetSeat: target } } },
    };
  },
};
