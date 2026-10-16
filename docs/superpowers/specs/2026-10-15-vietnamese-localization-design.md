# Vietnamese Localization (Game Screen) — Design Spec

Status: Approved; phases 1 to 5 built; the Vietnamese text is draft until reviewed
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
- Nothing is left out any more. (Setup and the Wiki Cards pages were added in Phase 6; auth, rooms, lobby, my-games, chat and the error banner in Phase 7; the Wiki Rules pages in Phase 8.)
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

### Translator-based builders

Amended 2026-10-15 (user decision), replacing the earlier "builders return
`{ key, params }`" design.

Today `action-history.ts`, `response-description.ts`,
`choice-description.ts`, `ability-description.ts` and `labels.ts` build
English prose inline, and `action-history.ts` also compares and edits that
prose (`last.text.startsWith(...)`, appending `', Counts as Shan'` to an
existing line). The builders keep returning text, but build it through a
translator passed in as a parameter:

- `Translator` is `(key: MessageKey, params?: MessageParams) => string`.
  `I18n.t` is one; the default is an English translator, so callers and
  specs that pass nothing get exactly today's English.
- Names inside a sentence (a seat, a card, an ability, a General) come from
  locale-aware lookups and are passed to the template as params. Sentences
  that English builds from pieces become whole-sentence templates, because
  Vietnamese word order differs.
