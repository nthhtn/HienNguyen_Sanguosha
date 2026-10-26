// The languages the app offers, in the order their buttons appear. `flag` is a
// file under projects/app/public; `nativeName` is the button's label in its own
// language.
export const LOCALES = [
  { code: 'vi', nativeName: 'Tiếng Việt', flag: 'flags/vn.svg' },
  { code: 'en', nativeName: 'English', flag: 'flags/gb.svg' },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

// The language of the source text: the English catalog and the English card and General data. It is
// always loaded, and what a missing translation falls back to.
export const SOURCE_LOCALE: LocaleCode = 'en';

// The language a visitor with no saved choice starts in.
export const DEFAULT_LOCALE: LocaleCode = 'vi';

export const isLocaleCode = (value: unknown): value is LocaleCode => LOCALES.some((l) => l.code === value);
