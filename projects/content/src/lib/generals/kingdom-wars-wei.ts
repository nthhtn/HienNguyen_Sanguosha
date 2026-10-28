import type { CardInstance, ChoiceOption, ContentRegistry, DamageDealtEvent, Effect, GameState, GeneralOwner, PhaseChangedEvent, SkillDefinition } from 'engine';
import { requireZoneOfKind } from 'engine';
import { makeEternalLoyalty } from './fire';
import { riverGoddessOutcome } from './wei';
import { stashMove, stashZoneOf } from '../shared/farm';
import { handOf } from '../shared/queries';
import { ask, choiceOf, discardMoves, handZoneId, isLiving, on, ownCards, seatOptions, selectionOf, skillDamage, skillStep, used } from '../shared/skills';

// Bequeathed Strategy (may): after each 1 damage he suffers he may look at the top 2 cards of the draw
// pile (he does not draw them), give one to any player (himself included), then give the remaining one
// to any player (the same player allowed). Both picks are secret choices: only he sees the cards, and the
// log says only that he used it. The cards stay in the pile until given.
const BEQUEATHED_ID = 'kingdomWars:bequeathed-strategy';
const topOfPile = (state: GameState, count: number) => requireZoneOfKind(state.zones, 'drawPile').cards.slice(0, count);

// Who gets `cardId`: each living seat; giving it queues the card's move, then `after`.
function giveTo(state: GameState, owner: GeneralOwner, card: CardInstance, after: Effect[]): Effect {
  const cardId = card.instanceId;
  const living = state.seats.filter((s) => !s.eliminated).map((s) => s.id);
  return choiceOf(state, owner, {
    verb: 'pick',
    secret: true,
    // Each option carries the card, so only he (the chooser) sees which card he is giving.
    options: seatOptions(living, (seatId) => [{ kind: 'MoveCardEffect', cardInstanceId: cardId, toZoneId: handZoneId(state, seatId), onlyFrom: requireZoneOfKind(state.zones, 'drawPile').id }, ...after]).map((o) => ({ ...o, card })),
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
      const rest = requireZoneOfKind(state.zones, 'drawPile').cards.find((c) => c.instanceId === step.data?.['card']);
      return rest ? [giveTo(state, owner, rest, [])] : [];
    }
    const [first, second] = topOfPile(state, 2);
    if (!first) return [];
    if (!second) return [giveTo(state, owner, first, [])];
    const options: ChoiceOption[] = [first, second].map((c, i) => ({
      id: c.instanceId,
      shows: { kind: 'card', card: c },
      effects: [giveTo(state, owner, c, [skillStep(owner, 'rest', { card: [first, second][1 - i].instanceId })])],
    }));
    return [choiceOf(state, owner, { verb: 'pick', secret: true, options })];
  },
};

// Goddess Luo (may): at the start of her turn she may judge. On a black card she may judge again, or stop;
// a red card ends it and is discarded. The black cards wait out of play until the process ends, then she
// acquires them all; if she is out by then they are discarded. (Identity puts each black card in her hand at once.)
//
// Where the black cards wait: each judgment's `done` sends its card from `processing` to the discard pile,
// and Heaven's Envy reads cards still in `processing`, so a card cannot wait there. It waits in her seat's
// stash pile instead: no hand, equipment or judgment zone, so no use, response, Devil or Demonic Talent pick
// and no Dismantle or Steal can reach it, and Guozhan's elimination discards the stash with her other
// zones. `held` (the judgment's data) lists the ids she holds, so a Deng Ai partner's Farms in the same stash
// are left alone. (With Deng Ai as her partner, Military Farm's distance bonus counts the stash, held cards
// included, for the length of the process; nothing in her Start Phase measures distance.)
const GODDESS_LUO_ID = 'kingdomWars:goddess-luo';
const heldOf = (data: Record<string, unknown> | undefined): string[] => (data?.['held'] as string[] | undefined) ?? [];
const goddessLuoEnd = (owner: GeneralOwner, held: string[]): Effect => skillStep(owner, 'end', { held });
// One more judgment; with no card left to judge, the process ends.
const goddessLuoJudge = (owner: GeneralOwner, held: string[]): Effect => ({
  kind: 'JudgeEffect', seatId: owner.seatId, reader: { kind: 'skill', owner }, data: { held }, otherwise: [goddessLuoEnd(owner, held)],
});

