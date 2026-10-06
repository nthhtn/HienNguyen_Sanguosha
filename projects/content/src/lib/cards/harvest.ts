import type { CardDefinition, PendingChoice } from 'engine';
import { livingSeatOrderFrom, requireZoneOfKind } from 'engine';
import { toolOnTargets } from '../shared/tools';

// Harvest: one card per living seat is turned face up. Then each living seat,
// starting with the user, takes one of them; each pick has its own Wuxie
// check. Whatever is left goes to the discard pile.
export const harvestCard: CardDefinition = {
  id: 'harvest',
  name: 'Harvest',
  category: 'tool',
  legalPlayTargets: () => [[]],
  play: (state, ctx) => {
    if (ctx.respondingTo) return [];
    const order = livingSeatOrderFrom(state, ctx.seatId);
    const processing = requireZoneOfKind(state.zones, 'processing');
    return [
      { kind: 'RevealToProcessingEffect', count: order.length },
      ...toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, order.map((seatId) => ({ kind: 'seat' as const, seatId }))),
      { kind: 'DiscardZoneEffect', zoneId: processing.id },
    ];
  },
  onTarget: (state, { tool, userSeatId, target }) => {
    const seat = state.seats.find((s) => target.kind === 'seat' && s.id === target.seatId);
    const cards = requireZoneOfKind(state.zones, 'processing').cards;
    if (!seat || cards.length === 0) return []; // nothing left to take
    const choice: PendingChoice = {
      id: `harvest-${tool.physical[0]?.instanceId ?? 'virtual'}-${seat.id}-${state.log.length}`,
      seatId: seat.id,
      reason: { kind: 'choice', card: tool, userSeatId },
      verb: 'take',
      options: cards.map((card) => ({
        id: card.instanceId,
        shows: { kind: 'card', card },
        effects: [{ kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId: seat.hand.zoneId }],
      })),
    };
    return [{ kind: 'OpenChoiceEffect', choice }];
  },
};
