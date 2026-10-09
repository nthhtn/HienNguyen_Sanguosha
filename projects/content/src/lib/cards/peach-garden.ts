import type { CardDefinition, GameState, Target } from 'engine';
import { livingSeatOrderFrom } from 'engine';
import { toolOnTargets } from '../shared/tools';

// Every living seat below its max HP, in turn order starting with the user.
function hurtSeatsFrom(state: GameState, userSeatId: string): Target[] {
  return livingSeatOrderFrom(state, userSeatId)
    .filter((id) => {
      const seat = state.seats.find((s) => s.id === id)!;
      return seat.combinedHp < seat.maxCombinedHp;
    })
    .map((id) => ({ kind: 'seat', seatId: id }));
}

// Peach Garden: each living seat below max HP when it is played recovers 1 HP.
export const peachGardenCard: CardDefinition = {
  id: 'peach-garden',
  name: 'Peach Garden',
  category: 'tool',
  legalPlayTargets: () => [[]],
  play: (state, ctx) => (ctx.respondingTo ? [] : toolOnTargets(ctx.card, ctx.seatId, hurtSeatsFrom(state, ctx.seatId))),
  onTarget: (_state, { target }) => [{ kind: 'HealEffect', target, amount: 1 }],
};
