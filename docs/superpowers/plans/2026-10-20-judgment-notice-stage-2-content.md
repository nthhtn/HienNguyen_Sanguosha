# Judgment Notice, Stage 2: Consequence Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For a settled judgment, content can say in one sentence, in English or Vietnamese, what the final card will actually do, for every card and General skill that judges.

**Architecture:** Each judging reader's decision (which suit, who is alive, how many cards) moves into one small exported function that both its `onJudged` and a new `judgmentOutcome()` call, so the text cannot disagree with the rule. Text is looked up by reader id and an outcome key, like `competeOutcomeText`: an English table in `display.ts`, Vietnamese in `prose.json`, a parity spec. Nothing here touches the engine or the app.

**Tech Stack:** TypeScript, Jest (`projects/content`).

**Spec:** `docs/superpowers/specs/2026-10-20-judgment-popup-design.md` ("Content: consequence text"). Stage 1 (engine, `JudgmentView`) is built; stage 3 (bots, server) and stage 4 (the popup) are separate plans.

## Global Constraints

- Content stays free of UI and Angular code (CLAUDE.md layering). The app (stage 4) turns seat ids into names and calls `judgmentOutcomeText`.
- The text says what **will actually happen** in the current state (dead damage source, short hand, suit as skills count it), by calling the same decision functions as the reader's `onJudged`.
- Adding a judging reader later without outcome text must fail a test (Task 4).
- Vietnamese is draft (no entry in `review.json`); it must pass the glossary and parity specs (use Thiểm, Quyết Đấu, phán xét, bỏ, Sinh lực, lật mặt as in `glossary.json`).
- UI casing rules in CLAUDE.md: English outcome sentences are sentence case with card, General and seat names capitalised; Vietnamese sentence case.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Branch: `feat/judgment-notice-text` off `feat/judgment-notice-engine`.

## Review Focus

- A damage source that died, or has fewer than 2 cards, between the damage and the judgment: the text and the rule both change (Unyielding, Lament) (Tasks 2, 3).
- The suit as skills count it, not the printed suit (`suitOf`/`colourFor` with the seat), for every reader (Tasks 2, 3).
- Lightning with no seat to move to stays put, and its text says so (Task 2).
- An id such as `'constructor'` or `'__proto__'`, or an unknown key, returns null, never an inherited value (Task 1).
- Eight Trigrams (card) and Eight Arrays (skill) give the same keys for the same card (Tasks 2, 3).
- A reader added later with no text fails the coverage spec (Task 4).

## File Structure

- Create `projects/content/src/lib/judgmentOutcome.ts` (+ `judgmentOutcome.spec.ts`): `judgmentReaderId`, `judgmentOutcome`, and the dispatch table.
- Modify `projects/content/src/lib/display.ts`: `JUDGMENT_OUTCOMES`, `judgmentOutcomeText`, `ENGLISH_PROSE.judgmentOutcomes`, the `Prose` interface.
- Modify `projects/content/data/locales/vi/prose.json`: `judgmentOutcomes`.
- Modify `projects/content/src/lib/prose.vi.spec.ts`: parity and text specs.
- Modify the reader files (decision functions only, no behavior change): `cards/lightning.ts`, `shared/delayed.ts`, `cards/equipment/eight-trigrams.ts`, `generals/wei.ts`, `shu.ts`, `wind.ts`, `fire.ts`, `mountain.ts`.
- Modify `projects/content/src/public-api.ts`: export the new API.

---

### Task 1: The text tables

**Files:**
- Modify: `display.ts`, `data/locales/vi/prose.json`
- Test: `prose.vi.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface JudgmentOutcomeNames { seat: string; owner: string; source: string }
  export function judgmentOutcomeText(readerId: string, key: string, names: JudgmentOutcomeNames, locale?: string): string | null
  ```
  Looks up the locale's `judgmentOutcomes[readerId][key]` then the English table, both with the own-property guard `lookup` already used by `competeOutcomeText`; replaces every `{seat}`, `{owner}`, `{source}`; null when readerId or key is unknown.
