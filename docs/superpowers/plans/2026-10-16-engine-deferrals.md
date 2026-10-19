# Engine Deferrals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the engine deferrals that still reproduce: the hidden-skill leak, `seatIsDying` in the UI, and five small engine defects.

**Architecture:** Redaction stays a pure view-time function in `engine/src/lib/domain/redact.ts` and gains an id-string scrub plus a log-event entry point that the server calls. `isSeatDying` becomes a pure engine function over `GameState` that the UI imports. The five defects are small local fixes, each with its own spec.

**Tech Stack:** TypeScript, Jest (`npx jest --selectProjects engine content app server`), Angular 22 for the one UI change.

**Spec:** `docs/superpowers/specs/2026-10-16-engine-deferrals-design.md`

## Global Constraints

- The engine stays framework-free; redaction is a pure function over plain data and never mutates the stored state or log.
- Decision ids (`ask-…`, `convert-…`, `wuxie-check-…`, `dying-…`) keep their current format. Recorded actions refer to them.
- Card ids are already opaque (`card-<position>`); do not touch them.
- `ReduceMaxHpEffect` reaching 0 max HP eliminates the seat at once with no dying round. Keep it; add one comment line saying so at its `case` in `effects.ts`.
- Games in progress at deploy may stop as `outdated` (state hashes can differ). No rules-version field.
- UI text: keywords keep their capitals (CLAUDE.md); no UI text changes in this plan.
- Shell note: this repo's shell is zsh; quote globs (`'*.ts'`).

## Review Focus

- A hidden skill id that appears inside a *longer* word of an id (a skill `fire` and an id `firewall-3`) must not be rewritten.
- A seat's own view must be unchanged: the owner still sees and answers with the real ids.
- A revealed General's skill id stays visible to everyone.
- A Sha whose damage was redirected (Fantasy) or prevented must not run Longbow's step; a Sha that did damage still must.
- A target sent with its keys in another order (`{seatId, kind}`) is accepted, wherever the engine compares targets.
- A delayed Tool whose card left the judgment area (or whose holder was eliminated) during the Wuxie window judges nothing and still cleans up.

---

### Task 1: Redact skill ids inside id strings

**Files:**
- Modify: `projects/engine/src/lib/domain/redact.ts` (`maskSkills`, `redactStateForSeat`)
- Test: `projects/engine/src/lib/domain/redact.spec.ts`

**Interfaces:**
- Produces: `maskSkills` also rewrites hidden skill ids found as whole tokens inside string values under the key `id` or a key ending in `Id`, replacing each with `'hidden'`. Whole token = the id is not preceded or followed by `[a-z0-9]` (hyphens are boundaries).
- Produces: `hiddenSkillIds` also returns the `abilityId` and `conversionId` that sit in the same object as a hidden-General `owner` (they equal the skill id for General skills, so the scrub covers them).

