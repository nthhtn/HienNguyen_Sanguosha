import type { CardInstance, CardPlayedEvent, GeneralOwner, PhaseChangedEvent, SkillDefinition } from 'engine';
import { abilityUseKey, drawPileTop } from 'engine';
import type { ContentRegistry, GameState } from 'engine';
import { colourFor } from '../shared/suits';
import type { GeneralSkillSet } from './types';
import { CardStep, actedOn, askAtStep, atStep } from '../shared/steps';
import { handOf } from '../shared/queries';
import { ask, draw, heal, on, otherLivingSeatIds, reasonOf, selectionOf, skillStep, used } from '../shared/skills';

// The Shu base Generals' skills (General Skills spec, "Shu"). Every skill acts
// for the `owner` the engine passes in, never by searching for its General.

const red = (card: CardInstance, state: GameState, seatId: string, registry: ContentRegistry) => colourFor(state, seatId, card, registry) === 'red';

// Roar (compulsory): there is no limit on how many Sha you play.
export const roar: SkillDefinition = { id: 'roar', compulsory: true, modifiers: { shaLimit: Number.POSITIVE_INFINITY } };

// Horsemanship (compulsory): your distance to every other seat is 1 smaller, never below 1.
export const horsemanship: SkillDefinition = { id: 'horsemanship', compulsory: true, modifiers: { distanceToOthers: -1 } };

// Empty City (compulsory): while you have no hand cards, Sha and Duel can't target you.
export const emptyCity: SkillDefinition = { id: 'empty-city', compulsory: true, modifiers: { untargetableWithEmptyHandBy: ['sha', 'duel'] } };

// Wondrous Talent (compulsory): your Tools ignore distance (Steal, Starvation).
export const wondrousTalent: SkillDefinition = { id: 'wondrous-talent', compulsory: true, modifiers: { toolsIgnoreDistance: true } };

// Fighting Saint (conversion, play and respond): any red card from your hand
// or equipment as a Sha.
export const fightingSaint: SkillDefinition = {
  id: 'fighting-saint',
  conversions: [{ id: 'fighting-saint', as: 'sha', cards: 1, from: 'hand-and-equipment', accepts: red, when: 'both' }],
};

// Dragon Courage (conversion, play and respond): a Shan as a Sha, and a Sha as a Shan.
export const dragonCourage: SkillDefinition = {
  id: 'dragon-courage',
  conversions: [
    { id: 'shan-as-sha', as: 'sha', cards: 1, accepts: (c) => c.definitionId === 'shan', when: 'both' },
    { id: 'sha-as-shan', as: 'shan', cards: 1, accepts: (c) => c.definitionId === 'sha', when: 'respond' },
  ],
};

// Gathering Wisdom (may): when you play a non-delayed Tool (an answering Wuxie
// included), you may draw 1 card, before the Tool takes effect.
export const gatheringWisdom: SkillDefinition = {
  id: 'gathering-wisdom',
  triggers: [
    on<CardPlayedEvent>('after:CardPlayedEvent', {
      condition: (_state, event, owner, registry) => {
        const definition = registry.cards.get(event.card.as);
        return event.seatId === owner.seatId && definition?.category === 'tool' && !definition.delayed;
      },
      effect: (_state, _event, owner) => [ask(owner, [draw(owner.seatId, 1)])],
    }),
  ],
};

// Iron Cavalry (may): after you target a seat with a Sha, you may judge. On
// red, that seat can't play a Shan against this Sha (Eight Trigrams included).
export const ironCavalry: SkillDefinition = {
  id: 'iron-cavalry',
  triggers: [
    atStep(['sha-targeted'], {
      condition: (_state, step, owner) => owner.kind === 'general' && step.userSeatId === owner.seatId,
      effect: (_state, step, owner) => {
        const passed = actedOn(step, owner);
        const judge = { kind: 'JudgeEffect' as const, seatId: owner.seatId, reader: { kind: 'skill' as const, owner: owner as GeneralOwner }, data: { step: passed }, otherwise: [passed] };
        return [askAtStep(owner, 'iron-cavalry', step, [judge])];
      },
    }),
  ],
  onJudged: (state, { owner, judged, data, done }, registry) => {
    const step = data?.['step'] as CardStep;
    if (colourFor(state, owner.seatId, judged, registry) !== 'red') return [done, step];
    return [done, used(owner, 'unblockable', step.target.seatId), { ...step, data: { ...step.data, unblockable: true } }];
  },
};

// Astrology (may): in your Start Phase you may look at the top X cards of the
// draw pile (X = living seats, at most 5) and put each back on top or at the
// bottom, in any order.
export const astrology: SkillDefinition = {
  id: 'astrology',
  triggers: [
    on<PhaseChangedEvent>('after:PhaseChangedEvent', {
      condition: (state, event, owner) => event.phase === 'Start' && event.seatId === owner.seatId && drawPileTop(state, 1).length > 0,
      effect: (_state, _event, owner) => [ask(owner, [skillStep(owner, 'look')])],
    }),
  ],
  onStep: (state, step) => {
    const living = state.seats.filter((s) => !s.eliminated).length;
    const cards = drawPileTop(state, Math.min(5, living));
    if (cards.length === 0) return [];
    return [{
      kind: 'OpenArrangementEffect',
      arrangement: { id: `astrology-${step.owner.seatId}-${state.log.length}`, seatId: step.owner.seatId, reason: reasonOf(step.owner), cardInstanceIds: cards.map((c) => c.instanceId) },
    }];
  },
};

const givenKey = (owner: GeneralOwner) => `${abilityUseKey(owner)}/given`;
const healedKey = (owner: GeneralOwner) => `${abilityUseKey(owner)}/healed`;

// Kindness (active, any number of times): in your Play Phase you may give any
// of your hand cards to another seat. Once per turn, when the total given this
// turn first reaches 2 or more, you recover 1 HP.
export const kindness: SkillDefinition = {
  id: 'kindness',
  active: {
    canUse: (state, { seatId }) => handOf(state, seatId).length > 0 && otherLivingSeatIds(state, seatId).length > 0,
    start: (state, { seatId, owner }) => {
      const hand = handOf(state, seatId).map((c) => c.instanceId);
      return [
        selectionOf(state, owner, {
          of: 'cards', eligibleIds: hand, min: 1, max: hand.length,
          then: { kind: 'give', toSeatIds: otherLivingSeatIds(state, seatId), tally: givenKey(owner), then: [skillStep(owner, 'heal')] },
          onCancel: [],
        }),
      ];
    },
  },
  onStep: (state, step) => {
    const uses = state.turn.abilityUses ?? {};
    if ((uses[givenKey(step.owner)] ?? 0) < 2 || uses[healedKey(step.owner)]) return [];
    return [{ kind: 'IncrementEffect', scope: 'turn', key: healedKey(step.owner), by: 1 }, heal(step.owner.seatId)];
  },
};

// Fierce General: a Lord skill, inactive in Kingdom War.
export const fierceGeneral: SkillDefinition = { id: 'fierce-general', lord: true };

export const SHU_GENERALS: GeneralSkillSet[] = [
  { id: 'guan-yu', skills: [fightingSaint] },
  { id: 'huang-yueying', skills: [gatheringWisdom, wondrousTalent] },
  { id: 'liu-bei', skills: [kindness, fierceGeneral] },
  { id: 'ma-chao', skills: [horsemanship, ironCavalry] },
  { id: 'zhang-fei', skills: [roar] },
  { id: 'zhao-yun', skills: [dragonCourage] },
  { id: 'zhuge-liang', skills: [astrology, emptyCity] },
];
