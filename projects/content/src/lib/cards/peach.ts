import type { CardDefinition } from 'engine';

export const peachCard: CardDefinition = {
  id: 'peach',
  name: 'Peach',
  category: 'basic',
  legalPlayTargets: (state, ctx) => {
    const seat = state.seats.find((s) => s.id === ctx.seatId);
    return seat && seat.combinedHp < seat.maxCombinedHp ? [[]] : [];
  },
  // In the Play phase it heals its user. As a rescue in the dying round it does
  // nothing itself: the round's window heals the dying seat, whoever that is.
  play: (_state, ctx) => (ctx.respondingTo ? [] : [{ kind: 'HealEffect', target: { kind: 'seat', seatId: ctx.seatId }, amount: 1 }]),
};
