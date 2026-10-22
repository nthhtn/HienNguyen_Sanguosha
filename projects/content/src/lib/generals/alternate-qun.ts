import type { SkillDefinition } from 'engine';
import { makeEclipseTheMoon, makeSowDiscord } from './qun';

// Alternate Qun skills whose rules differ from Default's, by General id then the Chinese skill name.
// Each variant's id is `alternate:` plus the id of the Alternate English skill name.
export const ALTERNATE_QUN_VARIANTS: Readonly<Record<string, Readonly<Record<string, SkillDefinition>>>> = {
  'diao-chan': {
    // Seed of Animosity: the Duel it makes cannot be answered by Wuxie or Wuxie Kingdom.
    离间: { ...makeSowDiscord(false), id: 'alternate:seed-of-animosity' },
    // Envious Moon: asked whether to draw 1 at the start of the End Phase (Default: compulsory).
    闭月: { ...makeEclipseTheMoon(true), id: 'alternate:envious-moon' },
  },
};
