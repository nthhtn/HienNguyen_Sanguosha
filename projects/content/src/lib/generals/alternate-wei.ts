import type { ChoiceOption, DamageDealtEvent, Effect, GameState, GeneralOwner, PhaseChangedEvent, SkillDefinition } from 'engine';
import { requireZoneOfKind } from 'engine';
import { makeEternalLoyalty } from './fire';
import { riverGoddessOutcome } from './wei';
import { stashMove, stashZoneOf } from '../shared/farm';
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

// Goddess Luo (may): at the start of her turn she may judge. On a black card she may judge again, or stop;
// a red card ends it and is discarded. The black cards wait out of play until the process ends, then she
// acquires them all; if she is out by then they are discarded. (Default puts each black card in her hand at once.)
//
// Where the black cards wait: each judgment's `done` sends its card from `processing` to the discard pile,
// and Heaven's Envy reads cards still in `processing`, so a card cannot wait there. It waits in her seat's
// stash pile instead: no hand, equipment or judgment zone, so no use, response, Devil or Demonic Talent pick
// and no Dismantle or Steal can reach it, and Kingdom War's elimination discards the stash with her other
// zones. `held` (the judgment's data) lists the ids she holds, so a Deng Ai partner's Farms in the same stash
// are left alone. (With Deng Ai as her partner, Military Farm's distance bonus counts the stash, held cards
// included, for the length of the process; nothing in her Start Phase measures distance.)
const GODDESS_LUO_ID = 'alternate:goddess-luo';
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

// Alternate Wei skills whose rules differ from Default's, by General id then the Chinese skill name.
// Each variant's id is `alternate:` plus the id of the Alternate English skill name.
export const ALTERNATE_WEI_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  // Eternal Loyalty: the picked seat's hand is raised to at most 5 cards (Default: its max HP, however high).
  'xun-yu': { 节命: { ...makeEternalLoyalty(5), id: 'alternate:eternal-loyalty' } },
  // Bequeathed Strategy: view the top 2 cards then give them (Default: draw 2 then give any of them).
  'guo-jia': { 遗计: bequeathedStrategy },
  // Goddess Luo: the black cards wait out of play until the judging ends (Default: each to her hand at once).
  'zhen-ji': { 洛神: goddessLuo },
};
