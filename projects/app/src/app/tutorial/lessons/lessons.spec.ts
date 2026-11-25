import { buildContentRegistry } from 'content';
import { en } from '../../i18n/en';
import { vi } from '../../i18n/vi';
import { isAnchorId } from '../anchors';
import { LESSONS } from './index';
import { playLesson } from './play-lesson.testing';

const registry = buildContentRegistry();

// The lessons in the order the list shows them. Each lesson's task adds its id here.
const REGISTERED = ['generals', 'allegiance', 'turn', 'sha-shan', 'damage', 'equipment', 'tools', 'wuxie', 'judgment'];

describe('the lessons', () => {
  it('are registered in the order of the list, one for each id', () => {
    expect(LESSONS.map((l) => l.id)).toEqual(REGISTERED);
  });

  it.each(LESSONS.map((l) => [l.id, l] as const))('lesson %s plays to the end', (_id, lesson) => {
    const played = playLesson(lesson, registry);
    const failed = played.find((s) => !s.ok);
    expect({ failedStep: failed?.stepId ?? null, played: played.length }).toEqual({ failedStep: null, played: lesson.steps.length });
  });

  it.each(LESSONS.map((l) => [l.id, l] as const))('lesson %s: every step text key exists in English and Vietnamese', (_id, lesson) => {
    const keys = [lesson.titleKey, lesson.summaryKey, ...lesson.steps.flatMap((s) => [s.textKey, ...(s.phone?.textKey ? [s.phone.textKey] : [])])];
    for (const key of keys) {
      expect({ key, english: key in en, vietnamese: key in vi }).toEqual({ key, english: true, vietnamese: true });
    }
  });

  it.each(LESSONS.map((l) => [l.id, l] as const))('lesson %s: every target is an anchor id the board can carry', (_id, lesson) => {
    const targets = lesson.steps.flatMap((s) => [s.target, s.phone?.target].flatMap((t) => (t === undefined ? [] : Array.isArray(t) ? t : [t])));
    for (const target of targets) expect({ target, anchor: isAnchorId(target) }).toEqual({ target, anchor: true });
  });

  it.each(LESSONS.map((l) => [l.id, l] as const))('lesson %s: has steps with unique ids and a seat count the engine accepts', (_id, lesson) => {
    const ids = lesson.steps.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(lesson.build(registry).seats).toHaveLength(lesson.seatCount);
  });
});