- English table (`JUDGMENT_OUTCOMES: Record<string, Record<string, string>>`), exactly:

| readerId | key: text |
|---|---|
| `lightning` | `struck`: "{seat} takes 3 thunder damage" · `moves`: "Lightning moves to the next seat" · `stays`: "Lightning stays where it is" |
| `capture` | `skip`: "{seat} skips the Play Phase" · `spared`: "Nothing happens" |
| `starvation` | `skip`: "{seat} skips the Draw Phase" · `spared`: "Nothing happens" |
| `eight-trigrams`, `eight-arrays` | `shan`: "{seat} counts as having played a Shan" · `none`: "Nothing happens" |
| `unyielding` | `discard-or-damage`: "{source} discards 2 cards or takes 1 damage" · `damage`: "{source} takes 1 damage" · `spared`: "Nothing happens" |
| `river-goddess` | `again`: "{owner} takes the card and judges again" · `ends`: "The card is discarded and the judging ends" |
| `iron-cavalry` | `unblockable`: "The Slash cannot be dodged" · `none`: "Nothing happens" |
| `lightning-strike` | `damage`: "{seat} takes 2 thunder damage" · `none`: "Nothing happens" |
| `dueling-heroes` | `red`: "{owner} takes the card and may play black hand cards as Duel this turn" · `black`: "{owner} takes the card and may play red hand cards as Duel this turn" |
| `military-farm` | `farm`: "{owner} stashes the card as a Farm" · `discard`: "The card is discarded" |
| `lament` | `heal`: "{seat} heals 1 HP" · `draw`: "{seat} draws 2 cards" · `discard2`: "{source} discards 2 cards" · `discard1`: "{source} discards 1 card" · `face-down`: "{source} turns face down" · `face-up`: "{source} turns face up" · `none`: "Nothing happens" |

- Vietnamese (`prose.json` → `judgmentOutcomes`, same ids and keys): write drafts in the style of the existing `competeOutcomes` entries and `glossary.json` (e.g. "{seat} chịu 3 sát thương sét", "{seat} bỏ qua giai đoạn ra bài", "Không có gì xảy ra", "{owner} nhận lá bài và có thể đánh bài trên tay màu đen làm Quyết Đấu trong lượt này"); `{source}` etc. keep their placeholders.

