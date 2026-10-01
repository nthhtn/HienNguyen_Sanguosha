import type { CardDefinition } from 'engine';

export const peachCard: CardDefinition = {
  id: 'peach',
  name: 'Peach',
  category: 'basic',
  legalPlayTargets: (state, ctx) => {
    const seat = state.seats.find((s) => s.id === ctx.seatId);
    return seat && seat.combinedHp < seat.maxCombinedHp ? [[]] : [];
  },
  play: (_state, ctx) => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: ctx.seatId }, amount: 1 }],
};
