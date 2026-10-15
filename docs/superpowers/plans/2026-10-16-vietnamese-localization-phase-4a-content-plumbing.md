# Vietnamese Localization, Phase 4a (Content Plumbing) — Record

Done directly, without a separate task list. Purpose: make General, skill and card names and rules text locale-aware, with Vietnamese files that fill in piece by piece and fall back to English per entry.

- `content/data/locales/vi/generals.json`: by General id, `{ name, title?, skills: { <skillId>: { name, text } } }`. Skill ids are `skillIdOf(English name)`.
- `content/data/locales/vi/cards.json`: by card id, `{ name, text? }`.
- `display.ts`: `generalDisplayData`, `cardDisplayData` and `abilityName` take an optional trailing locale; `generalTranslations` and `cardTranslations` are exported for the parity spec.
- App: every call passes `localeOf(tr)` (builders) or `this.i18n.locale()` (components). `judgmentReaderName` takes an optional `tr`.
- Specs: `names.vi.spec.ts` (no stray ids, numbers and placeholders kept, fallbacks) and a labels spec.
- Seed entries: Cao Cao and Sha, to prove the path. Phases 4b to 4g fill the rest (names, then texts by force).

## Later steps of phase 4 (same branch)

- 4b: Hán-Việt names for all 57 Generals, their titles, every skill and all 43 cards.
- 4c: rules text for every skill and every card that has English text. Digits must match the English (the specs enforce it), so numbers are written as words as in the English.
- 4d: the engine's fixed label options (Doubt, Believe, Lose 1 HP, the Brave Spirit and Collapse picks and so on) and Zuo Ci's Form pick read in Vietnamese. The engine still sends English text; the app looks the label up by option id and only replaces it when the English template reproduces the engine's text, so an unknown label shows as before.
- All Vietnamese content is draft pending the user's review.
