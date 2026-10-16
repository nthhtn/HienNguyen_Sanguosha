# Voluntary Reveal and Brave Spirit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player reveal a hidden General on purpose (own Play Phase, and as their turn begins before the Start effects), which turns Zhang Fei's Roar on, and give Sun Jian's Brave Spirit mode choice to Sun Jian's player.

**Architecture:** One shared engine helper offers `RevealGeneralAction` for a seat's hidden slots in two windows. The Start window is a waiting turn-start state (`Turn.startWindow`) that holds back the Start `PhaseChangedEvent` and its triggers until the human continues. Brave Spirit moves one `seatId` in content and one bot rule. The UI shows only what `getLegalActions` offers.

**Tech Stack:** TypeScript, Jest (`npx jest --selectProjects engine content bots app sim`), Angular 22.

**Spec:** `docs/superpowers/specs/2026-10-16-voluntary-reveal-and-brave-spirit-design.md`

## Global Constraints

- The engine names no card or skill; the new window is generic (turn owner, hidden slot, human player).
- The UI holds no rules: it shows what `getLegalActions` offers and never decides whether a reveal is allowed.
- Bot seats never wait at the Start window; seeded bot-only games without Sun Jian must replay to identical hashes (the random-policy games and games with Sun Jian may change).
- CLAUDE.md UI text: Title Case for buttons and labels, sentence case for sentences, keywords keep capitals; Vietnamese is sentence case and new Vietnamese is a draft (update `vi.ts` / locale files with every English change; `npm run i18n:status` must still run).
- Redaction: another seat's hidden General ids stay hidden; a seat's own hidden Generals are visible to it.
- Games in progress at deploy may stop as `outdated` (accepted).
- Shell is zsh: quote globs.

## Review Focus

- Revealing Zhang Fei in the Play Phase makes a second Sha playable in the same turn; the reveal costs no action and adds no Sha count.
- A human at the Start window with one hidden General sees one Reveal action; after revealing it, the window offers only Continue; with both hidden it offers both, repeatably.
- A skill revealed in the Start window fires its Start trigger in that Start, once (Follow the Master / a compulsory Start skill).
- A bot seat, a fully revealed seat, an eliminated seat and a face-down seat's turn never wait; a decision-clock timeout at the window submits Continue.
- The very first turn (after General selection) also opens the window for a human with hidden Generals.
- Brave Spirit: the owner (human) gets the mode popup whichever seat he picked; the picked seat gets only the discard selection; the prompt names the picked seat.

---

### Task 1: Brave Spirit's user chooses the mode

**Files:**
- Modify: `projects/content/src/lib/generals/forest.ts` (`braveSpirit`, step `forced`, ~lines 235-250), `projects/bots/src/lib/forest.ts` (`case 'brave-spirit'`, ~lines 73-84), `projects/content/src/lib/display.ts` (`CHOICE_PROMPT_TEXT` entry `'brave-spirit'` ~line 187), `projects/content/data/locales/vi/prose.json` (`choicePrompt.brave-spirit`), `projects/app/src/app/game-board/choice-description.ts` (substitute `{target}` in a fixed choice prompt)
- Test: `projects/content/src/lib/generals/forest-wu.spec.ts` (Brave Spirit specs), `projects/bots/src/lib/forest.spec.ts`, `projects/app/src/app/game-board/choice-description.spec.ts` (+ its `vi` counterpart)

