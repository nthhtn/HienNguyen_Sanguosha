import type { CardInstance, EngineEvent } from 'engine';
import type { ResolutionNoticeDefinition } from '../resolutionNotice';

type Chose = Extract<EngineEvent, { kind: 'ChoiceMadeEvent' }>;

// Harvest: every living seat took one of the turned-up cards, in turn order from the user. The cards were
// face up on the table, so every seat sees what each one took.
export const harvestNotice: ResolutionNoticeDefinition = {
  describe: (span) => {
    const picks = span.events.filter((e): e is Chose & { shows: { kind: 'card'; card: CardInstance } } => e.kind === 'ChoiceMadeEvent' && e.shows.kind === 'card');
    if (picks.length === 0) return null;
    return {
      source: { kind: 'card', id: 'harvest' },
      seatIds: picks.map((p) => p.seatId),
      steps: picks.map((p) => ({ key: 'notice.harvest.took', params: { seat: p.seatId, card: p.shows.card.definitionId } })),
      cards: picks.map((p) => ({ card: p.shows.card })),
      outcome: { tone: 'neutral', symbol: '🌾', headline: { key: 'notice.harvest.done', params: { card: 'harvest' } }, text: { key: 'notice.harvest.text' } },
    };
  },
};