- Logic that checked or extended a finished sentence works on ids and
  flags instead (for example a `countsAsShan` mark on the judgment line, or
  the event's own data), never on the text.
- Text such as `'Doubt'` that arrives from the engine inside an event
  (`shows.text`) is matched on exactly as today. Showing it translated is a
  separate decision for the phase that translates the content.
- The history and the descriptions are already computed from signals, so
  reading the locale signal inside `t` makes them recompute when the
  language changes. No line needs to be stored as a key.

English output stays byte-identical, and the existing specs for these files
are the safety net: they keep passing without edits. Vietnamese is covered by
new specs that pass the Vietnamese translator.

## Terminology

Decided by the user (2026-10-15):

| English | Vietnamese |
|---|---|
| General, Main General, Deputy General | Tướng, Chủ tướng, Phó tướng |
| HP | Sinh lực |
| Tool (card type) | Cẩm nang |
| Judgment | Phán xét |
| Seat | Người chơi (so "Seat 0" is "Người chơi 0") |
| Phases | Giai đoạn bắt đầu, phán xét, rút bài, ra bài, bỏ bài, kết thúc |
| Core cards | Hán-Việt: Sát (Sha), Thiểm (Shan), Đào (Peach), Quyết Đấu (Duel) |
| Discard (button), Use as, Reveal and Use (button) | Bỏ bài, dùng làm, Lật Tướng và dùng |
| General and skill names | Sino-Vietnamese, from `nameZh` |

Defaults proposed and accepted:
- Forces: Ngụy, Thục, Ngô, Quần. Hidden: Ẩn.
- Card types: Cơ bản (Basic), Cẩm nang (Tool), Trang bị (Equipment).
  Subtypes: Vũ khí (Weapon), Giáp (Armor), Ngựa (Mount).
- Hand, Discard Pile, Draw Pile: Bài trên tay, Chồng bài bỏ, Chồng bài rút.
- Dying: Cận kề cái chết. Reveal and Face Down: Lật Tướng, Úp.
- Farm (Deng Ai's judged-card status): Điền (user decision, 2026-10-16).
- Compete (a skill's point contest): đấu điểm (user decision, 2026-10-16); the two faces are joined with "so với".
- Wording decisions of 2026-10-16: counts as = tính là; Defensive Mount = Tọa kỵ thủ +1; Offensive Mount = Tọa kỵ công -1; the pile under a General (Refusing Death) = Lá bài Sang; silenced seat = Mất kỹ năng; Combined HP = Tổng Sinh lực; draw pile positions = Đầu chồng / Đáy chồng; playing a card = đánh (the phase stays "giai đoạn ra bài"); respond = phản hồi; turn over = lật mặt; Main General = Chủ tướng and Deputy General = Phó tướng everywhere (chips, sentences, buttons).
- Names (phase 4b, draft pending review): General, skill and card names are Hán-Việt from the Chinese. General names and card names are capitalised word by word (Tào Tháo, Quyết Đấu, Nam Man Xâm Nhập); titles and skill names are sentence case (Ngụy Võ Đế, Gian hùng). A skill name avoids the UI terms (Feedback is Phản quỹ, not Phản hồi).
- Lord: Chủ công.
- Suits keep their symbols. Colours: đỏ, đen.

Remaining terms are added to `glossary.json` as the drafts are written, and
ambiguous ones are listed for the user.

### Writing style

Vietnamese does not use Title Case. Labels, buttons and sentences are sentence
case ("Kết thúc giai đoạn"). Proper nouns stay capitalised: player names,
General names, forces and card names (Sát, Đào). The keywords Tướng (General) and
Sinh lực (HP) keep their capitals inside sentences too (user decision, 2026-10-16),
so "hồi 1 Sinh lực", "úp Tướng", "Lật Tướng và dùng". The per-locale rule is added
to the "UI text style" section of `CLAUDE.md`, so the two languages do not
contradict it. Ids are never shown raw, in either language.

## Content pipeline

1. **Glossary:** hand-approved, the single reference for everything below.
2. **UI catalog (`vi`):** written directly, roughly 300 to 400 strings, and checked in
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
2. **Translator-based builders:** done in four mergeable steps, each with
   English output byte-identical and the existing specs unchanged:
   2a the `Translator` type and the choice, ask, selection and arrange
   descriptions; 2b the Action History; 2c the response description; 2d the
   ability hints and other prose tables in `content/src/lib/display.ts`;
   2e `labels.ts` (seat, card and General fallback names, suit labels,
   action labels), last because another workstream has uncommitted edits to it.
3. **Templates:** replace hard-coded text in the Game screen components with
   `t()`.
4. **Content:** glossary, locale-aware `display.ts`, Vietnamese names, then
   rules text in batches by force, each batch validated.
5. **Vietnamese UI catalog:** `vi` strings, the visual check, the
   unreviewed-entries report, and the Vietnamese style rule in `CLAUDE.md`.

## Phase 5 notes

- Review status: `projects/content/data/locales/vi/review.json` lists the reviewed entries (UI keys, General ids, card ids, prose ids by table); anything not listed is a draft. `npm run i18n:status` prints the counts (`-- --list` names the drafts) and fails on an id that no longer exists.
- `projects/content/data/locales/vi/glossary.json` holds the checked terms: a spec requires each term that an English skill or card text uses to appear in its agreed form in the Vietnamese text.
- Visual check (headless Chrome against `ng serve`, Vietnamese, a bot game): the toolbar, General selection, the board, the hand, the Instigate dialog and the history panel showed no overflow. It found one bug, fixed: the mode's default seat name "Seat N" was shown untranslated, so `seatName` now treats it as a placeholder.
- Left for later: nothing; the Wiki Rules pages followed in Phase 8.

## Phase 6 notes

- Setup and the four Wiki Cards pages (Generals, Basic, Equipment, Tools) read in Vietnamese. Their strings are `setup.*` and `wiki.*` keys; card and General names, titles and rules text come from the content translations.
- The content library's Wiki tab labels stay English. `wiki/wiki-labels.ts` translates them by tab key (a tab named after a card takes the card's name) and falls back to the English label.
- Card ordering on the Wiki is still by English name, so both languages list in the same order.
- Pack names (Base, EX, Army, Wind, Fire, Forest, Mountain) read Cơ bản, EX, Quân tranh, Phong, Hỏa, Lâm, Sơn: draft, like the rest.
- Not visually checked in a browser (the headless-Chrome script was gone from the scratchpad); the component specs cover the text.

## Phase 7 notes

- Auth (sign in, create account, guest, forgot and reset password), Rooms and its three dialogs, the Lobby, chat (panel and board drawer), the online result, My Games and the game board's error banner read in Vietnamese.
- The server and the protocol are unchanged. A server error is shown by its stable `ErrorCode` through `error.<code>` keys, with the limits as params; a code the app has no key for shows the server's own text. Room-left reasons and game-stopped outcomes are keyed the same way (`roomLeft.*`, `outcome.*`, `room.replaced`).
- Services no longer store finished English strings. `error`, `ended`, `notice`, `waitingForHost`, `lastError` and `OnlineNotice` hold a `Msg` (`i18n/msg.ts`: a catalog key with params, or raw text), and templates show it with the `tm` pipe, so a banner follows a language switch. `GameService.lastError` is a `Msg` too.
- Local game errors (option A): the engine's error text is developer English and the engine never sees a locale, so the banner shows `error.internal` in the player's language and keeps the engine's text as a "Details: …" line. In English this adds the generic line above the old text.
- The forgot-password confirmation is the screen's own `auth.resetSent`, not the server's message (same English).
- Label builders in `online/game-labels.ts` and `room-labels.ts` take the translator; `gameWhen` formats the date in the language's locale (`vi`), English keeps the browser's format.
- Names people type (display names, chat) and the server's bot names ("Bot 1") are not translated.

## Phase 8 notes

- The six Wiki Rules pages (Overview, Card Types, Setup, Turn Structure, Distance / Range, Judgment) read in Vietnamese. Their layout stays in the components; every sentence is a `rules.<page>.*` key in `en.ts` and `vi.ts`. Page titles reuse `nav.rules.*`, phase headings reuse `phase.indicator` and `history.phase.*`.
- A sentence can hold three tokens, shown by `wiki/rules/rich-text.ts`: `[[/wiki/rules/setup|Setup]]` (a router link whose label is in the sentence's language), `{card:sha}` (the card's name in the current language, from the content translations) and `{force:Wei}` (a Force name). Card and Force names therefore always match the Game screen and the glossary.
- Specs: every `rules.*` key carries the same links, cards and Forces in both languages; a link's label equals the page's navigation label in each language; every card named exists and has a Vietnamese name; no English card name or term is left on a rendered Vietnamese page. The English text and links of all six pages were compared with the old templates before the change (identical).
- Wording notes: a seat is "người chơi" in prose (lowercase), Force is "thế lực", Mount is "Tọa kỵ" (Plus Mount "Tọa kỵ thủ", Minus Mount "Tọa kỵ công"), the judgment area is "khu phán xét", the draw pile "chồng bài rút", the discard pile "chồng bài bỏ". All draft.

## Risks

- Phase 2 is the riskiest: the history builder carries logic as well as text,
  and that logic has to move onto ids and flags without changing behaviour.
- The amount of text is larger than first estimated: the builders alone hold
  about 160 sentence templates (87 in the history, 40 in the response
  description) and `display.ts` has 54 ability hints. Plan for roughly 300 to
  400 templates in all, not 200, which makes phase 5 the biggest writing job.
- Rules-text quality depends on the user's review. Until reviewed it is only
  a draft.
- "Người chơi" for Seat reads like a player's own name in places ("Người chơi
  0" is a seat, not a person). The templates must keep the seat and the
  player's name visibly distinct.
