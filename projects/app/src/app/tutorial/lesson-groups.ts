import type { MessageKey } from '../i18n/messages';
import type { Lesson, LessonGroupId } from './tutorial-types';

export interface LessonGroup {
  id: LessonGroupId;
  titleKey: MessageKey;
}

// The tabs of the Tutorial page, in the order they show.
export const LESSON_GROUPS: LessonGroup[] = [
  { id: 'basics', titleKey: 'tutorial.group.basics' },
  { id: 'cards', titleKey: 'tutorial.group.cards' },
  { id: 'effects', titleKey: 'tutorial.group.effects' },
];

// Every group with its lessons, both in list order; a group with no lessons has no tab.
export function groupedLessons(lessons: Lesson[]): { group: LessonGroup; lessons: Lesson[] }[] {
  return LESSON_GROUPS.map((group) => ({ group, lessons: lessons.filter((l) => l.group === group.id) })).filter((g) => g.lessons.length > 0);
}

// How many of these lessons are done. An id in `completed` that is no lesson of the list does not count.
export function doneCount(lessons: Lesson[], completed: ReadonlySet<string>): number {
  return lessons.filter((l) => completed.has(l.id)).length;
}

// The tab to open on: the first with a lesson left to do, or the first when everything is done.
export function defaultGroupIndex(groups: { lessons: Lesson[] }[], completed: ReadonlySet<string>): number {
  const at = groups.findIndex((g) => doneCount(g.lessons, completed) < g.lessons.length);
  return at === -1 ? 0 : at;
}
