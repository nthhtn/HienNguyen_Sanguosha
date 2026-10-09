import type { CardDefinition, Effect, Target } from 'engine';
import { attackRange, seatDistance } from '../shared/queries';
import { playColour, toolOnTargets } from '../shared/tools';
import { untargetableBy } from '../shared/abilities';
import { equipSlotOf } from './equipment';
import { shaAt } from './sha';

const seat = (seatId: string): Target => ({ kind: 'seat', seatId });

// Coerce: another living seat wearing a weapon (the holder) and a victim, a
// living seat other than the holder within the holder's attack range. Once
// Coerce takes effect the holder must play a Sha at the victim, answered like
// any Sha; without one, the holder's weapon goes to the user's hand. That Sha
// is an answer, so it doesn't count toward the holder's Sha limit.
export const coerceCard: CardDefinition = {
  id: 'coerce',
  name: 'Coerce',
  category: 'tool',
  legalPlayTargets: (state, ctx, registry) => {
    const living = state.seats.filter((s) => !s.eliminated).sort((a, b) => a.index - b.index);
    const wearsWeapon = (holderId: string) => {
      const holder = state.seats.find((s) => s.id === holderId)!;
      const worn = state.zones.find((z) => z.id === holder.equipped.zoneId)?.cards ?? [];
      return worn.some((c) => registry.cards.get(c.definitionId)?.equipSlot === 'weapon');
    };
    return living
      .filter((holder) => holder.id !== ctx.seatId && wearsWeapon(holder.id) && !untargetableBy(state, holder.id, 'coerce', registry, playColour(state, ctx, registry)))
      .flatMap((holder) => {
        const range = attackRange(state, holder.id, registry);
        return living
          .filter((victim) => victim.id !== holder.id && seatDistance(state, holder.id, victim.id, registry) <= range && !untargetableBy(state, victim.id, 'sha', registry))
          .map((victim) => [seat(holder.id), seat(victim.id)]);
      });
  },
  play: (state, ctx) => {
    if (ctx.respondingTo || ctx.targets.length < 2) return [];
    return toolOnTargets(ctx.card, ctx.seatId, [ctx.targets[0]], [ctx.targets[1]]);
  },
  onTarget: (state, { tool, userSeatId, target, extra }) => {
    const coerceId = tool.physical[0]?.instanceId;
    const victim = extra?.[0];
    const holder = state.seats.find((s) => target.kind === 'seat' && s.id === target.seatId);
    const user = state.seats.find((s) => s.id === userSeatId);
    if (!coerceId || !victim || !holder || !user) return [];
    const weapon = state.zones.find((z) => z.id === holder.equipped.zoneId)?.cards.find((c) => equipSlotOf(c.definitionId) === 'weapon');
    if (!weapon) return [];
    const window: Effect = {
      kind: 'OpenResponseEffect',
      pendingResponse: {
        id: `coerce-${coerceId}-${holder.id}`,
        respondingSeatId: holder.id,
        allowedActionKinds: ['RespondAction', 'PassAction'],
        allowedCardIds: ['sha'],
        reason: { kind: 'card-effect', card: tool, userSeatId, victimSeatId: victim.seatId },
        sourceCard: { instanceId: coerceId, definitionId: 'coerce' },
        // No Sha: the weapon goes to the user's hand.
        context: { effect: { kind: 'MoveCardEffect', cardInstanceId: weapon.instanceId, toZoneId: user.hand.zoneId } },
      },
    };
    return [window];
  },
  // The holder's Sha: a Sha at the victim, from step 1, answered like any Sha.
  onResponse: (state, { pending, seatId, card }) => {
    const victimSeatId = pending.reason?.kind === 'card-effect' ? pending.reason.victimSeatId : undefined;
    const victim = state.seats.find((s) => s.id === victimSeatId && !s.eliminated);
    return victim ? shaAt(state, card, seatId, [seat(victim.id)]) : [];
  },
};
