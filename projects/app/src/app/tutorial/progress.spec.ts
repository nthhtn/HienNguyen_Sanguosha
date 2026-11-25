import { loadCompleted, saveCompleted } from './progress';

const KEY = 'tutorial.completed';

describe('lesson progress', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  it('remembers the saved lessons', () => {
    saveCompleted(new Set(['turn', 'damage']));
    expect(loadCompleted()).toEqual(new Set(['turn', 'damage']));
  });

  it('starts with no lessons done', () => {
    expect(loadCompleted()).toEqual(new Set());
  });

  it('shows no lessons done when storage throws (a private window)', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadCompleted()).toEqual(new Set());
  });

  it.each([['not json'], ['{"a":1}'], ['"turn"'], ['["turn", 7, null]']])('ignores junk in storage (%s)', (junk) => {
    localStorage.setItem(KEY, junk);
    const done = loadCompleted();
    expect([...done].every((id) => typeof id === 'string')).toBe(true);
    // Only a real lesson id counts, so junk can never mark a lesson done.
    expect(done).toEqual(junk === '["turn", 7, null]' ? new Set(['turn']) : new Set());
  });

  it('drops an unknown lesson id from storage', () => {
    localStorage.setItem(KEY, '["turn","free-play"]');
    expect(loadCompleted()).toEqual(new Set(['turn']));
  });

  it('does not throw when storage refuses the write', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => saveCompleted(new Set(['turn']))).not.toThrow();
  });
});