- [ ] **Step 1: Write the failing tests** in `redact.spec.ts`, in a new `describe('skill ids inside id strings')`. Reuse the file's existing seat/zone helpers and add a hidden General with skill `refusing-death` on `seat-b` (viewer `seat-a`).
  - `it('masks a hidden skill id inside a pending choice id')`: `pendingChoice.id = 'ask-refusing-death-seat-b-12'`, with `reason.owner = { kind:'general', seatId:'seat-b', slot:'main', skillId:'refusing-death' }`. Expect the viewer's `pendingChoice.id` to equal `'ask-hidden-seat-b-12'`.
  - `it('masks it inside a pending selection id')`: `pendingSelection.id = 'convert-refusing-death-seat-b-3'`; expect `'convert-hidden-seat-b-3'`.
  - `it('leaves the owner's own view unchanged')`: same state, viewer `seat-b`; the id is exactly the original.
  - `it('leaves a revealed General's skill id visible')`: set that slot `revealed: true`; the id is unchanged for `seat-a`.
  - `it('does not rewrite a skill id inside a longer word')`: hidden skill `fire`, id `'ask-fire-seat-b-1'` becomes `'ask-hidden-seat-b-1'`, but a string `'firewall-3'` under key `id` elsewhere in the same state stays `'firewall-3'`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects engine -t 'skill ids inside id strings'`
Expected: FAIL, the ids come back unmasked.

- [ ] **Step 3: Implement** in `redact.ts`. In `maskSkills`, when `k === 'id'` or `k.endsWith('Id')` and `v` is a string, replace every skill in `skills` with `'hidden'` using a per-skill regex built as `(?<![a-z0-9])` + escaped id + `(?![a-z0-9])`. In `hiddenSkillIds`, when an object has a hidden-General `owner` (use the existing hidden test), also add its `abilityId` and `conversionId` strings.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects engine`
Expected: PASS, no existing redact spec regresses.

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/domain/redact.ts projects/engine/src/lib/domain/redact.spec.ts
git commit -m "fix(engine): redaction masks hidden skill ids inside id strings"
```

### Task 2: Redact log events per viewer; the server and local board use it

**Files:**
- Modify: `projects/engine/src/lib/domain/redact.ts` (export the new function; it is re-exported by `public-api.ts` already through `export * from './lib/domain/redact'`)
- Modify: `projects/server/src/views/game.ts` (`toGameUpdate`)
- Modify: `projects/app/src/app/game.service.ts` (where the local board reads the log; find it at the `redactStateForSeat` call sites, lines ~89 and ~183, and at the log read in `game-board.ts:278`)
- Test: `projects/engine/src/lib/domain/redact.spec.ts`, `projects/server/src/views/game.spec.ts` (create it if absent; follow `server/src/game/testing.ts` helpers)

**Interfaces:**
- Consumes: Task 1's `maskSkills` and `hiddenSkillIds`.
- Produces: `export function redactEventsForSeat(state: GameState, events: readonly EngineEvent[], viewerSeatId: string): EngineEvent[]` in `redact.ts`. `state` supplies which Generals are revealed.

- [ ] **Step 1: Write the failing tests.**
  - In `redact.spec.ts`, `it('masks a hidden General's skill in a ChoiceMadeEvent for other seats')`: an event `{ kind:'ChoiceMadeEvent', ... reason:{ kind:'ability', owner:{kind:'general', seatId:'seat-b', slot:'main', skillId:'refusing-death'}, abilityId:'refusing-death' } }`; for viewer `seat-a`, both `owner.skillId` and `abilityId` read `'hidden'`; for `seat-b` they are unchanged.
  - `it('does not change the events passed in')`: the input array and its objects deep-equal their original after the call.
  - In `server/src/views/game.spec.ts`: `toGameUpdate` for a viewer who is not the owner returns `events` with no occurrence of the hidden skill id (assert `JSON.stringify(update.events)` does not contain it) while `toGameUpdate(..., ownerSeatId)` still does.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects engine server -t 'ChoiceMadeEvent|toGameUpdate'`
Expected: FAIL, `redactEventsForSeat` is not defined / the server leaks the id.

- [ ] **Step 3: Implement** `redactEventsForSeat` as `const skills = hiddenSkillIds(events, state, viewerSeatId); return maskSkills(events, skills)` (copy the array first). Call it in `toGameUpdate` for the `events` field. In the local app, apply it wherever the board consumes `log` for the viewing seat (shared service, not the Setup or Game screens).

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects engine server app`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/engine projects/server/src/views projects/app/src/app/game.service.ts
git commit -m "fix(engine,server): hidden General skills are redacted from the event stream"
```

### Task 3: `isSeatDying` moves into the engine

**Files:**
- Create: `projects/engine/src/lib/rules/dying.ts`, `projects/engine/src/lib/rules/dying.spec.ts`
- Modify: `projects/engine/src/public-api.ts` (export `./lib/rules/dying`)
- Modify: `projects/app/src/app/game-board/seat-tile.ts` (delete `seatIsDying`), `game-board.ts:15,366`, `round-table.ts:8,206` (import from `engine`)
- Test: `projects/app/src/app/game-board/seat-tile.spec.ts` (point existing `seatIsDying` specs at the engine function or delete them once `dying.spec.ts` covers them)

**Interfaces:**
- Produces: `export function isSeatDying(state: GameState, seatId: string): boolean` in `engine/src/lib/rules/dying.ts`. Pure; no registry.
- Rule (copy from the current UI): false if the seat is missing or eliminated or `combinedHp > 0`; otherwise true if a dying rescue window is pending for it (`state.pendingResponse?.reason?.kind === 'dying'` and its `seatId` equals `seatId`) or its `seat.pile` zone holds no cards. `seat.stash` never counts.

- [ ] **Step 1: Write the failing tests** in `dying.spec.ts` (build a minimal state with the factories used by `redact.spec.ts`):
  - `it('is false above 0 HP')`, `it('is false for an eliminated seat')`.
  - `it('is true at 0 HP with no pile')`.
  - `it('is false at 0 HP while a card lies in its pile')`.
  - `it('is true at 0 HP while its rescue window is pending, even with a card in the pile')`.
  - `it('ignores the stash')`: a card in `stash` and none in `pile` is still dying.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects engine -t 'isSeatDying|dying.spec'`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `isSeatDying`** in `dying.ts`, move the callers in `game-board.ts` and `round-table.ts` to `isSeatDying(state, seat.id)` imported from `engine`, and delete `seatIsDying` from `seat-tile.ts`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects engine app`
Expected: PASS, and `npx tsc -p projects/app/tsconfig.app.json --noEmit` reports no new error.

- [ ] **Step 5: Commit**

```bash
git add projects/engine projects/app/src/app/game-board
git commit -m "refactor(engine): seatIsDying is an engine rule, not UI code"
```

### Task 4: Sha after-damage runs only when damage landed

**Files:**
- Modify: `projects/content/src/lib/cards/sha.ts` (`onStep`, cases `sha-damage` and `sha-after-damage`)
- Test: `projects/content/src/lib/cards/sha-steps.spec.ts`

**Interfaces:**
- Produces: the `sha-damage` step queues `shaStep(step, 'sha-after-damage', { logFrom: state.log.length })`. `shaData` already reads `step.data`; add `logFrom?: number` to its data type.
- Rule: `sha-after-damage` returns `[]` unless `state.log.slice(data.logFrom ?? 0)` contains a `DamageDealtEvent` whose `damage.target` is the step's target seat.

- [ ] **Step 1: Write the failing tests** (the file's `table`, `play`, `act` helpers and recorder trigger already exist):
  - `it('runs sha-after-damage when the target took the damage')`: play a Sha with no Shan; the recorder's `seenSteps` contains `'sha-after-damage'`.
  - `it('skips sha-after-damage when the damage was cancelled')`: add a test-only before-trigger on `DamageEffect` that returns `[]`; `seenSteps` does not contain `'sha-after-damage'`.
  - `it('skips sha-after-damage when the damage was redirected to another seat')`: a before-trigger rewriting the damage target to `seat-c`; no `'sha-after-damage'` for the original target.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects content -t 'sha-after-damage'`
Expected: the cancelled and redirected tests FAIL.

- [ ] **Step 3: Implement** in `sha.ts` as in Interfaces. The step's `data.logFrom` is set at `sha-damage` time (before the damage resolves), so the log slice covers only this Sha's damage.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects content`
Expected: PASS, including Longbow and Fantasy specs.

- [ ] **Step 5: Commit**

```bash
git add projects/content/src/lib/cards
git commit -m "fix(content): a Sha's after-damage step needs damage on its target"
```

### Task 5: Target comparison without `JSON.stringify`

**Files:**
- Modify: `projects/engine/src/lib/rules/offered.ts` (export `sameValue`)
- Modify: `projects/engine/src/lib/rules/legality.ts` (lines ~169-170, ~234, ~244), `projects/engine/src/lib/pipeline/resolve.ts` (~577), `projects/content/src/lib/generals/skills.testing.ts` (~104)
- Test: `projects/engine/src/lib/rules/legality.spec.ts`, `projects/engine/src/lib/pipeline/resolve.spec.ts`

**Interfaces:**
- Produces: `export function sameValue(a: unknown, b: unknown): boolean` (already exists in `offered.ts`, currently module-private; export it, no behaviour change).

- [ ] **Step 1: Write the failing tests.**
  - `legality.spec.ts`: `it('accepts targets whose keys come in another order')`: `targetsAllowed(state, seat, cardId, 'sha', [{ seatId:'seat-b', kind:'seat' } as Target], registry)` is true where `[{ kind:'seat', seatId:'seat-b' }]` is.
  - `resolve.spec.ts`: `it('accepts a UseConversionAction whose targets have reordered keys')`: the same conversion action as an existing passing test, with each target's keys reversed, resolves without throwing.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects engine -t 'another order|reordered keys'`
Expected: FAIL.

- [ ] **Step 3: Implement**: export `sameValue`; replace each `JSON.stringify(a) === JSON.stringify(b)` with `sameValue(a, b)` (`wanted` becomes the targets array itself) in the four engine places and the test helper.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects engine content`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/engine projects/content/src/lib/generals/skills.testing.ts
git commit -m "fix(engine): compare targets structurally, not by JSON key order"
```

### Task 6: Elimination and judgment hygiene

**Files:**
- Modify: `projects/engine/src/lib/pipeline/effects.ts` (`HealEffect` case; comment on `ReduceMaxHpEffect` case)
- Modify: `projects/content/src/lib/shared/delayed.ts` (`judgeTarget`)
- Modify: `projects/engine/src/lib/pipeline/resolve.ts` (the `if (current.result)` line ~103)
- Test: `projects/engine/src/lib/pipeline/effects.spec.ts`, `projects/content/src/lib/cards/delayed.spec.ts`, `projects/engine/src/lib/pipeline/resolve.spec.ts`

**Interfaces:**
- Consumes: `judgmentZoneOf(state, seatId)` from `engine`; `moveCard(zones, cardInstanceId, toZoneId)` from `engine/src/lib/cards/zones.ts`; `requireZoneOfKind(zones, kind)`.
- Produces: `judgeTarget` returns `[]` when the target seat is eliminated or none of `tool.physical`'s instance ids is in the seat's judgment zone; otherwise the existing `JudgeEffect`.

- [ ] **Step 1: Write the failing tests.**
  - `effects.spec.ts`: `it('HealEffect does nothing on an eliminated seat')`: eliminated seat at 0 HP with max 4; applying `HealEffect` amount 1 returns the same state and no events.
  - `delayed.spec.ts`: `it('does not judge a delayed Tool that left the judgment area')`: place Capture, remove its card from the judgment zone, run the judgment phase; no `JudgeEffect` runs and the cleanup still completes. `it('does not judge an eliminated holder')`: same with the seat eliminated.
  - `resolve.spec.ts`: `it('sweeps processing to the discard pile when the game ends mid-resolution')`: a registered test effect puts a card in `processing` and a win check ends the game on the next step; final `processing` zone is empty and the card is in `discardPile`. `it('leaves processing alone when the game continues')`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects engine content -t 'eliminated seat|left the judgment|sweeps processing|leaves processing'`
Expected: FAIL.

- [ ] **Step 3: Implement** the three changes. The sweep runs only inside `if (current.result)`, before the queue is cleared, moves every card of the `processing` zone to the `discardPile` zone, and logs no event. Add one comment line at the `ReduceMaxHpEffect` case: `// 0 max HP is immediate death: no dying round, no rescue (official rule).`

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects engine content`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/engine projects/content
git commit -m "fix(engine): heal skips the eliminated, judgments re-check their slot, game end sweeps processing"
```

### Task 7: Replay stays stable; full verification

**Files:**
- Test: `projects/server/src/game/postgresReplay.spec.ts` (existing; extend) and the whole suite

**Interfaces:**
- Consumes: the finished tasks above.

- [ ] **Step 1: Write the spec** `it('a plain game that touches none of the changed situations replays to identical state hashes')` next to the existing replay specs: record a short seeded game (a few Sha plays and end-phases, no redirects, no delayed Tools), replay it with `checkHashes` on, and assert no hash difference.

- [ ] **Step 2: Run the full suite**

Run: `npx jest` then `npm run db:up && npm run test:db`
Expected: all pass. If a stored replay fixture fails only because items 4 or 6 legitimately changed state, regenerate that fixture and say so in the commit message; any other failure is a bug.

- [ ] **Step 3: Type-check**

Run: `npx tsc -p projects/app/tsconfig.app.json --noEmit && npm run typecheck:server`
Expected: no errors (the pre-existing `selection-dialog.spec.ts` error is fixed in the Frontend plan, not here).

- [ ] **Step 4: Commit**

```bash
git add projects/server/src/game
git commit -m "test(server): a plain game still replays to identical hashes"
```
