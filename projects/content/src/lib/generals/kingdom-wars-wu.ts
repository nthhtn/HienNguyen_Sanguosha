import type { SkillDefinition } from 'engine';
import { colourFor } from '../shared/suits';
import { makeStubborn } from './mountain';
import { makeArmedConsorts, makeHumility, makeReconsider } from './wu';
import { distanceOneFlag } from '../shared/queries';
import { discardMoves, isLiving, otherLivingSeatIds, ownCards, selectionOf, skillStep, used } from '../shared/skills';

// Close Combat (may): when he uses a Sha he may add one more target, who must be within physical distance 1
// of him and a legal Sha target (so within his attack range, weapon included). The Sha's target pick reads
// the modifier; he picks one or two targets.
const closeCombat: SkillDefinition = { id: 'kingdomWars:close-combat', modifiers: { extraShaTargets: 1 } };

// Swift and Deadly (active, once per Play Phase): he discards a card from his hand or equipment area and
// picks another living seat; his distance to that seat counts as 1 until the end of the turn. Only his
// distance to it changes. Nothing is discarded unless a seat is picked.
const swiftAndDeadly: SkillDefinition = {
  id: 'kingdomWars:swift-and-deadly',
  active: {
    usesPerTurn: 1,
    canUse: (state, { seatId }) => ownCards(state, seatId, true).length > 0 && otherLivingSeatIds(state, seatId).length > 0,
    start: (state, { seatId, owner }) => [
      selectionOf(state, owner, { of: 'cards', eligibleIds: ownCards(state, seatId, true).map((c) => c.instanceId), min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'discarded') }, onCancel: [] }),
    ],
  },
  onStep: (state, step) => {
    const { owner } = step;
    const data = step.data ?? {};
    const seats = otherLivingSeatIds(state, owner.seatId);
    if (step.step === 'discarded') {
      const card = (data['picked'] as string[])[0];
      return seats.length === 0 ? [] : [selectionOf(state, owner, { of: 'seats', eligibleIds: seats, min: 1, max: 1, then: { kind: 'skill-step', step: skillStep(owner, 'chosen', { card }) }, onCancel: [] })];
    }
    const target = (data['picked'] as string[])[0];
    const card = data['card'] as string;
    if (!isLiving(state, target) || !ownCards(state, owner.seatId, true).some((c) => c.instanceId === card)) return [];
    return [...discardMoves(state, [card]), { kind: 'SetTurnFlagEffect', flag: distanceOneFlag(owner.seatId, target) }, used(owner, 'used', target)];
  },
};

// Kingdom Wars Wu skills whose rules differ from Dynasty Wars', by General id then the Chinese skill name.
// Each variant's id is `kingdomWars:` plus the id of the Kingdom Wars English skill name.
export const KINGDOM_WARS_WU_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  // Balance of Power: discards at most the seat's combined max HP in cards (Dynasty Wars: any number).
  'sun-quan': {
    制衡: {
      ...makeReconsider((state, seatId) => state.seats.find((s) => s.id === seatId)?.maxCombinedHp ?? 0),
      id: 'kingdomWars:balance-of-power',
    },
  },
  // Warrior Lady: a may skill, asked once per instance of cards leaving her equipment (Dynasty Wars: compulsory, per card).
  'sun-shangxiang': {
    枭姬: { ...makeArmedConsorts('per-instance-may'), id: 'kingdomWars:warrior-lady' },
  },
  // Humility: he can be chosen by Steal and Capture, which are cancelled for him (Dynasty Wars: can't be chosen).
  // Scrutinize (conversion, play, no per-turn limit): a red hand card as an Amass; it replaces Linked Camps, which is
  // not a Kingdom Wars skill. Amass's own rules apply unchanged.
  'lu-xun': {
    谦逊: { ...makeHumility(true), id: 'kingdomWars:humility' },
    度勢: {
      id: 'kingdomWars:scrutinize',
      conversions: [
        { id: 'scrutinize-amass', as: 'amass', cards: 1, accepts: (c, state, seatId, registry) => colourFor(state, seatId, c, registry) === 'red', when: 'play' },
      ],
    },
  },
  // Stabilization: works with exactly 1 discarded card too (Dynasty Wars: 2 or more).
  'zhang-zhao-and-zhang-hong': { 固政: { ...makeStubborn(1), id: 'kingdomWars:stabilization' } },
  // Close Combat and Swift and Deadly: Ding Feng is new to Kingdom Wars (Dynasty Wars has no such General).
  'ding-feng': { 短兵: closeCombat, 奋迅: swiftAndDeadly },
};
