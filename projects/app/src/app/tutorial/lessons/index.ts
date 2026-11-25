import type { Lesson } from '../tutorial-types';
import { ALLEGIANCE_LESSON } from './allegiance';
import { GENERALS_LESSON } from './generals';
import { SHA_SHAN_LESSON } from './sha-shan';
import { TURN_LESSON } from './turn';

// The lessons, in the order the list shows them. Each is added with its own task.
export const LESSONS: Lesson[] = [GENERALS_LESSON, ALLEGIANCE_LESSON, TURN_LESSON, SHA_SHAN_LESSON];
