// The real module: the app's specs start in English through a mock in jest.setup.app.ts.
const { DEFAULT_LOCALE, LOCALES, SOURCE_LOCALE } = jest.requireActual<typeof import('./locales')>('./locales');

describe('locales', () => {
  it('starts in Vietnamese, the first language in the menu', () => {
    expect(DEFAULT_LOCALE).toBe('vi');
    expect(LOCALES.map((l) => l.code)).toEqual(['vi', 'en']);
  });

  it('keeps English as the source language, which the Wiki data and fallbacks use', () => {
    expect(SOURCE_LOCALE).toBe('en');
  });
});
