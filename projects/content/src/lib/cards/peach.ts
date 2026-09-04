import type { CardDefinition } from 'engine';

export const peachCard: CardDefinition = {
  id: 'peach',
  name: 'Peach',
  category: 'basic',
  play: (_state, ctx) => [{ kind: 'HealEffect', target: { kind: 'seat', seatId: ctx.seatId }, amount: 1 }],
};