- [ ] **Step 1: Write failing tests** in `prose.vi.spec.ts`:
  - `'judgment outcomes replace every placeholder, in both languages'`: `judgmentOutcomeText('lightning','struck',{seat:'Hing',owner:'Hing',source:'-'})` is `'Hing takes 3 thunder damage'`; `judgmentOutcomeText('lament','discard1',{seat:'A',owner:'B',source:'Seat 1'})` is `'Seat 1 discards 1 card'`; the same two in `'vi'` contain the substituted names and no `{`.
  - `'judgment outcomes: ids and keys that are not entries give null'`: `('constructor','x')`, `('lightning','__proto__')`, `('nope','struck')`, `('lightning','nope')` are null in `'en'` and `'vi'`.
  - Parity: every readerId and key of `ENGLISH_PROSE.judgmentOutcomes` exists in `viProse.judgmentOutcomes` and the reverse, and each Vietnamese string has the same placeholder set as its English one (follow the existing parity tests in this file).
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/prose.vi.spec.ts` — Expected: FAIL (`judgmentOutcomeText` not defined).
- [ ] **Step 3: Implement** `judgmentOutcomeText`, the English table, `ENGLISH_PROSE.judgmentOutcomes`, the `Prose` field and the Vietnamese JSON.
- [ ] **Step 4: Run** `npx jest projects/content` — Expected: PASS, including the glossary spec (fix Vietnamese wording until it passes).
- [ ] **Step 5: Commit** `feat(content): consequence text for judgments, English and Vietnamese (draft)`.

### Task 2: Card readers

**Files:**
- Create: `judgmentOutcome.ts`, `judgmentOutcome.spec.ts`
- Modify: `cards/lightning.ts`, `shared/delayed.ts`, `cards/equipment/eight-trigrams.ts`

**Interfaces:**
- Consumes: `JudgmentView`, `JudgmentReader`, `GameState`, `ContentRegistry` from `engine`; `suitOf`, `colourFor`.
- Produces (in `judgmentOutcome.ts`):
  ```ts
  export interface JudgmentOutcome {
    readerId: string;                 // card: reader.card.as; skill: reader.owner.skillId
    key: string;                      // a key of JUDGMENT_OUTCOMES[readerId]
    seats: { seat: string; owner: string; source: string | null };  // seat ids: judged, owner, damage source
  }
  export function judgmentReaderId(reader: JudgmentReader): string;
  export function judgmentOutcome(state: GameState, view: JudgmentView, registry: ContentRegistry): JudgmentOutcome | null; // null: reader has no entry
  ```
  A private table `Record<string, (state, view, registry) => { key: string; source?: string | null }>` maps reader ids to decision callbacks; for a card reader `owner` is the judged seat; for a skill reader `owner` is `reader.owner.seatId`.
- Each reader file exports its decision function, and its `onJudged` calls it: `lightningOutcome(state, seatId, judged, registry): 'struck' | 'moves' | 'stays'` (struck: `suitOf` is spade and rank 2–9; else moves when the next living seat holding no Lightning exists, using the helper extracted from `onCleanup`, else stays); `skipPhaseOutcome(state, seatId, judged, spares, registry): 'skip' | 'spared'` (Capture spares heart, Starvation spares club); `eightTrigramsOutcome(state, owner: AbilityOwner, judged, registry): 'shan' | 'none'` (`colourFor` red → shan).

- [ ] **Step 1: Write failing tests** in `judgmentOutcome.spec.ts`, one `describe` per reader, each a table over every suit (`spade`, `heart`, `club`, `diamond`) and, for Lightning, ranks 1, 2, 9, 10 of spade. Each row builds a state with the reader's own fixture style (reuse the helpers in the reader's existing spec, e.g. `cards/lightning.spec.ts`), a `JudgmentView` for it (`settled: true`), and asserts both: `judgmentOutcome(...)` equals `{ readerId, key, seats }`, and the effects the card's real `onJudged` returns match the key (`'struck'` ⇒ a thunder `DamageEffect` of 3 on the seat; `'skip'` ⇒ `SetTurnFlagEffect` with `skipFlagOf('Play')`/`'Draw'`; `'shan'` ⇒ an `AbilityUsedEffect` with outcome `counts-as-shan`). Extra rows: Lightning with every other living seat already holding a Lightning, or no other seat (`'stays'`); a seat whose cards count as another suit via a skill modifier gives the key for the counted suit; Eight Trigrams as a card and as `eight-arrays` give equal keys for the same card.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/judgmentOutcome.spec.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Extract the three decision functions** and make `onJudged`/`onCleanup` call them (no behavior change: run the reader's existing spec after each extraction); then implement `judgmentReaderId`, the table entries for `lightning`, `capture`, `starvation`, `eight-trigrams`, and `judgmentOutcome`.
- [ ] **Step 4: Run** `npx jest projects/content` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(content): outcome of a card's judgment, shared with its reader`.

### Task 3: Skill readers

**Files:**
- Modify: `judgmentOutcome.ts`, `judgmentOutcome.spec.ts`, `generals/wei.ts`, `shu.ts`, `wind.ts`, `fire.ts`, `mountain.ts`

