# Synergistic Partners Reward Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a seat's second General is revealed and the two Generals are Synergistic Partners, that seat chooses to draw 2 cards or recover 1 HP, once.

**Architecture:** The engine gains a general "visible but disabled" choice option and a `partner-reward` decision reason. Content holds a clean table of 19 id pairs and a Guozhan reveal trigger (beside `revealBonusTriggers`) that opens the choice. Bots, the choice dialog, the Action History and the i18n files consume it. A new game rule `partnerReward` gates it so stored games replay unchanged.

**Tech Stack:** TypeScript, Angular (standalone, signals), Jest (`npm test`), `npm run verify`.

**Spec:** [docs/superpowers/specs/2026-11-10-synergistic-partners-reward-design.md](../specs/2026-11-10-synergistic-partners-reward-design.md)

## Global Constraints

- Rules live in the engine/content, never in Angular components; the UI only renders the disabled state.
- Option ids and English labels are exactly `recover` / `Recover 1 HP` and `draw` / `Draw 2 Cards` (the app's existing label translation keys `choice.label.recover` and `choice.label.draw2` match on that English text; `mountain.ts` already uses them).
- The pair table holds General **ids**, never names or the crawled partner text. `zhuge-liang` and `fire-zhuge-liang` share a Vietnamese name.
- Death reveals (`onDeath`) give no reward; the reward fires only on the first time both Generals stand revealed (`firstTimeBothRevealed` in `projects/content/src/lib/modes/guozhan.ts`).
- UI text casing per `CLAUDE.md`: Title Case for labels/titles in English, sentence case for the history line; Vietnamese is sentence case and starts as a draft (`npm run i18n:status`).
- Do not modify the Setup or Game screens (`setup.ts`, the local Game screen); `game.service.ts` and `roomService.ts` are services and may change.
- Commit per task; never push to or merge `main`.

## Review Focus

- Seat at full HP: "Recover 1 HP" is shown, disabled, not offered by `getLegalActions`, and a forged pick is rejected by the engine (Task 1, Task 3).
- Second reveal is the Main General vs the Deputy: same result either order (Task 3).
- Reveal by a skill's "Use" (reveal-on-use) and by the Start window both reward (Task 3).
- A General hidden and re-revealed pays nothing the second time (Task 3).
- Both Rounding (odd printed HP) and the partner reward on the same reveal: both resolve, none lost (Task 3).
- A game created without `partnerReward` (stored games) never opens the prompt (Task 3, Task 5).

---

### Task 1: Engine — disabled choice options and the reward reason

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts` (`ChoiceOption`, `DecisionReason`, `GameRules`)
- Modify: `projects/engine/src/lib/rules/legality.ts` (`chooseOptions`)
- Modify: `projects/engine/src/lib/pipeline/resolve.ts` (`ChooseOptionAction` case, ~line 684)
- Test: `projects/engine/src/lib/pipeline/choice.spec.ts`

**Interfaces:**
- Produces: `ChoiceOption.disabled?: true`; `DecisionReason` member `{ kind: 'partner-reward' }`; `GameRules.partnerReward?: boolean` (documented: when set, Guozhan's partner reward applies; absent = no reward, so stored games replay the same).

- [ ] **Step 1: Write failing tests** in `choice.spec.ts` (follow the file's existing helpers for building a state with a `pendingChoice`): `'getLegalActions omits a disabled option'` (a two-option choice, one `disabled: true`; legal actions contain only the other option's id) and `'ChooseOptionAction on a disabled option throws'` (expect `resolve` to throw an error matching `/disabled/`).
- [ ] **Step 2: Run** `npx jest projects/engine/src/lib/pipeline/choice.spec.ts` — expect both new tests FAIL.
- [ ] **Step 3: Implement.** Add the three type members above. In `chooseOptions`, filter out `o.disabled`. In the `ChooseOptionAction` case, throw `Choice ${id} option ${optionId} is disabled` for a disabled option (after the existence check).
- [ ] **Step 4: Run** the same command plus `npm run typecheck` — expect PASS (the typecheck may flag exhaustive `switch`es over `DecisionReason`; extend them with a no-op/`partner-reward` arm as the compiler indicates, keeping behavior unchanged for other reasons).
- [ ] **Step 5: Commit** `feat(engine): disabled choice options and the partner-reward reason`.

### Task 2: Content — the pairing table

**Files:**
- Create: `projects/content/data/decks/kingdom-wars/synergistic-pairs.json` (array of `[idA, idB]`; the 19 pairs listed in the spec, verbatim)
- Create: `projects/content/src/lib/synergisticPartners.ts`
- Modify: `projects/content/src/public-api.ts` (export the accessor)
- Test: `projects/content/src/lib/synergisticPartners.spec.ts`

**Interfaces:**
- Produces: `areSynergisticPartners(a: string, b: string): boolean` — order-insensitive; `false` for equal ids and unknown ids.

- [ ] **Step 1: Write failing tests:** `'is symmetric'` (`liu-bei`/`guan-yu` both orders true); `'is false for unrelated and identical ids'`; `'has 19 pairs, all ids exist in the Kingdom Wars deck'` (ids ⊂ `kingdomWarsGeneralIds()`); `'agrees with the crawled partner lists'` — for every pair, each General's crawled `synergisticPartners` text (`kingdomWarsGeneralRecords()`) contains the other General's English `name` as a substring (names normalised by dropping CJK and parentheses as in the spec's analysis), so table and wiki cannot drift. If one pair legitimately fails this (the Yan Liang & Wen Chou entry is crawled as `Yan Liang & Wen Chou 颜良&文丑`), allow-list it in the test with a comment saying why.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/synergisticPartners.spec.ts` — FAIL.
- [ ] **Step 3: Implement** the JSON and `areSynergisticPartners` (build a `Set` of sorted `a|b` keys once at module load).
- [ ] **Step 4: Run** the spec — PASS.
- [ ] **Step 5: Commit** `feat(content): synergistic partners pair table`.

### Task 3: Content — the reveal trigger

**Files:**
- Modify: `projects/content/src/lib/modes/guozhan.ts` (`revealBonusTriggers`, appended after the Rounding trigger)
- Test: `projects/content/src/lib/modes/partnerReward.spec.ts` (follow `guozhan.spec.ts` for building states and revealing Generals)

**Interfaces:**
- Consumes: `areSynergisticPartners` (Task 2); `ChoiceOption.disabled`, reason `{ kind: 'partner-reward' }`, `GameRules.partnerReward` (Task 1); `draw`, `heal`, `isHurt` from `projects/content/src/lib/shared/skills.ts`.
- Produces: on `after:GeneralRevealedEvent`, when `state.rules?.partnerReward`, not `onDeath`, both of the seat's Generals revealed, `firstTimeBothRevealed(state, seatId)`, and the two `generalDefinitionId`s are partners: an `OpenChoiceEffect` for that seat with `verb: 'pick'`, `reason: { kind: 'partner-reward' }`, id `partner-reward-${seatId}-${state.log.length}`, options in this order: `recover` (`shows: { kind: 'label', text: 'Recover 1 HP' }`, `effects: [heal(seatId, 1)]`, `disabled: true` exactly when `!isHurt(state, seatId)`) and `draw` (`shows: { kind: 'label', text: 'Draw 2 Cards' }`, `effects: [draw(seatId, 2)]`). `choiceOf` in `shared/skills.ts` needs a skill owner, so build the effect literally.

- [ ] **Step 1: Write failing tests**, one per Review Focus line above, named for the behavior: `'offers recover and draw when the second General completes a pair'` (assert the pending choice's options, reason, seat); `'marks recover disabled at full HP and a forged pick throws'`; `'works whichever General is revealed second'`; `'fires when the second General is revealed by using its skill'`; `'does not fire again after a hide and re-reveal'`; `'does not fire on a death reveal or for a non-pair'`; `'does not fire without the partnerReward rule'`; `'stacks with the Rounding draw'` (a pair with odd printed HP sum: the Rounding card is drawn and the choice is open). Picking `draw` adds 2 cards; picking `recover` at 3/4 HP heals 1.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/modes/partnerReward.spec.ts` — FAIL.
- [ ] **Step 3: Implement** the trigger as specified; `condition` is a pure function of `(state, subject, _owner, registry)` like the Rounding trigger beside it, reusing `firstTimeBothRevealed`.
- [ ] **Step 4: Run** the new spec and `npx jest projects/content` — PASS, no regression in `guozhan.spec.ts`.
- [ ] **Step 5: Commit** `feat(content): synergistic partners reveal reward`.

### Task 4: Bots — choose the reward

**Files:**
- Modify: `projects/bots/src/lib/rule-based.ts` (the choice block starting at `const choiceNow = view.pendingChoice;`, ~line 139)
- Test: `projects/bots/src/lib/rule-based.spec.ts` (use `projects/bots/src/lib/testing.ts` helpers that set `pendingChoice`)

**Interfaces:**
- Consumes: reason `{ kind: 'partner-reward' }` and option ids `recover` / `draw` (Task 3). Legal actions already exclude a disabled option.

- [ ] **Step 1: Write failing tests:** `'a damaged bot recovers 1 HP for the partner reward'` and `'a bot at full HP draws 2 cards for the partner reward'`, each building a state whose `pendingChoice` has the two options (`recover` disabled in the second) and asserting the chosen `ChooseOptionAction.optionId`.
- [ ] **Step 2: Run** `npx jest projects/bots/src/lib/rule-based.spec.ts` — the damaged-bot test FAILs or the generic path passes by accident; keep both tests either way as the pin.
- [ ] **Step 3: Implement** an explicit branch inside the `choiceNow && me && choiceActions.length > 0` block: for `partner-reward`, take `recover` if it is among `choiceActions`, else `draw`.
- [ ] **Step 4: Run** the spec — PASS.
- [ ] **Step 5: Commit** `feat(bots): choose the partner reward`.

### Task 5: Turn the rule on for new games

**Files:**
- Modify: `projects/app/src/app/game.service.ts` (~line 171, the `createGame` rules), `projects/server/src/rooms/roomService.ts` (~line 445, `rules`), `projects/app/src/app/dev/recipe.ts` (~line 24)
- Test: existing specs of those files; plus `projects/sim/src/runGame.spec.ts` (or the nearest full-game simulation spec)

**Interfaces:**
- Consumes: `GameRules.partnerReward` (Task 1). A new game gets `partnerReward: true` next to `judgmentNotice`; the value is stored in `state.rules` (and in the server's stored game `rules`), so replays of stored games without it never open the prompt.

- [ ] **Step 1: Write failing tests:** in the `game.service` spec, `'a new game has the partnerReward rule on'`; in the roomService spec, the created game's stored `rules` include `partnerReward: true` (update any test that asserts the exact rules object).
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game.service projects/server -t partnerReward` (server specs that need Postgres are under `npm run test:db`; run the in-memory ones) — FAIL.
- [ ] **Step 3: Implement** by adding `partnerReward: rules?.partnerReward ?? true` (game.service) and `partnerReward: true` (roomService, recipe). Keep stored-game rules untouched on replay: the server must read `rules` from the stored record, not re-add the flag there.
- [ ] **Step 4: Add a simulation check:** run an existing full-game simulation spec with `rules: { partnerReward: true }` and a Kingdom Wars deck over several seeds, asserting the games finish with no invariant violations (bots answer the new prompt). Run `npx jest projects/sim` — PASS.
- [ ] **Step 5: Commit** `feat: enable the partner reward for new games`.

### Task 6: App — disabled option, prompt text, history line, translations

**Files:**
- Modify: `projects/app/src/app/game-board/choice-description.ts` (`choiceDialogOptions`, the description for the new reason), `projects/app/src/app/game-board/choice-dialog.ts` (`ChoiceDialogOption.disabled`, template, `pick`), `projects/app/src/app/game-board/action-history.ts` (the `ChoiceMadeEvent` case, ~line 249)
- Modify: `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`
- Test: `choice-description.spec.ts`, `choice-dialog.spec.ts`, `action-history.spec.ts` (and the i18n key-parity spec, which fails if `vi` lacks a key)

**Interfaces:**
- Consumes: `ChoiceOption.disabled`, reason `partner-reward`, option ids `recover` / `draw` (Tasks 1, 3).
- Produces: `ChoiceDialogOption.disabled?: true`; new keys `choice.partnerReward.prompt`, `history.partnerReward.draw`, `history.partnerReward.recover`. The dialog title reuses the existing `wiki.partners` ("Synergistic Partners" / "Đối tác phối hợp").

- [ ] **Step 1: Write failing tests:** (a) `choiceDialogOptions` returns the `recover` option with `disabled: true` when the engine option is disabled and has no legal action, and an enabled `draw` with its action; (b) the dialog renders the disabled option as a disabled button and clicking it does not enable Confirm; (c) the choice description for `partner-reward` has title "Synergistic Partners" and the new prompt; (d) the history shows `Hing revealed Synergistic Partners and drew 2 cards` for a `ChoiceMadeEvent` with reason `partner-reward` and label `Draw 2 Cards`, and `… and recovered 1 HP` for `Recover 1 HP`.
- [ ] **Step 2: Run** `npx jest projects/app/src/app/game-board` — FAIL.
- [ ] **Step 3: Implement.** In `choiceDialogOptions`, do not drop an option that is `disabled` and lacks a legal action: emit it with `disabled: true` and the same `ChooseOptionAction` shape it would have had (so the type stays `Action`). The dialog `[disabled]`-binds the button and `pick` ignores disabled options. English: prompt `Your Generals are Synergistic Partners: choose a reward`; history lines `{seat} revealed Synergistic Partners and drew 2 cards` / `… and recovered 1 HP` (seat names keep their capitals). Vietnamese drafts in sentence case, reusing `wiki.partners` wording ("Đối tác phối hợp"); run `npm run i18n:status` to confirm they are listed as draft.
- [ ] **Step 4: Run** `npx jest projects/app` — PASS.
- [ ] **Step 5: Commit** `feat(app): partner reward prompt, disabled option and history line`.

### Task 7: Docs

**Files:**
- Modify: `docs/architecture/event-chain.md` ("Reveal bonuses"), `docs/architecture/rules-engine.md` (`GameRules` table: add `partnerReward`; mention `ChoiceOption.disabled` where choices are described)
- Modify: the Rules wiki page that describes reveal bonuses (search `projects/app/src/app/wiki/rules/setup.ts` and its Vietnamese counterpart; update `__snapshots__` with `npx jest projects/app/src/app/wiki/rules -u` only after reviewing the diff)

- [ ] **Step 1:** Write the doc changes: the rule in one paragraph, the pair-table location, the `partnerReward` rule, the disabled option.
- [ ] **Step 2: Run** `npm run verify` and `npm test` — expect all green.
- [ ] **Step 3: Commit** `docs: synergistic partners reward`.

## Final verification

Run `npm run verify` and `npm test`, then a manual check in the browser (`npm start`): a vs-bots Kingdom Wars game forced to a pair (use the dev scenario previews in `projects/app/src/app/dev/scenarios/choices.ts` to add a one-off scenario if needed) shows the dialog with Recover disabled at full HP, and the Action History line.
