import type { HealEvent, PhaseChangedEvent, SkillDefinition } from 'engine';
import { makeIntenseEdge } from './forest';
import { makeEmptyCity, makeGatheringWisdom, makeKindness } from './shu';
import { sameKingdomSeatIds } from '../shared/kingdom';
import { handOf } from '../shared/queries';
import { ask, choiceOf, discardMoves, draw, heal, hpOf, isLiving, on, seatOptions, skillStep, used } from '../shared/skills';

// Prudence (may): whenever she regains HP, once per point regained, she may pick another seat of her
// Kingdom to draw 1 card. Only exposed seats count (a hidden seat has no Kingdom, so is never picked);
// an Ambitionist is a Kingdom of one, so there is nobody to pick. With no one to pick she is not asked.
const kingdomMates = (state: Parameters<typeof sameKingdomSeatIds>[0], seatId: string) => sameKingdomSeatIds(state, seatId).filter((id) => id !== seatId);

const prudence: SkillDefinition = {
  id: 'alternate:prudence',
  triggers: [
    on<HealEvent>('after:HealEvent', {
      condition: (state, event, owner) => event.target.kind === 'seat' && event.target.seatId === owner.seatId && isLiving(state, owner.seatId) && kingdomMates(state, owner.seatId).length > 0,
      effect: (_state, event, owner) => Array.from({ length: event.amount }, () => ask(owner, [skillStep(owner, 'pick')])),
    }),
  ],
  onStep: (state, step) => {
    const { owner } = step;
    const mates = isLiving(state, owner.seatId) ? kingdomMates(state, owner.seatId) : [];
    if (mates.length === 0) return [];
    return [choiceOf(state, owner, { verb: 'pick', options: seatOptions(mates, (seatId) => [used(owner, 'used', seatId), draw(seatId, 1)]) })];
  },
};

// Divine Wisdom (may): at the start of her turn she may discard all her hand cards; if she discarded at
// least as many as her current HP, she regains 1 HP. With an empty hand she is not asked.
const divineWisdom: SkillDefinition = {
  id: 'alternate:divine-wisdom',
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

// Alternate Shu skills whose rules differ from Default's, by General id then the Chinese skill name.
// Each variant's id is `alternate:` plus the id of the Alternate English skill name.
export const ALTERNATE_SHU_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  // Benevolence: heals at 3 cards given in the turn (Default: 2).
  'liu-bei': { 仁德: { ...makeKindness(3), id: 'alternate:benevolence' } },
  // Fearsome Blade: only when the damaged seat is one the Slash was aimed at.
  // Assembling Wisdom: no draw for a Tool converted from other cards. Genius is unchanged (cleared wording).
  // Prudence, Divine Wisdom: Gan Fu Ren is new to Alternate (Default has no such General).
  'gan-fu-ren': { 淑慎: prudence, 神智: divineWisdom },
  'huang-yueying': { 集智: { ...makeGatheringWisdom(false), id: 'alternate:assembling-wisdom' } },
  'zhu-rong': { 烈刃: { ...makeIntenseEdge(true), id: 'alternate:fearsome-blade' } },
  // Empty City: with no hand cards he can be chosen by Slash and Duel, which are cancelled for him (Default: can't be chosen).
  'zhuge-liang': { 空城: { ...makeEmptyCity(true), id: 'alternate:empty-city' } },
};
