import type { CardDefinition, ChoiceOption, GameState, PendingChoice } from 'engine';
import { requireZoneOfKind } from 'engine';
import { otherLivingSeatTargets, seatDistance } from './queries';
import { toolOnTargets } from './tools';
import { toolsIgnoreDistance, untargetableBy } from './abilities';

const PICKABLE_ZONE_KINDS = ['hand', 'equip', 'judgment'];

// Whether `seatId` holds a card Steal or Break could pick: in hand, worn, or
// in its judgment area.
export function holdsAnyCard(state: GameState, seatId: string): boolean {
  return state.zones.some((z) => z.ownerSeatId === seatId && PICKABLE_ZONE_KINDS.includes(z.kind) && z.cards.length > 0);
}

// One option per thing of `ownerSeatId`'s that may be picked: the hand as a
// single face-down option (its card is picked at random), then each worn and
// judgment card face up. Each option moves its card to `toZoneId`.
// `judgment: false` leaves the Judgment slot out (Feedback).
export function seatCardOptions(state: GameState, ownerSeatId: string, toZoneId: string, { judgment = true }: { judgment?: boolean } = {}): ChoiceOption[] {
  const owned = (kind: string) => state.zones.filter((z) => z.ownerSeatId === ownerSeatId && z.kind === kind);
  const options: ChoiceOption[] = [];
  for (const hand of owned('hand')) {
    if (hand.cards.length === 0) continue;
    options.push({
      id: 'hand',
      shows: { kind: 'hidden-hand', seatId: ownerSeatId, count: hand.cards.length },
      effects: [{ kind: 'MoveRandomCardEffect', fromZoneId: hand.id, toZoneId }],
    });
  }
  for (const zone of [...owned('equip'), ...(judgment ? owned('judgment') : [])]) {
    for (const card of zone.cards) {
      options.push({ id: card.instanceId, shows: { kind: 'card', card }, effects: [{ kind: 'MoveCardEffect', cardInstanceId: card.instanceId, toZoneId }] });
    }
  }
  return options;
}

interface PickACardToolSpec {
  id: string;
  name: string;
  verb: 'take' | 'discard';
  // Steal's reach (horses counted); absent = any distance.
  maxDistance?: number;
}

// Steal and Break: target another living seat holding a card (within
// `maxDistance` when set). Once the Tool takes effect, the user picks one of
// its cards: taken into the user's hand, or discarded.
export function pickACardTool({ id, name, verb, maxDistance }: PickACardToolSpec): CardDefinition {
  return {
    id,
    name,
    category: 'tool',
    legalPlayTargets: (state, ctx, registry) =>
      otherLivingSeatTargets(state, ctx.seatId).filter(
        ([target]) =>
          target.kind === 'seat' &&
          holdsAnyCard(state, target.seatId) &&
          !untargetableBy(state, target.seatId, id, registry) &&
          (maxDistance === undefined || toolsIgnoreDistance(state, ctx.seatId, registry) || seatDistance(state, ctx.seatId, target.seatId, registry) <= maxDistance)
      ),
    play: (state, ctx) => (ctx.respondingTo || ctx.targets.length === 0 ? [] : toolOnTargets(ctx.card, ctx.seatId, [ctx.targets[0]])),
    onTarget: (state, { tool, userSeatId, target }) => {
      const user = state.seats.find((s) => s.id === userSeatId);
      if (target.kind !== 'seat' || !user) return [];
      const toZoneId = verb === 'take' ? user.hand.zoneId : requireZoneOfKind(state.zones, 'discardPile').id;
      const options = seatCardOptions(state, target.seatId, toZoneId);
      if (options.length === 0) return []; // nothing left to pick
      const choice: PendingChoice = {
        id: `${id}-${tool.physical[0]?.instanceId ?? 'virtual'}-${target.seatId}-${state.log.length}`,
        seatId: userSeatId,
        reason: { kind: 'choice', card: tool, userSeatId, targetSeatId: target.seatId },
        verb,
        options,
      };
      return [{ kind: 'OpenChoiceEffect', choice }];
    },
  };
}
