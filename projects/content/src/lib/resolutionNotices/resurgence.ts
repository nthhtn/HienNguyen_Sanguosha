import type { EngineEvent } from 'engine';
import type { NoticeText, ResolutionNoticeDefinition } from '../resolutionNotice';

// Meng Huo's Resurgence: in his Draw Phase, instead of drawing, he turned up as many cards as he misses HP;
// each heart recovered 1 HP, and the rest went to his hand. The cards were turned up just before the skill
// announced itself, so they are read from the log ahead of the span.
export const resurgenceNotice: ResolutionNoticeDefinition = {
  describe: (span, view) => {
    const turnedUp = [...view.log.slice(0, span.startIndex + 1)].reverse().find((e): e is Extract<EngineEvent, { kind: 'CardsTurnedUpEvent' }> => e.kind === 'CardsTurnedUpEvent');
    if (!turnedUp) return null;
    const owner = span.userSeatId;
    const amount = span.events.reduce((n, e) => (e.kind === 'HealEvent' && e.target.seatId === owner ? n + e.amount : n), 0);
    const rest = turnedUp.cards.filter((c) => c.suit !== 'heart').length;
    const plural = rest === 1 ? 'one' : 'other';
    const text: NoticeText =
      amount > 0
        ? rest === 0
          ? { key: 'notice.resurgence.recoveredAll', params: { userSeat: owner, amount } }
          : { key: `notice.resurgence.recovered.${plural}`, params: { userSeat: owner, amount, rest } }
        : { key: `notice.resurgence.noHeart.${plural}`, params: { userSeat: owner, rest } };
    return {
      source: { kind: 'skill', id: 'resurgence', seatId: owner },
      seatIds: [owner],
      steps: [],
      cards: turnedUp.cards.map((card) => ({ card })),
      outcome: {
        tone: amount > 0 ? 'good' : 'neutral',
        symbol: '♥',
        headline: { key: 'notice.skill.headline', params: { skill: 'resurgence' } },
        text,
        ...(amount > 0 ? { hp: { seatId: owner } } : {}),
      },
    };
  },
};
