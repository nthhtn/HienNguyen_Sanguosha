# Vietnamese Localization (Game Screen) — Design Spec

Status: Draft, awaiting review
Date: 2026-10-15

## Purpose

Make the Game screen playable in Vietnamese, with a language switcher that
allows more languages later. Everything on the Game screen is in scope: card
and General names and rules text, player interactions (dialogs, prompts,
responses), the Action History, the Discard Pile and the other board text.

## Hard constraint

**Localization is presentation only.** The engine, bots, protocol and server
packages and the content registry never see a locale. Ids, rules, state and
events are unchanged. The locale is never stored in game state and never
sent to the server. Changing language re-renders text and nothing else.

## Scope

In:
- Everything under `projects/app/src/app/game-board/`, plus `labels.ts`.
- The content lookups the Game screen uses (names, titles, skill names,
  skill text, card text).
- Because `online/online-game.ts` reuses the board components, the online
  game's board is translated too.
- A language switcher in the Navigation panel.

Out (a later version):
- Setup, Wiki and Rules pages, auth, rooms, lobby and my-games.
- Online-only chrome: in-game chat, `online/game-labels.ts`, the online
  result screen and notices.
- Pluralisation, and any locale beyond English and Vietnamese (the design
  allows them, but nothing is built for them).
- Anything server-side.

## Approach

A small in-house i18n layer in the presentation layer. Angular's built-in
`$localize` is rejected: it produces a build per language, so the language
cannot be switched in a running game. A library (Transloco, ngx-translate)
is rejected: it covers only the plumbing, and the hard parts are the
content lookup by id and the message templates, which we would write anyway.

## Architecture

| Piece | Where | Responsibility |
|---|---|---|
| `I18n` service | `app/src/app/i18n/` | Current locale as a signal, persisted in local storage, default English. `t(key, params)` and a `t` pipe. Lookup order: current locale, then English, then the key itself. |
| UI catalogs | `app/src/app/i18n/en.ts`, `vi.ts` | Typed key-to-template maps with `{param}` placeholders. `en` defines the key set. `vi` is lazy-loaded. |
| Content translations | `content/data/locales/vi/` | `generals.json` and `cards.json` keyed by existing ids: names, titles, skill names, skill text, card text. The English files and the registry are untouched. |
| Glossary | `content/data/locales/vi/glossary.json` | The agreed terms (below). Drafts are generated and checked against it. |
| Locale-aware display | `content/src/lib/display.ts` | `generalDisplayData(id, locale)`, `cardDisplayData(id, locale)`, `abilityName(...)` take a locale and fall back to English. It remains the only way the UI reaches content text. |
| Language switcher | Navigation panel | One button per locale, with a flag. |

### Language switcher

- One button per locale, in the Navigation panel. The active one has
  `aria-pressed="true"`.
- Each button has an `aria-label` and a tooltip in its own language
  ("English", "Tiếng Việt"). A flag alone is not an accessible label.
- Flags are small inline SVGs, not flag emoji: Windows does not render flag
  emoji, so those buttons would show letters instead.
- English uses the UK flag; Vietnamese uses the flag of Vietnam.
- The locales live in one list (`{ code, flag, nativeName }`). Adding a
  language means adding an entry and a catalog, with no template changes.

### Structured lines

Today `action-history.ts`, `response-description.ts`,
`choice-description.ts` and `ability-description.ts` return English prose,
and `action-history.ts` also compares and edits that prose (for example
`shows.text === 'Doubt'`, `last.text.startsWith(...)`, and appending
`', Counts as Shan'` to an existing line). Translated sentences cannot be
compared or appended to, so these builders return `{ key, params }`, where
params are ids, numbers and already-structured pieces. Logic that checks or
extends a line works on the key and params. Text is produced by `t()` at the
render edge. English output stays byte-identical, and the existing specs for
these files are the safety net. `labels.ts` is converted the same way, and
its fallback names ("Seat 0", "Hidden Card", "Hidden General") become
templates.

Sentences that English builds from pieces become whole-sentence templates,
because Vietnamese word order differs.

## Terminology

Decided by the user (2026-10-15):