**Interfaces:**
- Consumes: Task 2's table and `JudgmentOutcome`.
- Produces: table entries for `eight-arrays` (reuses `eightTrigramsOutcome`), `unyielding`, `river-goddess`, `iron-cavalry`, `lightning-strike`, `dueling-heroes`, `military-farm`, `lament`; each reader file exports its decision function and its `onJudged` calls it:
  - `unyieldingOutcome(state, owner: GeneralOwner, judged, sourceSeatId, registry): 'spared' | 'discard-or-damage' | 'damage'` (heart or source not living ⇒ spared; source hand under 2 ⇒ damage; else discard-or-damage); `source` = `view.data.sourceSeatId`.
  - `riverGoddessOutcome(state, owner, judged, registry): 'again' | 'ends'` (red, or owner not living ⇒ ends).
  - `ironCavalryOutcome(state, owner, judged, registry): 'unblockable' | 'none'` (red ⇒ unblockable).
  - `lightningStrikeOutcome(state, seatId, judged, registry): 'damage' | 'none'` (spade and the judged seat living ⇒ damage); judged seat is `view.seatId`, owner is the skill's seat.
  - `duelingHeroesOutcome(state, owner, judged, registry): 'red' | 'black'` (the judged card's colour, as `onJudged` uses it).
  - `militaryFarmOutcome(state, owner, judged, registry): 'farm' | 'discard'` (owner not living or heart ⇒ discard).
  - `lamentOutcome(state, victimSeatId, sourceSeatId | undefined, judged, registry): 'heal' | 'draw' | 'discard2' | 'discard1' | 'face-down' | 'face-up' | 'none'` (heart ⇒ heal, diamond ⇒ draw; no living source ⇒ none; club ⇒ discard2 / discard1 by the source's owned-card count, none at 0; spade ⇒ face-up when the source is face down, else face-down); judged seat = `data.victim`, source = `data.source`.

- [ ] **Step 1: Write failing tests**, one `describe` per reader as in Task 2, over every suit, asserting the key and that the real `onJudged` effects agree (`'discard-or-damage'`/`'damage'` ⇒ a `skillStep` `outcome` effect; `'again'` ⇒ a move to hand plus another `JudgeEffect`-asking effect; `'unblockable'` ⇒ the step with `unblockable: true`; `'damage'` ⇒ thunder `DamageEffect` of 2; `'red'`/`'black'` ⇒ `SetTurnFlagEffect` with the matching `DUEL_FLAG`; `'farm'` ⇒ a stash move; Lament keys ⇒ heal, draw, the `club` step, `TurnFaceDownEffect` or `TurnFaceUpEffect`). Extra rows: Unyielding with the source dead, with 1 card in hand, with 2; Lament with no source, with a dead source, with a face-down source on spade, with 0 and 1 cards on club; Lightning Strike and Lament where the judged seat differs from the owner.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/judgmentOutcome.spec.ts` — Expected: FAIL.
- [ ] **Step 3: Extract each decision function**, make its `onJudged` call it (existing reader specs stay green), add the table entries.
- [ ] **Step 4: Run** `npx jest projects/content` — Expected: PASS.
- [ ] **Step 5: Commit** `feat(content): outcome of a skill's judgment, shared with its reader`.

### Task 4: Coverage and export

**Files:**
- Modify: `judgmentOutcome.spec.ts`, `public-api.ts`

**Interfaces:**
- Consumes: the content registry the other content specs use (e.g. in `display.spec.ts`).
- Produces: exports of `JudgmentOutcome`, `JudgmentOutcomeNames`, `judgmentOutcome`, `judgmentOutcomeText`, `judgmentReaderId` from the package.

- [ ] **Step 1: Write failing tests**: `'every card and skill with onJudged has outcome text'` — walk every card definition and every General skill in the registry that defines `onJudged`; for each id, `JUDGMENT_OUTCOMES` has a non-empty table and the dispatch table has an entry (export both from the module for the spec, or a `judgmentReaderIds()` helper); and `'every outcome key has English and Vietnamese text'` — for each reader id, call every key the decision functions can return (list them in the spec from Tasks 2 and 3) through `judgmentOutcomeText` in `'en'` and `'vi'` and expect non-null.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/judgmentOutcome.spec.ts` — Expected: FAIL only if an id was missed; otherwise PASS (if it passes at once, temporarily delete one table entry to watch it fail, then restore it).
- [ ] **Step 3: Export the API** from `public-api.ts`.
- [ ] **Step 4: Run the whole suite** `npm test` and `npx tsc --noEmit -p projects/app/tsconfig.app.json` — Expected: PASS, no type errors.
- [ ] **Step 5: Commit** `feat(content): export judgment outcome API and cover every reader`.