const goddessLuo: SkillDefinition = {
  id: GODDESS_LUO_ID,
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      // A table with no stash pile has nowhere to hold the black cards: no ask.
      condition: (state, event, owner) => event.phase === 'Start' && event.seatId === owner.seatId && !!stashZoneOf(state, owner.seatId),
      // Don't at this first ask: nothing happens.
      effect: (_state, _event, owner) => [ask(owner, [goddessLuoJudge(owner, [])])],
    }),
  ],
  onJudged: (state, { owner, judged, data, done }, registry) => {
    const held = heldOf(data);
    if (riverGoddessOutcome(state, owner.seatId, judged, registry) === 'ends') return [done, goddessLuoEnd(owner, held)];
    const now = [...held, judged.instanceId];
    // Out of processing before `done`, so `done` leaves it be; then judge again, or stop and acquire.
    return [stashMove(state, owner.seatId, judged.instanceId, requireZoneOfKind(state.zones, 'processing').id), done, ask(owner, [goddessLuoJudge(owner, now)], [goddessLuoEnd(owner, now)])];
  },
  // 'end': every held card still in the stash goes to her hand, or to the discard pile if she is out.
  onStep: (state, step) => {
    const { owner } = step;
    const stash = stashZoneOf(state, owner.seatId);
    if (!stash) return [];
    const to = isLiving(state, owner.seatId) ? handZoneId(state, owner.seatId) : requireZoneOfKind(state.zones, 'discardPile').id;
    return heldOf(step.data).map((cardInstanceId): Effect => ({ kind: 'MoveCardEffect', cardInstanceId, toZoneId: to, onlyFrom: stash.id }));
  },
};

// Dauntless (may): at the end of another seat's turn she may discard a Basic card from her hand. That
// seat then discards an Equipment card from its hand or equipment area, or takes 1 damage from her. A
// seat with no Equipment card takes the damage without a choice. With no Basic hand card she is not asked.
const DAUNTLESS_ID = 'kingdomWars:dauntless';
const basicsOf = (state: GameState, seatId: string, registry: ContentRegistry) => handOf(state, seatId).filter((c) => registry.cards.get(c.definitionId)?.category === 'basic');
const equipmentOf = (state: GameState, seatId: string, registry: ContentRegistry) => ownCards(state, seatId, true).filter((c) => registry.cards.get(c.definitionId)?.category === 'equipment');

const dauntless: SkillDefinition = {
  id: DAUNTLESS_ID,
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner, registry) =>
        event.phase === 'End' && event.seatId !== owner.seatId && state.turn.ownerSeatId === event.seatId && isLiving(state, event.seatId) && isLiving(state, owner.seatId) && basicsOf(state, owner.seatId, registry).length > 0,
      effect: (_state, event, owner) => [ask(owner, [skillStep(owner, 'discard', { victim: event.seatId })], [], event.seatId)],
    }),
  ],
  onStep: (state, step, registry) => {
    const { owner } = step;
    const victim = step.data?.['victim'] as string;
    // 'paid': the victim's chosen Equipment card goes.
    if (step.step === 'paid') return discardMoves(state, (step.data?.['picked'] as string[]) ?? []);
    if (step.step === 'discard') {
      const eligible = basicsOf(state, owner.seatId, registry).map((c) => c.instanceId);
      if (!isLiving(state, owner.seatId) || !isLiving(state, victim) || eligible.length === 0) return [];
      return [selectionOf(state, owner, { of: 'cards', eligibleIds: eligible, min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'discarded', { victim }) }, onCancel: [], targetSeatId: victim })];
    }
    // 'discarded': her card goes; then the victim discards an Equipment card or takes the damage.
    const mine = (step.data?.['picked'] as string[]) ?? [];
    const hit = skillDamage(owner, victim);
    if (!isLiving(state, victim)) return [used(owner, 'used', victim), ...discardMoves(state, mine)];
    const gear = equipmentOf(state, victim, registry).map((c) => c.instanceId);
    const then = gear.length === 0
      ? [hit]
      : [selectionOf(state, owner, { of: 'cards', eligibleIds: gear, min: 1, max: 1, seatId: victim, targetSeatId: victim, then: { kind: 'skill-step', step: skillStep(owner, 'paid', { victim }) }, onCancel: [hit] })];
    return [used(owner, 'used', victim), ...discardMoves(state, mine), ...then];
  },
};

// Kingdom Wars Wei skills whose rules differ from Identity's, by General id then the Chinese skill name.
// Each variant's id is `kingdomWars:` plus the id of the Kingdom Wars English skill name.
export const KINGDOM_WARS_WEI_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  // Eternal Loyalty: the picked seat's hand is raised to at most 5 cards (Identity: its max HP, however high).
  'xun-yu': { 节命: { ...makeEternalLoyalty(5), id: 'kingdomWars:eternal-loyalty' } },
  // Bequeathed Strategy: view the top 2 cards then give them (Identity: draw 2 then give any of them).
  'guo-jia': { 遗计: bequeathedStrategy },
  // Goddess Luo: the black cards wait out of play until the judging ends (Identity: each to her hand at once).
  'zhen-ji': { 洛神: goddessLuo },
  // Dauntless: Yue Jin is new to Kingdom Wars (Identity has no such General).
  'yue-jin': { 骁果: dauntless },
};
