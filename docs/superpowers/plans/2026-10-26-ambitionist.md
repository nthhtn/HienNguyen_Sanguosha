# Ambitionist Implementation Plan

> **Executed with one change:** allegiance is decided by a mode hook, `decideAllegiance`, called by the resolver in the same step as the reveal, not by a trigger plus `DeclareAllegianceEffect` (Tasks 1 and 3). A queued effect raced with other reveals. See the spec's Design section.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seat that reveals into a full Kingdom (cap = floor(total / 2)) becomes an Ambitionist, a one-seat group that wins only as the last survivor.

**Architecture:** The engine gains one generic seat field, `allegiance`, and an effect that sets it. The Kingdom War mode decides it in a trigger on a seat's first reveal, using the cap. Content helpers, the kill reward, the win check, bots and the UI read it.

**Tech Stack:** TypeScript, Angular signals, Vitest-style specs next to the code (`*.spec.ts`), `npm test` per project.

**Spec:** `docs/superpowers/specs/2026-10-26-ambitionist-rules.md` (the spec's `ambitionist: true` flag is replaced here by `allegiance`; Task 7 updates the spec).

## Global Constraints

- Engine stays framework-free and content-free: no cap or Kingdom War rule inside `projects/engine`.
- UI text follows CLAUDE.md casing: English Title Case for labels ("Ambitionist"), Vietnamese sentence case ("Dã tâm gia" is a draft; `npm run i18n:status` reports it). Ids are never shown.
- Cap = `floor(state.seats.length / 2)` per Kingdom, Qun included. Seats with `allegiance === 'kingdom'` count toward their Kingdom, living or dead. Ambitionists count toward none.
- Kill of an Ambitionist: the killer draws 3. An Ambitionist killer never takes the same-Kingdom discard.
- Win: last living seat wins (no `winningKingdom`). A Kingdom wins only when every living seat has `allegiance === 'kingdom'` and shares it (Qun included). A hidden or undecided living seat blocks a Kingdom win. No forced reveal.
- Existing tests that expected a Kingdom win with hidden seats change by design; update them, do not weaken new ones.

## Review Focus

- Exactly at the cap: the cap-th seat is Kingdom, the next is an Ambitionist (7 seats: 3rd Wei Kingdom, 4th Ambitionist).
- A dead seat still holds its slot: 3 Wei revealed, one dies, a new Wei reveal is an Ambitionist.
- Revealing both Generals at once, or hiding a General again, never re-decides the status.
- A hidden over-cap seat that dies: the remaining exposed same-Kingdom seats win immediately. One that reveals as Ambitionist: no Kingdom win.
- A hidden seat killed in a full Kingdom (death reveal) gives the killer 3 cards, not the Kingdom count.
- Bot games still terminate (turn cap) when a hidden survivor never reveals.

---

### Task 1: Engine — `allegiance` field and effect

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts` (Seat, near `eliminated`)
- Modify: `projects/engine/src/lib/pipeline/effects.ts` (Effect union ~line 27, reducer near `RevealGeneralEffect` ~line 184)
- Modify: `projects/engine/src/lib/domain/redact.ts` (`redactSeat`)
- Test: `projects/engine/src/lib/pipeline/reveal.spec.ts`, `projects/engine/src/lib/domain/redact.spec.ts` (create the latter's case in the existing redact spec if one exists)

**Interfaces:**
- Produces: `Seat.allegiance?: 'kingdom' | 'ambitionist'` (decided once at a seat's first reveal; absent until then); effect `{ kind: 'DeclareAllegianceEffect'; seatId: string; allegiance: 'kingdom' | 'ambitionist' }`.

- [ ] **Step 1: Failing tests.** In `reveal.spec.ts`: `'DeclareAllegianceEffect sets the seat allegiance'` (apply the effect, assert `seat.allegiance === 'ambitionist'` and other seats untouched) and `'DeclareAllegianceEffect does not change a decided seat'` (declaring `'kingdom'` on a seat already `'ambitionist'` leaves it `'ambitionist'`). In the redact spec: `'a seat with no revealed General shows no allegiance to other viewers'` (viewer sees `allegiance` undefined; the owner still sees it).
- [ ] **Step 2:** Run `npx vitest run projects/engine -t Allegiance` (use the project's test command from `package.json`); expect FAIL (unknown effect).
- [ ] **Step 3:** Add the field and effect; reducer returns `{ state, events: [] }`, a no-op when the seat is already decided. `redactSeat` drops `allegiance` when `!isKingdomRevealed(seat.generals)`.
- [ ] **Step 4:** Rerun; expect PASS, then the whole engine suite green.
- [ ] **Step 5:** Commit `feat(engine): seat allegiance and DeclareAllegianceEffect`.

### Task 2: Content — Kingdom helpers read allegiance

**Files:**
- Modify: `projects/content/src/lib/shared/kingdom.ts`
- Test: `projects/content/src/lib/shared/kingdom.spec.ts`

**Interfaces:**
- Consumes: Task 1 `Seat.allegiance`.
- Produces: `kingdomCap(state: GameState): number` (= `Math.floor(state.seats.length / 2)`); `seatsInKingdom(state: GameState, kingdom: Exclude<Kingdom,'hidden'>): number` (seats, living or dead, with `allegiance === 'kingdom'` and that `seat.kingdom`); `exposedKingdom` returns null for `allegiance === 'ambitionist'`.

- [ ] **Step 1: Failing tests:** `'kingdomCap is half the table rounded down'` (7 seats → 3, 6 → 3, 2 → 1); `'seatsInKingdom counts dead seats'`; `'exposedKingdom is null for an Ambitionist'`; `'sameKingdomSeatIds of an Ambitionist is only itself'`; `'exposedKingdomCounts skips Ambitionists'`.
- [ ] **Step 2:** Run the content kingdom spec; expect FAIL.
- [ ] **Step 3:** Implement the two functions and the null case; update the stale "no Ambitionist yet" comment on `exposedKingdomCounts`.
- [ ] **Step 4:** Run; PASS. Run full content suite (Amass, Ally Far Attack Near, Wuxie Kingdom, Six Swords read these helpers and must stay green).
- [ ] **Step 5:** Commit `feat(content): Kingdom cap helpers and Ambitionist exclusion`.

### Task 3: Content — decide allegiance at first reveal

**Files:**
- Modify: `projects/content/src/lib/modes/kingdomWar.ts` (add a trigger, put it FIRST in `triggers` so later triggers of the same reveal see the decision)
- Test: `projects/content/src/lib/modes/kingdomWar.spec.ts`

**Interfaces:**
- Consumes: Task 1 effect, Task 2 `kingdomCap`/`seatsInKingdom`.
- Produces: `allegianceTrigger: SkillTrigger` on `after:GeneralRevealedEvent`; condition: the seat has no `allegiance`. Effect: `DeclareAllegianceEffect` with `'ambitionist'` when `seatsInKingdom(state, seat.kingdom) >= kingdomCap(state)`, else `'kingdom'`. Applies to death reveals too.

- [ ] **Step 1: Failing tests** (drive through `resolve` with real reveal actions, 7 seats): `'the third Wei is a Kingdom seat, the fourth an Ambitionist'`; `'a dead Wei still holds its slot'`; `'revealing both Generals at once decides once'`; `'hiding a General and revealing again keeps the decision'`; `'a hidden seat revealed by death in a full Kingdom becomes an Ambitionist'`; `'Qun is capped like the others'`.
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3:** Implement the trigger and register it first.
- [ ] **Step 4:** Run; PASS; full content suite green.
- [ ] **Step 5:** Commit `feat(content): Ambitionist decided at first reveal`.

### Task 4: Content — kill reward

**Files:**
- Modify: `projects/content/src/lib/modes/kingdomWar.ts` (kill reward trigger, ~line 306)
- Test: `projects/content/src/lib/modes/kingdomWar.spec.ts`

**Interfaces:**
- Consumes: Tasks 2–3.

- [ ] **Step 1: Failing tests:** `'killing an Ambitionist draws 3'` (even if its Kingdom has other living seats); `'an Ambitionist killer never discards for a same-Kingdom kill'` (kills a seat sharing its printed Kingdom: draws as for another Kingdom); `'killing a hidden seat in a full Kingdom draws 3'` (death reveal makes it an Ambitionist before the reward).
- [ ] **Step 2:** Run; FAIL.
- [ ] **Step 3:** In the trigger, an Ambitionist victim draws 3; a killer with `allegiance === 'ambitionist'` is never "same Kingdom". The rest of the rule is unchanged.
- [ ] **Step 4:** Run; PASS.
- [ ] **Step 5:** Commit `feat(content): kill reward for Ambitionists`.

### Task 5: Content — win check

**Files:**
- Modify: `projects/content/src/lib/modes/kingdomWar.ts` (`checkWinCondition`, line 268)
- Modify tests: `projects/content/src/lib/modes/kingdomWar.spec.ts` (~365), `projects/engine/src/lib/pipeline/winCondition.spec.ts` only if they use Kingdom War

**Interfaces:**
- Consumes: Task 1 field. `checkWinCondition(state): GameResult | null` signature unchanged.

- [ ] **Step 1: Failing tests:** `'an Ambitionist wins as the sole survivor, with no winningKingdom'`; `'Kingdom wins when every survivor is a decided Kingdom seat of it'`; `'Qun wins as a group'`; `'a hidden survivor blocks a Kingdom win'`; `'the game ends when the last hidden seat reveals into its Kingdom'` (through `resolve`, assert `state.result.winningKingdom === 'Wei'` right after the reveal); `'an over-cap hidden seat revealing as Ambitionist does not end the game'`; `'killing the blocking hidden seat ends the game'`; `'a Kingdom and an Ambitionist alive: no result'`; draw and single-survivor cases unchanged.
- [ ] **Step 2:** Run; FAIL. Also update the pre-existing Kingdom-win tests that relied on hidden seats counting.
- [ ] **Step 3:** Rewrite per the Global Constraints: 0 alive → draw, 1 alive → that seat, else all alive have `allegiance === 'kingdom'` and one `kingdom` → that Kingdom wins (remove the Qun exclusion), else null.
- [ ] **Step 4:** Run content and engine suites; PASS.
- [ ] **Step 5:** Commit `feat(content): Ambitionist and exposed-only Kingdom win check`.

### Task 6: Bots and UI

**Files:**
- Modify: `projects/bots/src/lib/helpers.ts` (`isAlly`), `projects/bots/src/lib/helpers.spec.ts` (or the bots spec that covers it)
- Modify: `projects/app/src/app/labels.ts`, `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`, `projects/app/src/app/game-board/seat-tile.ts`
- Modify: callers of `forceOf(...?.kingdom)` (grep `forceOf(` in `projects/app/src/app`, ~25 sites in game-board, e.g. `target-label.ts`, `action-history.ts`, `response-description.ts`) to use the new `seatForce`
- Test: `projects/app/src/app/labels.spec.ts`, `labels.vi.spec.ts`, seat-tile spec

**Interfaces:**
- Produces: `seatForce(seat: Seat | undefined): Force` in `labels.ts` (`'none'` for an Ambitionist, else `forceOf(seat?.kingdom)`); `seatKingdomLabel(seat: Seat, tr?: Translator): string` (`label.kingdom.Ambitionist` for an Ambitionist, else `kingdomDisplayName(seat.kingdom, tr)`); message key `label.kingdom.Ambitionist` (en "Ambitionist", vi "Dã tâm gia", draft).

- [ ] **Step 1: Failing tests:** bots `'an Ambitionist is nobody's ally, and nobody is its ally'`; labels `'seatForce is none for an Ambitionist'`, `'seatKingdomLabel shows Ambitionist in English and Vietnamese'`; seat tile `'shows the Ambitionist badge instead of the Kingdom'`.
- [ ] **Step 2:** Run each; FAIL.
- [ ] **Step 3:** Implement; `isAlly` returns false when either seat has `allegiance === 'ambitionist'`. The seat tile uses `seatKingdomLabel` and a neutral badge class. Replace the `forceOf(x?.kingdom)` calls on seats with `seatForce(x)`. Bots keep treating Qun as allied with no one (unchanged, my call).
- [ ] **Step 4:** Run bots and app suites; `npm run i18n:status` lists the new vi key as draft.
- [ ] **Step 5:** Commit `feat(app): show Ambitionists; bots treat them as enemies`.

### Task 7: Simulation, docs, spec sync

**Files:**
- Modify: `docs/superpowers/specs/2026-10-26-ambitionist-rules.md` (Design: `allegiance` replaces the flag; game-over uses the existing "names win" line, no new text), `docs/architecture/rules-engine.md` and `content-and-extensibility.md` (one short paragraph each)
- Test: `projects/sim/src/property.spec.ts`, `invariants.ts`

- [ ] **Step 1:** Add an invariant: no Kingdom has more than `floor(seats/2)` seats with `allegiance === 'kingdom'`, and a decided seat's allegiance never changes between log states.
- [ ] **Step 2:** Run the simulator tournament (`projects/sim` CLI) for ~200 games at 5, 7 and 8 seats; expect no crashes or invariant failures. Report how many games ended by turn cap (hidden survivor never reveals) and how many by Ambitionist win.
- [ ] **Step 3:** Update the spec and architecture docs.
- [ ] **Step 4:** Run `npm test` for every project and the lint/build commands in `package.json`; all green.
- [ ] **Step 5:** Commit `docs+sim: Ambitionist invariants and architecture notes`.
