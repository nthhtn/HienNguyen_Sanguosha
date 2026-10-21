import type { CardDefinition, ChoiceOption, Effect, GameState, PendingChoice, UsedCard } from 'engine';
import { otherLivingSeatTargets, handOf } from '../shared/queries';
import { playColour, toolOnTargets } from '../shared/tools';
import { untargetableBy } from '../shared/abilities';
import { cardStep } from '../shared/steps';
import { recastEffects } from './chains';

type Look = 'main' | 'deputy' | 'hand';

const LOOK_LABELS: Record<Look, string> = { main: 'Main General', deputy: 'Deputy General', hand: 'Hand Cards' };

// A secret pick for `userSeatId`, about the Ascertain it used on `targetSeatId`.
function secretChoice(state: GameState, tool: UsedCard, userSeatId: string, targetSeatId: string, stage: string, options: ChoiceOption[]): Effect {
  const choice: PendingChoice = {
    id: `ascertain-${stage}-${tool.physical[0]?.instanceId ?? 'virtual'}-${targetSeatId}-${state.log.length}`,
    seatId: userSeatId,
    reason: { kind: 'choice', card: tool, userSeatId, targetSeatId },
    verb: 'pick',
    options,
    secret: true,
  };
  return { kind: 'OpenChoiceEffect', choice };
}

// Ascertain (spec "Ascertain"): a Tool at another living seat. Once its Wuxie
// check has passed, the user picks, in secret, what to look at: one of the
// target's hidden Generals (Main or Deputy), or its whole hand (the only
// option when both its Generals are exposed, even with an empty hand). The
// look is a second secret choice showing the cards or the General, closed with
// Done; nothing moves, and the log says only that Ascertain was used.
// Or Recast, played with no target: discarded, and the user draws 1 (no Wuxie
// check), as Chains.
export const ascertainCard: CardDefinition = {
  id: 'ascertain',
  name: 'Ascertain',
  category: 'tool',
  recastable: true,
  legalPlayTargets: (state, ctx, registry) => {
    const recast = ctx.via ? [] : [[]];
    const colour = playColour(state, ctx, registry);
    return [
      ...recast,
      ...otherLivingSeatTargets(state, ctx.seatId).filter(([target]) => target.kind === 'seat' && !untargetableBy(state, target.seatId, 'ascertain', registry, colour)),
    ];
  },
  play: (_state, ctx) => {
    if (ctx.respondingTo) return [];
    if (ctx.targets.length === 0) return recastEffects(ctx.seatId);
    return toolOnTargets(ctx.card, ctx.seatId, [ctx.targets[0]]);
  },
  // The pick of what to look at. It names no card or General: the cards are
  // read when the look opens (the 'ascertain-look' step).
  onTarget: (state, { tool, userSeatId, target }) => {
    const seat = state.seats.find((s) => s.id === target.seatId && !s.eliminated);
    if (target.kind !== 'seat' || !seat) return [];
    const hiddenSlots = (['main', 'deputy'] as const).filter((slot) => seat.generals && !seat.generals[slot].revealed);
    const looks: Look[] = [...hiddenSlots, 'hand'];
    const options = looks.map((look) => ({
      id: look,
      shows: { kind: 'label' as const, text: LOOK_LABELS[look] },
      effects: [cardStep('ascertain-look', tool, userSeatId, target, { look })],
    }));
    return [secretChoice(state, tool, userSeatId, target.seatId, 'pick', options)];
  },
  // The look: the hand's cards face up, or the General, then Done. No option does anything.
  onStep: (state, step) => {
    const targetSeatId = step.target.kind === 'seat' ? step.target.seatId : null;
    const seat = state.seats.find((s) => s.id === targetSeatId);
    if (step.step !== 'ascertain-look' || !seat || !targetSeatId) return [];
    const look = step.data?.['look'] as Look | undefined;
    const shown: ChoiceOption[] =
      look === 'main' || look === 'deputy'
        ? seat.generals
          ? [{ id: 'general', shows: { kind: 'general', generalId: seat.generals[look].generalDefinitionId }, effects: [] }]
          : []
        : handOf(state, targetSeatId).map((card) => ({ id: card.instanceId, shows: { kind: 'card' as const, card }, effects: [] }));
    const done: ChoiceOption = { id: 'done', shows: { kind: 'label', text: 'Done' }, effects: [] };
    return [secretChoice(state, step.card, step.userSeatId, targetSeatId, 'look', [...shown, done])];
  },
};
