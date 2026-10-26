import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv();

// The app starts in Vietnamese, but the specs read English text: they start in English unless one sets the
// language itself. The real default is pinned in i18n/locales.spec.ts.
jest.mock('./projects/app/src/app/i18n/locales', () => ({
  ...jest.requireActual('./projects/app/src/app/i18n/locales'),
  DEFAULT_LOCALE: 'en',
}));
