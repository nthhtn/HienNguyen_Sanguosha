import type { CardInstance, EngineEvent } from 'engine';
import type { ResolutionNoticeDefinition } from '../resolutionNotice';

type Chose = Extract<EngineEvent, { kind: 'ChoiceMadeEvent' }>;

// How long the Harvest notice stays: 1.5 seconds per participant, at least 3 and at most 7.
export const harvestSeconds = (participants: number): number => Math.min(7, Math.max(3, participants * 1.5));

// Harvest: every living seat took one of the turned-up cards, in turn order from the user. The cards were
// face up on the table, so every seat sees what each one took.
export const harvestNotice: ResolutionNoticeDefinition = {
  describe: (span) => {
    const picks = span.events.filter((e): e is Chose & { shows: { kind: 'card'; card: CardInstance } } => e.kind === 'ChoiceMadeEvent' && e.shows.kind === 'card');
    if (picks.length === 0) return null;
    return {
      source: { kind: 'card', id: 'harvest' },
      seatIds: picks.map((p) => p.seatId),
      // A card and a name per seat is more to read than most notices.
      seconds: harvestSeconds(picks.length),
      steps: [],
      cards: [],
      seatCards: picks.map((p) => ({ seatId: p.seatId, card: p.shows.card })),
      outcome: { tone: 'neutral', symbol: '🌾', headline: { key: 'notice.harvest.done', params: { card: 'harvest' } }, text: { key: 'notice.harvest.text' } },
    };
  },
};
