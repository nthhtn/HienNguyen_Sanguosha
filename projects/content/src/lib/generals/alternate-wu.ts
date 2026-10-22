import type { SkillDefinition } from 'engine';
import { makeReconsider } from './wu';

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
};