**Interfaces:**
- Rule (spec): Sun Jian picks the seat and also picks the mode; the picked seat discards its own cards (it chooses which). In the `forced` step the `choiceOf` is made for the owner: no `seatId` override, and `targetSeatId: target` (the picked seat), so the UI can name it. The `discard` selection keeps `seatId: target`.
- Prompt: the fixed text for `brave-spirit` becomes `Choose how {target} draws and discards` (sentence case); `describeChoice` replaces `{target}` with the picked seat's name from `choice.reason.targetSeatId` when the fixed prompt contains it. Vietnamese counterpart is a draft.
- Bot (the owner's rule): when the choice is the mode choice (options `draw-x` and `draw-1`), `me` is the owner and the picked seat is `reason.targetSeatId`: draw X then discard 1 when X <= 2 or when the picked seat has fewer spare cards (cards with `keepRank(...) < 3`) than X; otherwise draw 1 then discard X. X is the owner's missing HP (`maxCombinedHp - combinedHp` of the owner).

- [ ] **Step 1: Write the failing tests.**
  - `forest-wu.spec.ts`: change `at the start of his turn, ... either draws X ...` so that after `h.choose(h.use(s), 'seat-b')` the pending choice is `{ seatId: 'seat-a', reason: { targetSeatId: 'seat-b' } }` (the owner), its options are still `draw-x` and `draw-1` with the same labels; after `h.choose(s, 'draw-x')` the pending selection is `{ seatId: 'seat-b' }` (the picked seat discards). Add `it('he may pick himself and still chooses the mode')` (pick `seat-a`: choice and selection are both seat-a).
  - `bots/src/lib/forest.spec.ts`: `it('Brave Spirit: the owner draws X and discards 1 for X of 2 or less')`, `it('... draws 1 and discards X when the picked seat has spare cards to discard')`, `it('... draws X and discards 1 when the picked seat has too few spare cards')`; the existing "target's pick" spec is replaced.
  - `choice-description.spec.ts`: the Brave Spirit mode choice reads `Choose how Seat 1 draws and discards` for the owner viewing it; Vietnamese counterpart in the `vi` spec.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects content bots app -t 'Brave Spirit'`
Expected: the owner/seat assertions and the prompt FAIL.

- [ ] **Step 3: Implement** the content change, the bot rule, the prompt text with its `{target}` substitution, and the Vietnamese draft.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects content bots app sim && npm run i18n:status`
Expected: PASS; `catalogs.spec.ts` placeholder parity stays green.

- [ ] **Step 5: Commit**

```bash
git add projects/content projects/bots projects/app
git commit -m "fix(content): Sun Jian's player chooses Brave Spirit's mode"
```

### Task 2: Reveal action in the Play Phase (engine) and Zhang Fei

**Files:**
- Modify: `projects/engine/src/lib/rules/legality.ts` (`getLegalActions`, Play branch; new helper), `projects/engine/src/lib/pipeline/resolve.ts` only if `RevealGeneralAction` needs a phase guard
- Test: `projects/engine/src/lib/rules/legality.spec.ts`, `projects/content/src/lib/generals/shu.spec.ts` (Roar), the bots' and sim's specs that assert an exact legal-action set (find them: `grep -rn "EndPhaseAction" --include='*.spec.ts'` in `engine`, `bots`, `sim`, `app`)

**Interfaces:**
- Produces (exported from `legality.ts`, re-exported by `public-api.ts` through its existing `export *`): `export function hiddenGeneralReveals(state: GameState, seatId: string): Action[]`: one `{ kind: 'RevealGeneralAction', seatId, slot }` per slot of the seat whose General exists and has `revealed === false`; `[]` for a seat with no generals or none hidden.
- Behaviour: in the Play Phase, for the turn owner with nothing pending, the list returned by `getLegalActions` includes `hiddenGeneralReveals(...)` right after `EndPhaseAction`. `RevealGeneralAction`'s resolution is unchanged (`RevealGeneralEffect`, already logs `GeneralRevealedEvent`).

- [ ] **Step 1: Write the failing tests.**
  - `legality.spec.ts`: `it('offers a Reveal for each hidden General in the Play Phase')` (both hidden: two actions, slots main and deputy); `it('offers no Reveal for a revealed General')`; `it('offers no Reveal outside the Play Phase or to another seat')`; `it('offers no Reveal while a decision is pending')`.
  - `shu.spec.ts`: `it('Zhang Fei: revealing him in the Play Phase turns Roar on')`: Zhang Fei hidden, hand of three Sha; play one Sha (and pass the window), assert the second is not playable; apply the `RevealGeneralAction` for his slot; assert `playTargets(s, 'seat-a', 's2')` now contains `seat-b`.
  - Fix every existing spec that asserted an exact legal-action set containing `EndPhaseAction` for a seat with hidden Generals (they now also hold Reveal actions); do not weaken them: add the Reveal actions to the expected set.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects engine content -t 'Reveal|Roar'`
Expected: the new offer/Roar tests FAIL.

- [ ] **Step 3: Implement `hiddenGeneralReveals`** and add it to the Play branch; update the sweep of specs.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects engine content bots sim`
Expected: PASS. The random policy (`bots/src/lib/random.ts`) may now pick a reveal: if a seeded random-policy spec pins hashes or exact moves and now fails only because of that, update its expectation and say which; any other failure is a bug.

- [ ] **Step 5: Commit**

```bash
git add projects/engine projects/content projects/bots projects/sim
git commit -m "feat(engine): a player may reveal a hidden General in their own Play Phase"
```

### Task 3: Reveal buttons on the avatar (app)

**Files:**
- Modify: `projects/app/src/app/game-board/action-list.ts` (`isCardAction`: Reveal belongs to the avatar), `projects/app/src/app/game-board/avatar-skills.ts` (or a new small helper in the same folder), `projects/app/src/app/game-board/seat-avatar.ts` (a Reveal button in each hidden half's skill column), the board components that pass `skills` to the avatar (`game-board.ts` ~line 357 and `round-table.ts`), `projects/app/src/app/i18n/en.ts` and `vi.ts`
- Test: `projects/app/src/app/game-board/action-list.spec.ts`, `seat-avatar.spec.ts`, `avatar-skills.spec.ts` (+ `vi` specs where they exist)

**Interfaces:**
- Consumes: Task 2's offered `RevealGeneralAction`s.
- Produces: `export interface AvatarReveal { slot: 'main' | 'deputy'; action: Extract<Action, { kind: 'RevealGeneralAction' }> | null }` and `export function avatarReveals(generals: SeatGenerals | null, legal: readonly Action[]): AvatarReveal[]` in `avatar-skills.ts`: one entry per hidden slot of the viewer's own seat (a slot with `revealed === false`), `action` = the engine's matching action or null (disabled). `SeatAvatar` gets `readonly reveals = input<AvatarReveal[]>([])` and an output `revealGeneral` emitting the action; each hidden half's skill column starts with a `Reveal` button (English label via a new key `avatar.reveal` = `Reveal`, Vietnamese a draft). `action-list.ts` no longer renders `RevealGeneralAction` (the avatar owns it).
- The button is enabled exactly when `action` is non-null; the avatar never decides legality.

- [ ] **Step 1: Write the failing tests.**
  - `avatar-skills.spec.ts`: `avatarReveals` returns an entry per hidden slot with the matching action when offered and `null` when not; none for a revealed slot or for `generals: null`.
  - `seat-avatar.spec.ts`: a hidden half renders a `Reveal` button, enabled when its action is present, emitting the action on click; a revealed half renders none.
  - `action-list.spec.ts`: a `RevealGeneralAction` in `actions` is not rendered in the list.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects app -t 'Reveal'`
Expected: FAIL.

- [ ] **Step 3: Implement** the helper, the input/output, the button, the list filter, the wiring in the board components (dispatch through the same path as `useSkill`), and the English and Vietnamese labels.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects app && npm run i18n:status && npx tsc -p projects/app/tsconfig.app.json --noEmit`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add projects/app
git commit -m "feat(app): a Reveal button on each hidden General of your own avatar"
```

### Task 4: Reveal window as the turn begins (engine)

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts` (`Turn`), `projects/engine/src/lib/rules/phaseSequence.ts` (`phaseWaitsForPlayer`, new helper), `projects/engine/src/lib/pipeline/resolve.ts` (`enterNextPhase`, the first-turn path in `ChooseGeneralsAction`, `EndPhaseAction`), `projects/engine/src/lib/rules/legality.ts` (the waiting state's legal actions)
- Test: `projects/engine/src/lib/pipeline/turnStartWindow.spec.ts` (create), `projects/engine/src/lib/rules/phaseSequence.spec.ts`, `projects/engine/src/lib/rules/defaultActions.spec.ts`

**Interfaces:**
- Consumes: Task 2's `hiddenGeneralReveals`.
- Produces: `Turn.startWindow?: true`; `export function startWindowOpens(state: GameState, seatId: string): boolean` in `phaseSequence.ts`: true when the seat is living, not face down, has generals with at least one `revealed === false`, and its `Player` (in `state.players`, matched by `seatId`) has `kind === 'human'`. `phaseWaitsForPlayer` returns `!!state.turn.startWindow` in the `'Start'` phase.
- Behaviour (spec): when a turn begins (`enterNextPhase` with a new turn number, after the face-down handling) and `startWindowOpens(new owner)`, the state enters phase `'Start'` with `turn.startWindow = true`; the `TurnAdvancedEvent` is logged (with its triggers as today) but the Start `PhaseChangedEvent` and its after-triggers are NOT yet. The same applies to the first turn after the last `ChooseGeneralsAction`. While `turn.startWindow`, `getLegalActions` for the owner returns `[EndPhaseAction, ...hiddenGeneralReveals(state, seatId)]` (and nothing for other seats, as for any phase). `EndPhaseAction` in the `'Start'` phase with `startWindow` clears the flag, then logs the Start `PhaseChangedEvent` and gathers its triggers exactly as `enterNextPhase` does today (use `logWithTriggers`); `EndPhaseAction` outside Play remains an error unless this window is open.
- A reveal inside the window uses the existing `RevealGeneralAction` resolution; the window stays open (the owner may reveal the other General or continue). A General revealed there takes part in that Start (its triggers are gathered when the Start event happens).

- [ ] **Step 1: Write the failing tests** in `turnStartWindow.spec.ts` (use the registry/mode stubs of `resolve.spec.ts`; give the next owner `players[].kind = 'human'` and a hidden General):
  - `it('a human with a hidden General waits before the Start event')`: after the previous turn's End, `state.phase === 'Start'`, `turn.startWindow === true`, no `PhaseChangedEvent` for Start in the log yet, `phaseWaitsForPlayer` is true, legal actions are EndPhase plus one Reveal per hidden slot.
  - `it('continuing runs the Start effects and moves on')`: after `EndPhaseAction`, the Start event is logged, triggers ran, `startWindow` is gone, and the game proceeds to the Play Phase.
  - `it('a General revealed in the window fires its Start trigger in that Start')`: a stub skill with an `after:PhaseChangedEvent` Start trigger on a hidden General; reveal it in the window, continue, the trigger's effect happens exactly once.
  - `it('both Generals can be revealed in one window')`.
  - `it('a bot seat never waits')`, `it('a seat with both Generals revealed never waits')`, `it('an eliminated seat or a face-down seat's turn never opens the window')`.
  - `it('the first turn after General selection opens the window for a human')`.
  - `defaultActions.spec.ts`: `it('a timeout at the Start window submits End Phase')` (`defaultActionsFor` already prefers `EndPhaseAction`; this pins it with Reveal actions present).

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects engine -t 'Start window|waits before the Start|first turn after General selection'`
Expected: FAIL.

- [ ] **Step 3: Implement** `Turn.startWindow`, `startWindowOpens`, the `phaseWaitsForPlayer` change, the two entry points, the legal actions and the `EndPhaseAction` close. Keep `TurnAdvancedEvent`/face-down/skip handling as it is.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects engine content bots sim`
Expected: PASS. Bot-only seeded games must be unaffected: run the seeded-game hash comparison of Task 6 early if any sim spec changes.

- [ ] **Step 5: Commit**

```bash
git add projects/engine
git commit -m "feat(engine): a human may reveal a General as their turn begins, before the Start effects"
```

### Task 5: The Start window in the UI

**Files:**
- Modify: `projects/app/src/app/labels.ts` (`actionLabel` for `EndPhaseAction`), `projects/app/src/app/i18n/en.ts` and `vi.ts`, and any board component that assumes the phase is Play when showing the End Phase control (`projects/app/src/app/game-board/phase-indicator.ts` ~line 27, `action-list.ts`, `game-board.ts`: find them with a grep for `'Play'` and `endPhase`)
- Test: `projects/app/src/app/labels.spec.ts` (+ `labels.vi.spec.ts`), `phase-indicator.spec.ts`, `game-board.spec.ts`

**Interfaces:**
- Consumes: Task 4's waiting state (`state.turn.startWindow`, phase `'Start'`).
- Behaviour: while the viewer's seat is in its Start window, `EndPhaseAction` is labelled `Continue` (a new key `label.action.continue`; English Title Case, Vietnamese sentence case draft) instead of `End Phase`; the avatar's Reveal buttons (Task 3) are enabled by the engine's offered actions; the phase indicator names the Start phase and does not show "End Phase"; the existing decision timer treats the window like any other waiting decision. No rule logic in the UI.

- [ ] **Step 1: Write the failing tests:** `actionLabel` of `EndPhaseAction` is `Continue` in phase `Start` and `End Phase` in `Play` (English and Vietnamese); the phase indicator in a Start window does not offer `End Phase`; the board shows the Continue button and the avatar Reveal buttons for a viewer whose seat is in its window (use the existing `game-board.spec.ts` harness with a state having `turn.startWindow`).

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects app -t 'Continue|Start window'`
Expected: FAIL.

- [ ] **Step 3: Implement** the label, the keys, and whatever board adjustment the tests show is needed.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects app && npm run i18n:status && npx tsc -p projects/app/tsconfig.app.json --noEmit`
Expected: PASS and no type errors.

- [ ] **Step 5: Commit**

```bash
git add projects/app
git commit -m "feat(app): the Start window shows Continue and the Reveal buttons"
```

### Task 6: Whole-branch verification

**Files:** none (a fix to an earlier task if something fails).

- [ ] **Step 1: Run the whole suite**

Run: `npx jest`
Expected: all pass.

- [ ] **Step 2: Sim, Postgres specs, type-checks**

Run: `npx jest --selectProjects sim && npm run test:db && npm run typecheck:server && npx tsc -p projects/app/tsconfig.app.json --noEmit`
Expected: PASS and no type errors. (`my_sanguosha-db-1` on port 5433 is the project database; never touch `staffing-*` containers.)

- [ ] **Step 3: Hash comparison against the pre-branch commit**

Seeded 4-bot games (seeds 1-4, up to 200 moves, helpers as in `server/src/game/engineGame.spec.ts`; seats Ann/Bo/Cy/Di, kind `'bot'`, rules `{}`): final `stateHash` at the pre-branch commit and at HEAD. Seeds whose games contain no Sun Jian must be equal (a bot seat never waits and never reveals); report both hash columns, and for any difference say whether the game contains Sun Jian. Also replay the old recordings at HEAD with `checkHashes` on and report which fail (games with Sun Jian, or with a Start window, are the accepted `outdated` cases).
