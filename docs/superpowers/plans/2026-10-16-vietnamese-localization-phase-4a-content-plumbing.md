# Vietnamese Localization, Phase 4a (Content Plumbing) — Record

Done directly, without a separate task list. Purpose: make General, skill and card names and rules text locale-aware, with Vietnamese files that fill in piece by piece and fall back to English per entry.

- `content/data/locales/vi/generals.json`: by General id, `{ name, title?, skills: { <skillId>: { name, text } } }`. Skill ids are `skillIdOf(English name)`.
- `content/data/locales/vi/cards.json`: by card id, `{ name, text? }`.
- `display.ts`: `generalDisplayData`, `cardDisplayData` and `abilityName` take an optional trailing locale; `generalTranslations` and `cardTranslations` are exported for the parity spec.
- App: every call passes `localeOf(tr)` (builders) or `this.i18n.locale()` (components). `judgmentReaderName` takes an optional `tr`.
- Specs: `names.vi.spec.ts` (no stray ids, numbers and placeholders kept, fallbacks) and a labels spec.
- Seed entries: Cao Cao and Sha, to prove the path. Phases 4b to 4g fill the rest (names, then texts by force).
