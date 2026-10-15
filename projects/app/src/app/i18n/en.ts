// The English catalog is the source of truth for the key set: every other
// catalog must have exactly these keys (checked by the compiler and by
// catalogs.spec.ts). Messages use {name} placeholders.
export const en = {
  'nav.language': 'Language',
} satisfies Record<string, string>;
