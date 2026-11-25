import { defaultGroupIndex, doneCount, groupedLessons, LESSON_GROUPS } from './lesson-groups';
import type { Lesson, LessonGroupId } from './tutorial-types';

// Only `id` and `group` matter to the helpers.
const lesson = (id: string, group: LessonGroupId) => ({ id, group }) as unknown as Lesson;

describe('lesson groups', () => {
  describe('LESSON_GROUPS', () => {
    it('lists Basics, Cards and Special Effects in that order', () => {
      expect(LESSON_GROUPS.map((g) => g.id)).toEqual(['basics', 'cards', 'effects']);
    });
  });

  describe('groupedLessons', () => {
    it('returns the groups in list order whatever the order of the lessons', () => {
      const lessons = [lesson('c', 'effects'), lesson('a', 'basics'), lesson('b', 'cards'), lesson('a2', 'basics')];
      const grouped = groupedLessons(lessons);
      expect(grouped.map((g) => g.group.id)).toEqual(['basics', 'cards', 'effects']);
      expect(grouped[0].lessons.map((l) => l.id)).toEqual(['a', 'a2']);
    });

    it('keeps the lessons of a group in list order', () => {
      const grouped = groupedLessons([lesson('x', 'cards'), lesson('y', 'cards'), lesson('z', 'cards')]);
      expect(grouped[0].lessons.map((l) => l.id)).toEqual(['x', 'y', 'z']);
    });

    it('leaves out a group that has no lessons', () => {
      const grouped = groupedLessons([lesson('a', 'basics'), lesson('c', 'effects')]);
      expect(grouped.map((g) => g.group.id)).toEqual(['basics', 'effects']);
    });
  });

  describe('doneCount', () => {
    it('counts the lessons of the list that are completed', () => {
      expect(doneCount([lesson('a', 'basics'), lesson('b', 'basics')], new Set(['a']))).toBe(1);
    });

    it('does not count ids that are no lesson of the list', () => {
      expect(doneCount([lesson('a', 'basics')], new Set(['a', 'gone', 'b']))).toBe(1);
    });

    it('is 0 when nothing is completed', () => {
      expect(doneCount([lesson('a', 'basics')], new Set())).toBe(0);
    });
  });

  describe('defaultGroupIndex', () => {
    const groups = [{ lessons: [lesson('a', 'basics'), lesson('b', 'basics')] }, { lessons: [lesson('c', 'cards'), lesson('d', 'cards')] }];

    it('is 0 when nothing is done', () => {
      expect(defaultGroupIndex(groups, new Set())).toBe(0);
    });

    it('is the first group with a lesson left', () => {
      expect(defaultGroupIndex(groups, new Set(['a', 'b', 'c']))).toBe(1);
    });

    it('is 0 when every lesson is done', () => {
      expect(defaultGroupIndex(groups, new Set(['a', 'b', 'c', 'd']))).toBe(0);
    });

    it('ignores a stored id that is no lesson', () => {
      expect(defaultGroupIndex(groups, new Set(['a', 'gone', 'other']))).toBe(0);
    });
  });
});
