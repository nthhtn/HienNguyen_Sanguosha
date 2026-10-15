// The languages the app offers, in the order their buttons appear. `flag` is a
// file under projects/app/public; `nativeName` is the button's label in its own
// language.
export const LOCALES = [
  { code: 'en', nativeName: 'English', flag: 'flags/gb.svg' },
  { code: 'vi', nativeName: 'Tiếng Việt', flag: 'flags/vn.svg' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const DEFAULT_LOCALE: LocaleCode = 'en';

export const isLocaleCode = (value: unknown): value is LocaleCode => LOCALES.some((l) => l.code === value);
