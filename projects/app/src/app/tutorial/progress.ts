import type { LessonId } from './tutorial-types';

const KEY = 'tutorial.completed';
const LESSON_IDS: ReadonlySet<string> = new Set<LessonId>(['generals', 'allegiance', 'turn', 'sha-shan', 'damage', 'equipment', 'tools', 'wuxie', 'judgment', 'chains']);

// Which lessons the beginner has finished, remembered in the browser. It only marks lessons done in the list, so a
// private window, a full disk or junk in storage means no marks and nothing else.
export function loadCompleted(): Set<LessonId> {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is LessonId => typeof id === 'string' && LESSON_IDS.has(id)));
  } catch {
    return new Set();
  }
}

export function saveCompleted(done: ReadonlySet<LessonId>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...done]));
  } catch {
    // Nothing to do: the page works without it.
  }
}
