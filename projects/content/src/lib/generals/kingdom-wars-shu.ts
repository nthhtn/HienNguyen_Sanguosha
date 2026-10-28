import type { ContentRegistry, GameState, GeneralOwner, HealEvent, PhaseChangedEvent, SkillDefinition } from 'engine';
import { makeNirvana } from './fire';
import { makeIntenseEdge } from './forest';
import { makeEmptyCity, makeGatheringWisdom, makeKindness } from './shu';
import { exposedKingdom, ownKingdom } from '../shared/kingdom';
import { handOf } from '../shared/queries';
import { ask, choiceOf, discardMoves, draw, heal, hpOf, isLiving, on, seatOptions, skillStep, used } from '../shared/skills';

// Prudence (may): whenever she regains HP, once per point regained, she may pick another seat of her
// Kingdom to draw 1 card. Only exposed seats count (a hidden seat has no Kingdom, so is never picked);
// an Ambitionist is a Kingdom of one, so there is nobody to pick. With no one to pick she is not asked.
// A hidden General's skill reveals it on Use, so her Kingdom for the ask is her true one: the seat's own
// once it has one, else her General's. The picks are other living seats exposed in that Kingdom.
function kingdomMates(state: GameState, owner: GeneralOwner, registry: ContentRegistry): string[] {
  const own = ownKingdom(state, owner, registry);
  if (!own) return [];
  return state.seats.filter((x) => x.id !== owner.seatId && !x.eliminated && exposedKingdom(state, x.id) === own).map((x) => x.id);
}

const prudence: SkillDefinition = {
  id: 'kingdomWars:prudence',
  triggers: [
    on<HealEvent>('after:HealEvent', {
      condition: (state, event, owner, registry) => event.target.kind === 'seat' && event.target.seatId === owner.seatId && isLiving(state, owner.seatId) && kingdomMates(state, owner, registry).length > 0,
      effect: (_state, event, owner) => Array.from({ length: event.amount }, () => ask(owner, [skillStep(owner, 'pick')])),
    }),
  ],
  onStep: (state, step, registry) => {
    const { owner } = step;
    const mates = isLiving(state, owner.seatId) ? kingdomMates(state, owner, registry) : [];
    if (mates.length === 0) return [];
    return [choiceOf(state, owner, { verb: 'pick', options: seatOptions(mates, (seatId) => [used(owner, 'used', seatId), draw(seatId, 1)]) })];
  },
};

// Divine Wisdom (may): at the start of her turn she may discard all her hand cards; if she discarded at
// least as many as her current HP, she regains 1 HP. With an empty hand she is not asked.
const divineWisdom: SkillDefinition = {
  id: 'kingdomWars:divine-wisdom',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) => event.phase === 'Start' && event.seatId === owner.seatId && handOf(state, owner.seatId).length > 0,
      effect: (_state, _event, owner) => [ask(owner, [skillStep(owner, 'discard')])],
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const cards = handOf(state, owner.seatId).map((c) => c.instanceId);
    if (!isLiving(state, owner.seatId) || cards.length === 0) return [];
    return [used(owner), ...discardMoves(state, cards), ...(cards.length >= hpOf(state, owner.seatId) ? [heal(owner.seatId)] : [])];
  },
};

// Kingdom Wars Shu skills whose rules differ from Dynasty Wars', by General id then the Chinese skill name.
// Each variant's id is `kingdomWars:` plus the id of the Kingdom Wars English skill name.
export const KINGDOM_WARS_SHU_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  // Benevolence: heals at 3 cards given in the turn (Dynasty Wars: 2).
  'liu-bei': { 仁德: { ...makeKindness(3), id: 'kingdomWars:benevolence' } },
  // Prudence, Divine Wisdom: Gan Fu Ren is new to Kingdom Wars (Dynasty Wars has no such General).
  'gan-fu-ren': { 淑慎: prudence, 神智: divineWisdom },
  // Assembling Wisdom: no draw for a Tool converted from other cards. Genius is unchanged (cleared wording).
  'huang-yueying': { 集智: { ...makeGatheringWisdom(false), id: 'kingdomWars:assembling-wisdom' } },
  // Fearsome Blade: only when the damaged seat is one the Slash was aimed at.
  'zhu-rong': { 烈刃: { ...makeIntenseEdge(true), id: 'kingdomWars:fearsome-blade' } },
  // Resurrection: also clears the Chained state (Dynasty Wars' Nirvana only turns face up).
  'pang-tong': { 涅槃: { ...makeNirvana(true), id: 'kingdomWars:resurrection' } },
  // Empty City: with no hand cards he can be chosen by Slash and Duel, which are cancelled for him (Dynasty Wars: can't be chosen).
  'zhuge-liang': { 空城: { ...makeEmptyCity(true), id: 'kingdomWars:empty-city' } },
};
