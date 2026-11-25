import type { Lesson } from '../tutorial-types';
import { ALLEGIANCE_LESSON } from './allegiance';
import { CHAINS_LESSON } from './chains';
import { DAMAGE_LESSON } from './damage';
import { EQUIPMENT_LESSON } from './equipment';
import { GENERALS_LESSON } from './generals';
import { JUDGMENT_LESSON } from './judgment';
import { SHA_SHAN_LESSON } from './sha-shan';
import { TOOLS_LESSON } from './tools';
import { TURN_LESSON } from './turn';
import { WUXIE_LESSON } from './wuxie';

// The lessons, in the order the list shows them. Each is added with its own task.
export const LESSONS: Lesson[] = [GENERALS_LESSON, ALLEGIANCE_LESSON, TURN_LESSON, SHA_SHAN_LESSON, DAMAGE_LESSON, EQUIPMENT_LESSON, TOOLS_LESSON, WUXIE_LESSON, JUDGMENT_LESSON, CHAINS_LESSON];
