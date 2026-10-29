---
name: add-general
description: Use when asked to add, port or import a General to a deck, to add a variant skill to an existing General, or when handed a General's stats or a source page to copy from.
---

# Add a General

A General is developer-owned facts (stats, wording, art, voice) plus rules the developer has agreed. Nothing goes into the repo until the developer has confirmed it, including values that came from a source.

**Violating the letter of these gates is violating their spirit.**

## Steps

1. **Find counterparts.** Before anything else, search both decks (Identity `data/generals/`, Kingdom Wars `data/decks/kingdom-wars/generals.json`) by id, English name and Chinese name, and report which exist. Then ask which deck or decks the developer wants this change in:
   - in neither deck: a new General in the chosen deck.
   - in one deck only: adding the other deck's side. Read how the existing records tie together (Kingdom Wars `hpFrom`, `CLEARED_WORDING`, shared skin and voice) before deciding what to add.
   - in both: this is a change to a skill or a variant, not a new General.
   Put the findings and the developer's choice in the sheet's counterpart row, and do not touch the other deck unless the developer chose it.
2. **Fill the input sheet.** Copy [input-sheet.md](input-sheet.md) into the reply and fill it. Every row has a value and an origin: `dev`, a source URL, or `empty`. The developer types values or names a source to import from. Show the filled sheet back and wait for a reply confirming it. A missing value stays `empty` and becomes a question.
3. **Ask.** Start with a real question about whatever is unclear. Never offer to skip the questions.
4. **Write the rules.** One block per skill in the format of `docs/superpowers/specs/2026-10-23-alternate-generals-slice-3-rules.md`, with the edge cases in [input-sheet.md](input-sheet.md) answered inside it. Wait for "Correct" before any code. Save the confirmed batch in `docs/superpowers/specs/`, dated.
5. **Build** from the "Adding a General" section of `docs/architecture/content-and-extensibility.md`. Compare against `git show --stat` of the latest General commit, since file layout drifts. Paths are under `projects/content/`; the two decks differ, so first say which one:
   - **Identity:** data `data/generals/<force>/<id>.json`, imported in `data/generals/index.ts`; skills in the pack file `src/lib/generals/<pack>.ts` (`wei`, `shu`, `wu`, `qun`, `wind`, `fire`, `forest`, `mountain`) as a `{ id, skills }` entry; the id in that pack's id list in `generals/index.ts`; Vietnamese in `data/locales/vi/generals.json`; a simulator spec so a seeded game fires the skill.
   - **Kingdom Wars:** a record in `data/decks/kingdom-wars/generals.json`, whose HP and gender come from the Identity General with the same id (`hpFrom: identity`). Only a General with no Identity counterpart gets hand-entered force, HP and gender in `generals-manual.json` beside it. A skill with Identity's wording needs only its Chinese name added to `CLEARED_WORDING` in `src/lib/kingdomWarsSkills.ts`. A skill with different rules is a variant in `src/lib/generals/kingdom-wars-<force>.ts`. Vietnamese goes in `data/locales/vi/kingdom-wars-generals.json`. If the General is not among the crawled records, ask how its record gets made (the crawl scripts were removed).
   - **Both:** a spec for the skill; an engine hook only if the rules need one; bots in `projects/bots/src/lib/skills.ts` with a spec; display text in `src/lib/display.ts`; new Vietnamese prose in `prose.json`; each value's origin in the file's `source`.
   - **Skin:** `assets/generals/skins/<force>/<pinyin>.png`, an entry in `skins/skins.json` keyed by the base id, and a record in `assets/manifest.json`. With no image add none of the three: the placeholder shows, and the PR lists the gap.
   - **Death voice:** `assets/audio/death/<pinyin>.ogg`. With none, add the id to `NO_DEATH_VOICE` in `src/lib/assets.ts`; the seat then plays its Kingdom's cry.
   - **Skin and voice are shared.** Both look up the base id, so a Kingdom Wars General with an Identity counterpart already has them. Only a General without one needs its own.
6. **Verify.** Run `npm run verify`, the tests, and `npm run i18n:status`. Say plainly what failed or was skipped.
7. **Hand over.** One commit per General, `feat(content): Kingdom Wars <Name>`, then a PR listing every `empty` item and every draft. Never push to `main` and never merge. After a stage merges, ask before deleting its branch.

## Rationalizations

| Thought | Reality |
|---|---|
| "The developer said to trust the source" | An import is a draft. Show the sheet and get the confirmation; it is one message. |
| "They're in a hurry and the rules are fine" | Write the rules anyway and wait for "Correct". Rule edge cases caused the earlier `fix(content)` commits. |
| "HP or gender is obvious" | Never fill a value nobody gave you. It stays `empty`. |
| "The placeholder is fine, no need to mention it" | List every missing skin, voice and draft in the PR. |
| "I'll write the rules while coding" | Rules first. |
| "They only named one deck, so I'll skip the other" | Check both and report. Leaving the other deck alone is the developer's decision, not yours. |
