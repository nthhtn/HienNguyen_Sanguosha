import type { CardDefinition } from 'engine';
import { toolOnTargets } from '../shared/tools';

// Draw Two: no target (the user). The user draws 2 cards.
export const drawTwoCard: CardDefinition = {
  id: 'draw-two',
  name: 'Draw Two',
  category: 'tool',
  legalPlayTargets: () => [[]],
  play: (state, ctx) => (ctx.respondingTo ? [] : toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, [{ kind: 'seat', seatId: ctx.seatId }])),
  onTarget: (_state, { userSeatId }) => [{ kind: 'DrawCardsEffect', seatId: userSeatId, count: 2 }],
};