| English | Vietnamese |
|---|---|
| General, Main General, Deputy General | Tướng, Tướng chính, Tướng phụ |
| HP | Sinh lực |
| Tool (card type) | Cẩm nang |
| Judgment | Phán xét |
| Seat | Người chơi (so "Seat 0" is "Người chơi 0") |
| Phases | Giai đoạn bắt đầu, phán xét, rút bài, ra bài, bỏ bài, kết thúc |
| Core cards | Hán-Việt: Sát (Sha), Thiểm (Shan), Đào (Peach), Quyết Đấu (Duel) |
| General and skill names | Sino-Vietnamese, from `nameZh` |

Defaults proposed and accepted:
- Forces: Ngụy, Thục, Ngô, Quần. Hidden: Ẩn.
- Card types: Cơ bản (Basic), Cẩm nang (Tool), Trang bị (Equipment).
  Subtypes: Vũ khí (Weapon), Giáp (Armor), Ngựa (Mount).
- Hand, Discard Pile, Draw Pile: Bài trên tay, Chồng bài bỏ, Chồng bài rút.
- Dying: Cận kề cái chết. Reveal and Face Down: Lật tướng, Úp.
- Lord: Chủ công.
- Suits keep their symbols. Colours: đỏ, đen.

Remaining terms are added to `glossary.json` as the drafts are written, and
ambiguous ones are listed for the user.

### Writing style

Vietnamese does not use Title Case. Labels, buttons and sentences are sentence
case ("Kết thúc giai đoạn"). Proper nouns stay capitalised: player names,
General names, forces and card names (Sát, Đào). The per-locale rule is added
to the "UI text style" section of `CLAUDE.md`, so the two languages do not
contradict it. Ids are never shown raw, in either language.

## Content pipeline

1. **Glossary:** hand-approved, the single reference for everything below.
2. **UI catalog (`vi`):** written directly, about 200 strings, and checked in
   the running Game screen for overflow (Vietnamese runs longer than English).
3. **General and card names:** drafted from `nameZh` plus the glossary.
   Ambiguous readings are listed for the user to settle.
4. **Skill and card rules text:** drafted in batches by force from the
   English text, the Chinese text where it exists, and the glossary.
5. **Validation script (run in CI):** numbers and `{placeholders}` match the
   source; every glossary term in the English appears in its mapped
   Vietnamese form; no entry is empty or untranslated English.
6. **Review:** each entry has a `draft` or `reviewed` status. The user is the
   Vietnamese reviewer. Draft entries display normally and nothing is blocked
   on review; a script reports how many remain.

## Testing

- All existing app specs pass unchanged against English (action history,
  labels, response descriptions, the board). The structured-line refactor is
  correct only if they do.
- Catalog parity: `vi` has exactly the keys of `en`, with the same
  placeholders on each key.
- Content parity: every General, skill and card id has a Vietnamese entry or
  is on an explicit "not yet translated" list.
- Draft validation, as above.
- Locale-switch specs: render the main Game screen components in `vi` and
  assert the Vietnamese text. Switching locale mid-game leaves game state
  untouched.
- Fallback spec: a missing key or entry shows the English text.
- Real-app check: play a bot game in Vietnamese and look for overflow in the
  seat tiles, phase indicator, dialogs and history.
- Engine, bots, sim and server specs are unchanged because those packages are
  not touched.

## Phases

Each phase is mergeable on its own. The app behaves as before until phase 5.

1. **Plumbing:** `I18n` service, `en` catalog skeleton, flag buttons in the
   Navigation panel, locale persistence, parity test harness. Only English
   exists, so the only visible change is the buttons.
2. **Structured lines:** convert the history builder, the response, choice
   and ability descriptions, and `labels.ts` to keys plus params. English
   output is byte-identical.
3. **Templates:** replace hard-coded text in the Game screen components with
   `t()`.
4. **Content:** glossary, locale-aware `display.ts`, Vietnamese names, then
   rules text in batches by force, each batch validated.
5. **Vietnamese UI catalog:** `vi` strings, the visual check, the
   unreviewed-entries report, and the Vietnamese style rule in `CLAUDE.md`.

## Risks

- Phase 2 is the riskiest: the history builder carries logic as well as text,
  and that logic has to move onto ids and keys without changing behaviour.
- Rules-text quality depends on the user's review. Until reviewed it is only
  a draft.
- "Người chơi" for Seat reads like a player's own name in places ("Người chơi
  0" is a seat, not a person). The templates must keep the seat and the
  player's name visibly distinct.
