import type { SkillDefinition } from 'engine';
import { colourFor } from '../shared/suits';
import { makeStubborn } from './mountain';
import { makeArmedConsorts, makeHumility, makeReconsider } from './wu';

// Alternate Wu skills whose rules differ from Default's, by General id then the Chinese skill name.
// Each variant's id is `alternate:` plus the id of the Alternate English skill name.
export const ALTERNATE_WU_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  // Balance of Power: discards at most the seat's combined max HP in cards (Default: any number).
  'sun-quan': {
    制衡: {
      ...makeReconsider((state, seatId) => state.seats.find((s) => s.id === seatId)?.maxCombinedHp ?? 0),
      id: 'alternate:balance-of-power',
    },
  },
  // Warrior Lady: a may skill, asked once per instance of cards leaving her equipment (Default: compulsory, per card).
  'sun-shangxiang': {
    枭姬: { ...makeArmedConsorts('per-instance-may'), id: 'alternate:warrior-lady' },
  },
  // Humility: he can be chosen by Steal and Capture, which are cancelled for him (Default: can't be chosen).
  // Scrutinize (conversion, play, no per-turn limit): a red hand card as an Amass; it replaces Linked Camps, which is
  // not an Alternate skill. Amass's own rules apply unchanged.
  'lu-xun': {
    谦逊: { ...makeHumility(true), id: 'alternate:humility' },
    度勢: {
      id: 'alternate:scrutinize',
      conversions: [
        { id: 'scrutinize-amass', as: 'amass', cards: 1, accepts: (c, state, seatId, registry) => colourFor(state, seatId, c, registry) === 'red', when: 'play' },
      ],
    },
  },
  // Stabilization: works with exactly 1 discarded card too (Default: 2 or more).
  'zhang-zhao-and-zhang-hong': { 固政: { ...makeStubborn(1), id: 'alternate:stabilization' } },
};
