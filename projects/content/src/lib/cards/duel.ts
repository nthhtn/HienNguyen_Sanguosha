import type { CardDefinition, Effect, UsedCard } from 'engine';
import { usedCardKey } from 'engine';
import { otherLivingSeatTargets } from '../shared/queries';
import { toolOnTargets } from '../shared/tools';
import { answersNeededAgainst, untargetableBy } from '../shared/abilities';

const DUEL_DAMAGE = 1;

interface DuelData {
  // Sha this responder owes this time (2 against Matchless), and has played so far.
  needed: number;
  provided: number;
}

// One step of a Duel: `responderSeatId` must play a Sha or take the damage,
// dealt by `otherSeatId`. `answeredWith` names the Sha that led here. Works
// for a Duel with no physical card (Sow Discord's).
function duelWindow(tool: UsedCard, responderSeatId: string, otherSeatId: string, data: DuelData, answeredWith?: string): Effect {
  const key = usedCardKey(tool);
  const first = tool.physical[0]?.instanceId;
  return {
    kind: 'OpenResponseEffect',
    pendingResponse: {
      // Each step gets its own id: the opening one, then one per Sha answered.
      id: answeredWith ? `duel-response-${key}-${answeredWith}` : `duel-response-${key}`,
      respondingSeatId: responderSeatId,
      allowedActionKinds: ['RespondAction', 'PassAction'],
      allowedCardIds: ['sha'],
      sourceCard: { instanceId: key, definitionId: 'duel' },
      data: { ...data },
      context: {
        effect: {
          kind: 'DamageEffect',
          damage: {
            source: { kind: 'seat', seatId: otherSeatId },
            target: { kind: 'seat', seatId: responderSeatId },
            amount: DUEL_DAMAGE,
            nature: 'normal',
            cause: { ...(first ? { cardInstanceId: first } : {}), card: tool },
          },
        },
      },
    },
  };
}

// Duel: after its Wuxie check, starting with the target, the two seats take
// turns playing a Sha (two each time against Matchless); the first who doesn't
// takes 1 damage from the other.
export const duelCard: CardDefinition = {
  id: 'duel',
  name: 'Duel',
  category: 'tool',
  legalPlayTargets: (state, ctx, registry) => otherLivingSeatTargets(state, ctx.seatId).filter(([t]) => t.kind === 'seat' && !untargetableBy(state, t.seatId, 'duel', registry)),
  play: (_state, ctx) => {
    if (ctx.respondingTo) return [];
    if (ctx.targets.length === 0) return []; // no target chosen — a no-op rather than a crash
    return toolOnTargets(ctx.card, ctx.seatId, [ctx.targets[0]]);
  },
  onTarget: (state, { tool, userSeatId, target }, registry) => {
    if (target.kind !== 'seat') return [];
    return [duelWindow(tool, target.seatId, userSeatId, { needed: answersNeededAgainst(state, userSeatId, registry), provided: 0 })];
  },
  // A Sha: another is still owed (Matchless), or the Duel turns back on the other seat.
  onResponse: (state, { pending, seatId, cardInstanceId }, registry) => {
    const damage = pending.context.effect.kind === 'DamageEffect' ? pending.context.effect.damage : null;
    const tool = damage?.cause?.card;
    if (damage?.source?.kind !== 'seat' || !tool) return [];
    const { needed = 1, provided = 0 } = (pending.data ?? {}) as Partial<DuelData>;
    if (provided + 1 < needed) return [duelWindow(tool, seatId, damage.source.seatId, { needed, provided: provided + 1 }, cardInstanceId)];
    return [duelWindow(tool, damage.source.seatId, seatId, { needed: answersNeededAgainst(state, seatId, registry), provided: 0 }, cardInstanceId)];
  },
};
