import type { ResolutionNoticeDefinition } from '../resolutionNotice';

// Wine, played proactively: the next Sha this turn deals 1 extra damage. (Wine played to rescue a dying
// seat is an answer, which opens no span.)
export const wineNotice: ResolutionNoticeDefinition = {
  describe: (span) => ({
    source: { kind: 'card', id: 'wine' },
    seatIds: [span.userSeatId],
    steps: [],
    cards: [],
    outcome: { tone: 'good', symbol: '🍶', headline: { key: 'notice.wine.drunk', params: { card: 'wine' } }, text: { key: 'notice.wine.text', params: { shaCard: 'sha' } } },
  }),
};
