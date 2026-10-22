import type { ChoiceOption, DamageDealtEvent, Effect, GameState, GeneralOwner, SkillDefinition } from 'engine';
import { requireZoneOfKind } from 'engine';
import { makeEternalLoyalty } from './fire';
import { ask, choiceOf, handZoneId, isLiving, on, seatOptions, skillStep, used } from '../shared/skills';

// Bequeathed Strategy (may): after each 1 damage he suffers he may look at the top 2 cards of the draw
// pile (he does not draw them), give one to any player (himself included), then give the remaining one
// to any player (the same player allowed). Both picks are secret choices: only he sees the cards, and the
// log says only that he used it. The cards stay in the pile until given.
const BEQUEATHED_ID = 'alternate:bequeathed-strategy';
const topOfPile = (state: GameState, count: number) => requireZoneOfKind(state.zones, 'drawPile').cards.slice(0, count);

// Who gets `cardId`: each living seat; giving it queues the card's move, then `after`.
function giveTo(state: GameState, owner: GeneralOwner, cardId: string, after: Effect[]): Effect {
  const living = state.seats.filter((s) => !s.eliminated).map((s) => s.id);
  return choiceOf(state, owner, {
    verb: 'pick',
    secret: true,
    options: seatOptions(living, (seatId) => [{ kind: 'MoveCardEffect', cardInstanceId: cardId, toZoneId: handZoneId(state, seatId), onlyFrom: requireZoneOfKind(state.zones, 'drawPile').id }, ...after]),
  });
}

const bequeathedStrategy: SkillDefinition = {
  id: BEQUEATHED_ID,
  triggers: [
    on<DamageDealtEvent>('after:DamageDealtEvent', {
      condition: (_state, event, owner) => event.damage.target.kind === 'seat' && event.damage.target.seatId === owner.seatId && event.damage.amount > 0,
      effect: (_state, event, owner) => Array.from({ length: event.damage.amount }, () => ask(owner, [used(owner), skillStep(owner, 'look')])),
    }),
  ],
  // 'look': the top cards, to give one; 'rest': the one left, after the first was given.
  onStep: (state, step) => {
    const { owner } = step;
    if (!isLiving(state, owner.seatId)) return [];
    if (step.step === 'rest') {
      const rest = step.data?.['card'] as string;
      return requireZoneOfKind(state.zones, 'drawPile').cards.some((c) => c.instanceId === rest) ? [giveTo(state, owner, rest, [])] : [];
    }
    const [first, second] = topOfPile(state, 2);
    if (!first) return [];
    if (!second) return [giveTo(state, owner, first.instanceId, [])];
    const options: ChoiceOption[] = [first, second].map((c, i) => ({
      id: c.instanceId,
      shows: { kind: 'card', card: c },
      effects: [giveTo(state, owner, c.instanceId, [skillStep(owner, 'rest', { card: [first, second][1 - i].instanceId })])],
    }));
    return [choiceOf(state, owner, { verb: 'pick', secret: true, options })];
  },
};

// Alternate Wei skills whose rules differ from Default's, by General id then the Chinese skill name.
// Each variant's id is `alternate:` plus the id of the Alternate English skill name.
export const ALTERNATE_WEI_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  // Eternal Loyalty: the picked seat's hand is raised to at most 5 cards (Default: its max HP, however high).
  'xun-yu': { 节命: { ...makeEternalLoyalty(5), id: 'alternate:eternal-loyalty' } },
  // Bequeathed Strategy: view the top 2 cards then give them (Default: draw 2 then give any of them).
  'guo-jia': { 遗计: bequeathedStrategy },
};
