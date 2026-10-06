import type { CardDefinition, Effect, Target, UsedCard } from 'engine';
import { usedCardKey } from 'engine';
import { attackRange, otherLivingSeatTargets, seatDistance, shaLimit } from '../shared/queries';
import { WINE_FLAG } from './wine';

// The window a Sha opens: `target` plays a Shan or takes 1 damage from
// `fromSeatId`. Shared with Coerce, whose Sha is played as an answer.
export function shaWindow(card: UsedCard, fromSeatId: string, target: Target, amount = 1): Effect {
  const first = card.physical[0]?.instanceId;
  return {
    kind: 'OpenResponseEffect',
    pendingResponse: {
      id: `sha-response-${usedCardKey(card)}`,
      respondingSeatId: target.seatId,
      allowedActionKinds: ['RespondAction', 'PassAction'],
      allowedCardIds: ['shan'],
      context: {
        effect: {
          kind: 'DamageEffect',
          damage: { source: { kind: 'seat', seatId: fromSeatId }, target, amount, nature: 'normal', cause: { ...(first ? { cardInstanceId: first } : {}), card } },
        },
      },
    },
  };
}

export const shaCard: CardDefinition = {
  id: 'sha',
  name: 'Sha',
  category: 'basic',
  legalPlayTargets: (state, ctx, registry) => {
    if ((state.turn.cardPlays?.['sha'] ?? 0) >= shaLimit(state, ctx.seatId, registry)) return [];
    const range = attackRange(state, ctx.seatId, registry);
    return otherLivingSeatTargets(state, ctx.seatId).filter(
      ([target]) => target.kind === 'seat' && seatDistance(state, ctx.seatId, target.seatId, registry) <= range
    );
  },
  play: (state, ctx) => {
    if (ctx.respondingTo) return []; // played as an answer (a Duel, Barbarians, Coerce) — the window decides what it does
    if (ctx.targets.length === 0) return []; // no target chosen — a no-op rather than a crash
    // Wine's boost is spent the moment the Sha is played, dodged or not.
    const boosted = !!state.turn.flags?.[WINE_FLAG];
    const spend: Effect[] = boosted ? [{ kind: 'SetTurnFlagEffect', flag: WINE_FLAG, value: false }] : [];
    return [...spend, shaWindow(ctx.card, ctx.seatId, ctx.targets[0], boosted ? 2 : 1)];
  },
};
