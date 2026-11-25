import type { Lesson } from '../tutorial-types';
import { ALLEGIANCE_LESSON } from './allegiance';
import { GENERALS_LESSON } from './generals';

// The lessons, in the order the list shows them. Each is added with its own task.
export const LESSONS: Lesson[] = [GENERALS_LESSON, ALLEGIANCE_LESSON];
