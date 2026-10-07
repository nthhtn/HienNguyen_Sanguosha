import type { SkillDefinition } from 'engine';
import type { GeneralSkillSet } from './types';
import { atDrawPhase } from '../shared/skills';

// The Wu base Generals' skills (General Skills spec, "Wu"). Every skill acts
// for the `owner` the engine passes in, never by searching for its General.

// Brave Gesture (may): in your Draw Phase you may draw 1 extra card.
export const braveGesture: SkillDefinition = {
  id: 'brave-gesture',
  triggers: [atDrawPhase({ use: (_state, passed) => [{ ...passed, count: passed.count + 1 }] })],
};

export const WU_GENERALS: GeneralSkillSet[] = [{ id: 'zhou-yu', skills: [braveGesture] }];
