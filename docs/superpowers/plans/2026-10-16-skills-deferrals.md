# Skills Deferrals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the skill-engine, General-skill, bot and wording deferrals that still reproduce (S1-S3, S6-S15d in the spec).

**Architecture:** Small, local fixes. One new generic engine effect (`FireSkillTriggersEffect`) and one new engine helper (`heldSkills`); everything else is content, bot and app wording changes with their own specs. The engine names no card or skill.

**Tech Stack:** TypeScript, Jest (`npx jest --selectProjects engine content bots app`), Angular 22 for the wording tasks.

**Spec:** `docs/superpowers/specs/2026-10-16-skills-deferrals-design.md` (the stage 8/10/11 specs stay the authority for rule text).

## Global Constraints

- The engine stays framework-free and names no card or skill.
- Decision ids and recorded action shapes do not change. Games in progress at deploy may stop as `outdated` (accepted).
- Rules in the spec are written before code; each task restates its rule as its spec.
- UI text follows CLAUDE.md: Title Case for buttons/labels, sentence case for sentences, keywords keep capitals; Vietnamese is sentence case everywhere and new Vietnamese text is a draft (update `vi.ts` / `vi` locale files alongside every English change; `npm run i18n:status` must still run).
- Blockade stays as it is. Do not touch decision ids (`ask-…`).
- Shell is zsh: quote globs.

## Review Focus

- An ask-based hidden-General skill must reveal exactly once (the ask already reveals; auto-reveal must not add a second reveal).
- Zuo Ci's Form chosen at Start fires its Start trigger exactly once, and a Form skill already held does not fire twice.
- A Bewilder claim that fails with no legal answer left must still resolve the guarded effect (a Sha still hits); the game must not stall with the window set aside.
- Cancelling Alliance's second pick or its discard refunds the use: the seat can use Alliance again the same turn; the General stays revealed.
- A bot with 4 or fewer cards and a true Bewilder claim still uses it; a bot with a Peach as its only eligible card for Blaze still discards it.

---

### Task 1: Auto-reveal for hidden triggers (S1) and the `onSelect` guard spec (S3)

**Files:**
- Modify: `projects/engine/src/lib/pipeline/resolve.ts` (`afterTriggerFollowUps`, `rewriteEffect`)
- Test: `projects/engine/src/lib/pipeline/triggerReveal.spec.ts` (create); `projects/engine/src/lib/pipeline/selection.spec.ts` (S3 specs)

**Interfaces:**
- Produces (module-private in `resolve.ts`): `function revealFor(gathered: GatheredTrigger, outputs: readonly unknown[]): Effect[]`. Returns `[{ kind: 'RevealGeneralEffect', seatId: owner.seatId, slot: owner.slot, forAbilityId: owner.skillId }]` when `gathered.needsReveal && gathered.owner?.kind === 'general'`, `outputs.length > 0`, and no output has `kind` `'AskUseEffect'` or `'RevealGeneralEffect'`; otherwise `[]`.
- Behaviour: in `afterTriggerFollowUps` the result of `revealFor` is placed in front of that trigger's follow-ups. In `rewriteEffect` (before-triggers) a non-empty `revealFor` result throws `Error(\`${owner.skillId} needs a reveal but returns direct effects from a before-trigger\`)` (a loud content bug; a before-trigger cannot place a reveal ahead of the effect it rewrites). The builder reports whether any current content hits either path.

- [ ] **Step 1: Write the failing tests** in `triggerReveal.spec.ts` (use a stub registry with one General whose skill has `needsReveal` because its slot is hidden, like `redact.spec.ts`/`resolve.spec.ts` helpers do):
  - `it('reveals a hidden General before a non-ask after-trigger fires')`: the skill's `after:` trigger returns a plain effect; after resolving the event the seat's slot is `revealed: true` and the effect ran after the `GeneralRevealedEvent`.
  - `it('does not reveal twice for an ask-based trigger')`: the trigger returns `ask(...)`; choosing Use yields exactly one `GeneralRevealedEvent`.
  - `it('does not reveal a General that is already face up')`.
  - `it('throws for a before-trigger of a hidden General that returns direct effects')`.
  In `selection.spec.ts`: `it('throws when an onSelect effect opens a decision')` (message contains "opened a decision") and `it('does not throw when an onSelect reveal follow-up is only queued')`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects engine -t 'reveals a hidden General|reveal twice|onSelect'`
Expected: the reveal and throw tests FAIL; the S3 specs may already pass (the guard exists).

- [ ] **Step 3: Implement `revealFor`** and use it in the two places above.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects engine content`
Expected: PASS, no existing spec regresses (a regression means content with a hidden optional trigger that returns direct effects: report it, do not hide it).

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/pipeline
git commit -m "fix(engine): a hidden General's optional trigger reveals it before it fires"
```

### Task 2: Gained and Form skills fire on death (S9)

**Files:**
- Modify: `projects/engine/src/lib/skills/generalSkills.ts` (add `heldSkills`), `projects/engine/src/lib/skills/triggers.ts` (the after-death loop, ~lines 40-52)
- Test: `projects/engine/src/lib/skills/triggers.spec.ts`; `projects/content/src/lib/generals/mountain*.spec.ts` (Heartbroken)

**Interfaces:**
- Produces: `export function heldSkills(state: GameState, seatId: string, registry: ContentRegistry): Array<{ owner: GeneralOwner; skill: SkillDefinition }>`: every skill the seat holds regardless of elimination, hiddenness or silencing: printed skills of both Generals (owner slot = its slot), `seat.gainedSkills` entries (via `findSkill`, owner slot = the entry's slot), and `seat.forms.chosen` (skill from `registry.generals.get(chosen.generalId)`, owner slot = `seat.forms.slot`), no duplicates by `(skill.id, slot)`. `skillsInPlay` is unchanged.
- The after-death loop uses `heldSkills(state, gone.id, registry)` instead of reading only printed Generals, still requiring `skill.afterDeath && !skill.lord` and `!gone.silenced`.

- [ ] **Step 1: Write the failing tests.**
  - `triggers.spec.ts`: `it('gathers an afterDeath skill held as a chosen Form')` and `it('gathers an afterDeath skill gained for good')`: a seat eliminated at `after:SeatEliminatedEvent` yields the trigger with the right owner slot.
  - Heartbroken spec (Mountain): `it('silences the killer when Zuo Ci holds Heartbroken as his chosen Form')`: Zuo Ci with `forms.chosen = { generalId: 'cai-wenji', skillId: 'heartbroken' }` dies to a killer; the killer is `silenced`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects engine content -t 'afterDeath|Heartbroken'`
Expected: the Form/gained tests FAIL.

- [ ] **Step 3: Implement `heldSkills`** and switch the after-death loop to it.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects engine content`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/skills projects/content/src/lib/generals
git commit -m "fix(engine): after-death skills held as gained or Form skills fire on death"
```

### Task 3: A Form chosen at Start fires in that Start (S10)

**Files:**
- Modify: `projects/engine/src/lib/pipeline/effects.ts` (add the effect type to the `Effect` union), `projects/engine/src/lib/pipeline/resolve.ts` (resolve it, it needs the registry), `projects/content/src/lib/generals/mountain.ts` (Incarnation), `projects/content/src/lib/shared/forms.ts` if `chooseForm` lives there or in `mountain.ts` (~line 590)
- Test: `projects/engine/src/lib/pipeline/fireTriggers.spec.ts` (create); `projects/content/src/lib/generals/mountain*.spec.ts`

**Interfaces:**
- Produces: effect `{ kind: 'FireSkillTriggersEffect'; owner: GeneralOwner; point: TriggerPoint; subject: GameEvent }`. Resolved in `resolve.ts` (like `SkillStepEffect`, it needs the registry): gather with `gatherTriggeredSkills(state, ctx.registry, ctx.mode, point, subject)`, keep only entries whose `owner` is the same ability owner (`sameAbilityOwner`), and `queueFront` their `trigger.effect(...)` outputs for `subject`. Applies nothing else and logs nothing. `applyEffect` in `effects.ts` throws the usual "needs the registry" error for it.
- Content: Incarnation's three triggers pass the triggering event through the step data (`skillStep(owner, 'choose', { event })`); `onStep` hands it to `chooseForm`, whose chosen option appends `{ kind: 'FireSkillTriggersEffect', owner: <GeneralOwner of the new Form skill: seatId, slot = seat.forms.slot, skillId>, point: \`after:${event.kind}\`, subject: event }` after `ChooseFormSkillEffect` and `used(owner, 'incarnated')`.
- Rule (spec S10): a Form skill chosen at the start of his turn takes part in that same Start; only the new skill's after-triggers for that event fire, once; before-triggers of that event are not replayed.

- [ ] **Step 1: Write the failing tests.**
  - `fireTriggers.spec.ts`: `it('queues only the named owner's triggers for the subject event')` and `it('does nothing when the owner holds no trigger at that point')`.
  - Mountain spec: `it('a Start-trigger skill chosen at Zuo Ci's Start fires once at that Start')` using a test Form skill with an `after:PhaseChangedEvent` Start trigger; and `it('the same skill does not fire twice at a later Start')`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects engine content -t 'queues only the named owner|chosen at Zuo Ci'`
Expected: FAIL (effect unknown; trigger missed).

- [ ] **Step 3: Implement** the effect, its resolution, and the Incarnation change.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects engine content`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/pipeline projects/content/src/lib
git commit -m "fix(engine,content): a Form skill chosen at Start fires in that Start"
```

### Task 4: Layering and registry cleanups (S13, S14, S2)

**Files:**
- Modify: `projects/engine/src/lib/registry/types.ts` (~line 149), `projects/content/src/lib/cards/sha.ts` (~line 98), `projects/content/src/lib/cards/equipment/sky-scorcher.ts`, `projects/content/src/lib/shared/judgments.ts`, `projects/content/src/lib/generals/wind.ts` (~lines 244-246)
- Test: `projects/content/src/lib/shared/judgments.spec.ts` (create), `projects/content/src/lib/lordFlags.spec.ts` (create); existing Sky Scorcher and Dark Magic specs

**Interfaces:**
- Produces: `AbilityModifiers.extraTargetsWhenLastCard?: Record<string, number>` replaces `extraShaTargetsWhenLastCard`. Sky Scorcher sets `{ sha: 2 }` (its current value); `sha.ts` reads `a.modifiers?.extraTargetsWhenLastCard?.['sha'] ?? 0`.
- Produces: `JUDGMENT_CHANGERS` in `shared/judgments.ts` contains `'devil'` and `'dark-magic'` from the same file (move the black-cards function `blackCards` into `judgments.ts`, built from the shared `ownCards` and `colourFor` helpers); `wind.ts` no longer calls `.set` and imports `blackCards` from `judgments.ts` for Dark Magic's own use.

- [ ] **Step 1: Write the failing tests.**
  - `judgments.spec.ts`: `it('registers Dark Magic without importing the Wind Generals')` (import only `./judgments`; `JUDGMENT_CHANGERS.has('dark-magic')`).
  - `lordFlags.spec.ts`: `it('every skill's lord flag in the General data matches its SkillDefinition')`: for every General in the data (`generalsData`) and every skill in it, `Boolean(dataSkill.lord) === Boolean(registry.generals.get(general.id)?.skills.find((s) => s.id === skillIdOf(dataSkill.name))?.lord)`; also fails with a message naming the General when a skill is missing from the registry.
  - Engine/content type check: the Sky Scorcher spec still passes with the renamed field (it fails to compile until renamed).

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects content -t 'Dark Magic without|lord flag'`
Expected: Dark Magic test FAILS; the lord guard may pass (it guards drift) — if it fails, it found real drift: fix the data or definition and say which.

- [ ] **Step 3: Implement** the rename, the move and the registration.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects engine content`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/engine/src/lib/registry projects/content/src/lib
git commit -m "refactor(content): modifiers name no card; judgment changers registered in one place; a Lord-flag guard spec"
```

### Task 5: Bewilder re-opens only when answerable (S11, content)

**Files:**
- Modify: `projects/content/src/lib/generals/wind.ts` (the `reveal` branch of Bewilder's `onStep`, `reopen`/`discard` at ~lines 338-355)
- Test: `projects/content/src/lib/generals/wind*.spec.ts` (Bewilder specs; follow their helpers)

**Interfaces:**
- Produces (module-private): `function afterFailedClaim(state: GameState, claim: Claim, discardedId: string, registry: ContentRegistry): Effect[]`. With no `claim.window` it returns `[]`. Otherwise it simulates the window with the claimed card gone: `getLegalActions({ ...stateWithoutCard, pendingResponse: claim.window }, claim.window.respondingSeatId, registry)` (from `engine`); if any returned action has `kind !== 'PassAction'` it returns `[{ kind: 'OpenResponseEffect', pendingResponse: claim.window }]`, else `[claim.window.context.effect]` (exactly what a Pass queues in `resolve.ts`). Use it for both discard paths: a failed lie and a true claim on a non-heart.

- [ ] **Step 1: Write the failing tests** (the Bewilder spec already stages a claim with a window; add):
  - `it('a failed lie with no other answer resolves the guarded effect without re-opening the window')`: answering a Sha's Shan window with an empty hand otherwise; after the doubt round the Sha's hit resolves (target loses HP) and `pendingResponse` is null.
  - `it('a failed lie re-opens the window when the seat still has a legal answer')`: with a Shan in hand the window is open again.
  - `it('a true claim on a non-heart with no other answer resolves the guarded effect')`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects content -t 'failed lie|non-heart'`
Expected: the empty-hand tests FAIL (the window re-opens).

- [ ] **Step 3: Implement `afterFailedClaim`** and replace the two `...reopen` uses on the discard paths.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects content`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/content/src/lib/generals
git commit -m "fix(content): a failed Bewilder claim re-opens the window only when the seat can still answer"
```

### Task 6: Alliance cancel and refund (S12, content)

**Files:**
- Modify: `projects/content/src/lib/generals/forest.ts` (`alliance`, ~lines 305-345)
- Test: `projects/content/src/lib/generals/forest*.spec.ts` (Alliance specs)

**Interfaces:**
- Behaviour: the `second` choice gets a cancel option `{ id: 'cancel', shows: { kind: 'label', text: 'Cancel' }, effects: [{ kind: 'IncrementEffect', scope: 'turn', key: abilityUseKey(owner), by: -1 }] }` appended after the seat options (use `abilityUseKey` from `engine`). The `pay` card selection gets `onCancel: [<the same refund effect>]`. Step order, decision ids and action kinds are unchanged. The General stays revealed.

- [ ] **Step 1: Write the failing tests.**
  - `it('cancelling at the second pick refunds the use')`: after the first pick and the `second` choice, choose `cancel`; `turn.abilityUses` for Alliance is back to 0 and `getLegalActions` offers `UseSkillAction` for Alliance again.
  - `it('cancelling the discard selection refunds the use and swaps nothing')`: hands unchanged, count refunded.
  - `it('the General stays revealed after a cancel')`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects content -t 'Alliance'`
Expected: the cancel tests FAIL.

- [ ] **Step 3: Implement** the cancel option and `onCancel`.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects content`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/content/src/lib/generals
git commit -m "fix(content): Alliance can be cancelled at its second pick and discard, refunding the use"
```

### Task 7: Bot fixes (S6, S11 bot, S12 bot, S15b, S15c)

**Files:**
- Modify: `projects/bots/src/lib/skills.ts` (`leastShownSuit` ~148; `conversionSpare` ~241; `skillChoice` Marriage/Displace/Sow Discord ~160-175), `projects/bots/src/lib/fire.ts` (Blaze ~106), `projects/bots/src/lib/forest.ts` (Alliance second pick ~85-90)
- Test: `projects/bots/src/lib/*.spec.ts` next to each (`skills.spec.ts`, `fire.spec.ts`, `forest.spec.ts`)

**Interfaces:**
- `leastShownSuit(view, seatId)` also counts the `card`s of `CardShownEvent`s whose `seatId` matches (field names per `engine/src/lib/pipeline/events.ts`).
- `conversionSpare`: for a deferred conversion, the bot always may make a true claim; it may bluff only with `handCards(view, me).length > 4`. The builder reads how the claimed card is chosen so that a true claim stays possible with 4 or fewer cards.
- Alliance second pick (`skillChoice`, `case 'alliance'`): among offered seats, keep those whose cost `abs(hand(first) - hand(seat))` is 2 or less; prefer the non-ally with the largest hand, then any other kept seat; if none, return the `cancel` option id (Task 6 adds it).
- Marriage (helpful: wants an ally), Displace and Sow Discord (harmful: want a non-ally): when no suitable seat is offered, return the decision's cancel option id if the choice has one; otherwise the least harmful seat offered (for a helpful effect the seat that gains least, for a harmful effect the seat that is hurt least, i.e. an ally). Never `seats[0]` by position.
- Blaze (`blaze-shown`, `blaze-hit` selections): `leastUseful(...)` over the eligible cards with Peaches excluded, unless a Peach is the only eligible card.

- [ ] **Step 1: Write the failing tests** (one `it` each, with the existing view/choice builders in each spec):
  - `leastShownSuit counts shown cards`: a log with 3 shown hearts and 1 played spade makes hearts not the least shown.
  - `a bot with 3 cards makes a true Bewilder claim`, and `does not bluff with 3 cards`, `may bluff with 5`.
  - `Alliance: the second pick keeps the cost at 2 or less`, `Alliance: with no partner at cost 2 or less the bot cancels`.
  - `Marriage with no ally offered cancels when it can`, `Displace with only allies offered cancels when it can`.
  - `Blaze never discards a Peach while another card is eligible`, `discards the Peach when it is the only eligible card`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects bots`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement** the five bot changes.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects bots sim`
Expected: PASS; also note the sim time (it was about 11 s) — report any large change.

- [ ] **Step 5: Commit**

```bash
git add projects/bots/src/lib
git commit -m "fix(bots): shown suits counted, true Bewilder claims, Alliance cost cap, sane fallbacks, Blaze keeps its Peach"
```

### Task 8: History lines for Refusing Death and Fantasy (S7)

**Files:**
- Modify: `projects/app/src/app/game-board/action-history.ts` (`stays-alive` ~240, `matched` ~242; a Fantasy handler near `moved` ~239), `projects/app/src/app/i18n/en.ts`, `projects/app/src/app/i18n/vi.ts`
- Test: `projects/app/src/app/game-board/action-history.spec.ts` (~494-498 hold the current Refusing Death lines); the matching `*.vi.spec.ts`

**Interfaces:**
- English lines (the stage 8 spec; casing per CLAUDE.md): Refusing Death no match: `Seat 1's Refusing Death: 7 ♠ (no match)`; matched: `Seat 1's Refusing Death: 7 ♠ matched`; Fantasy: `Seat 1's Fantasy moved the damage to Seat 3`. The card shown is the turned card (it is public: it lies face up in the pile; take it from the same `CardsTurnedUpEvent`/pile move the engine logs). Vietnamese lines follow its own sentence-case rules and are drafts.
- Fantasy needs an identifiable ability outcome: if the skill's `used(...)` event lacks a distinguishing outcome with the target seat, add the outcome in `content/src/lib/generals/wind.ts` (`'moved-damage'` with `targetSeatId`) and read it in `action-history.ts`.

- [ ] **Step 1: Write the failing tests** in `action-history.spec.ts`: the two Refusing Death lines (`['Seat 0's Refusing Death: 7 ♠ (no match)']` and `… 7 ♠ matched`) and `['Seat 1's Fantasy moved the damage to Seat 3']` for a staged sequence (follow the neighbouring specs); the same in Vietnamese in the `vi` spec.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects app -t 'Refusing Death|Fantasy'`
Expected: FAIL.

- [ ] **Step 3: Implement** the lines, catalog keys in `en.ts` and `vi.ts`, and the Fantasy outcome if needed.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects app content && npm run i18n:status`
Expected: PASS; the status command still runs.

- [ ] **Step 5: Commit**

```bash
git add projects/app projects/content
git commit -m "feat(app): Refusing Death and Fantasy history lines follow the stage 8 spec"
```

### Task 9: Instigate wording (S8) and the selection-text key (S15d)

**Files:**
- Modify: `projects/app/src/app/i18n/en.ts` (~288), `projects/app/src/app/i18n/vi.ts`, the Pass button label for responses (find where the Response dialog labels Pass: `projects/app/src/app/game-board/response-*.ts`), `projects/content/src/lib/display.ts` (`STEP_SELECTION_TEXT` ~200, `stepSelectionText` ~210), the Vietnamese prose (`projects/content/data/locales/vi/prose.json` `stepSelection`), `projects/app/src/app/game-board/ability-description.ts` (~128-130)
- Test: `projects/app/src/app/game-board/response-description.spec.ts`, `ability-description.spec.ts`, `projects/content/src/lib/display.spec.ts`

**Interfaces:**
- Instigate window: prompt `Use a Sha on Jiang Wei` (sentence case; `{target}` becomes the Instigate user's name, keep `{sha}` as the card keyword), Pass button `Pass (Discard 1 Card)` in English (button: Title Case) shown only in Instigate windows; Vietnamese in its sentence case.
- `stepSelectionText(step: string, locale = 'en', skillId?: string)`: looks up `${skillId}/${step}` first, then `step`. `STEP_SELECTION_TEXT` entry `pay` becomes `'alliance/swap'`; the generic `compete-*` and `blaze-*` entries stay. `describeSelection` passes `then.step.owner.skillId` for a skill-step. Vietnamese `stepSelection` keys are renamed to match (`pay` → `alliance/swap`) with the same text.

- [ ] **Step 1: Write the failing tests.**
  - `response-description.spec.ts`: the Instigate window prompt equals `Use a Sha on Jiang Wei` and the Pass label equals `Pass (Discard 1 Card)`; Vietnamese counterpart.
  - `display.spec.ts`: `stepSelectionText('swap', 'en', 'alliance')` returns the Alliance discard text; `stepSelectionText('swap', 'en', 'someone-else')` returns null; `stepSelectionText('pay', 'en')` returns null.
  - `ability-description.spec.ts`: Alliance's discard selection (step `swap`) shows `Choose cards to discard for Alliance` with confirm `Discard`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx jest --selectProjects app content -t 'Instigate|stepSelectionText|Alliance'`
Expected: FAIL.

- [ ] **Step 3: Implement** the wording, the keyed lookup and the Vietnamese renames.

- [ ] **Step 4: Run to verify they pass**

Run: `npx jest --selectProjects app content && npm run i18n:status`
Expected: PASS; `catalogs.spec.ts` (placeholder parity) stays green.

- [ ] **Step 5: Commit**

```bash
git add projects/app projects/content
git commit -m "feat(app): Instigate window wording; selection text keyed on skill and step"
```

### Task 10: Whole-branch verification

**Files:** none (a fix to an earlier task if something fails).

- [ ] **Step 1: Run the whole suite**

Run: `npx jest`
Expected: all pass (about 2780 tests).

- [ ] **Step 2: Run the sim leak property check and Postgres specs**

Run: `npx jest --selectProjects sim && npm run test:db`
Expected: PASS. (`my_sanguosha-db-1` on port 5433 is the project database; never touch `staffing-*` containers.)

- [ ] **Step 3: Type-check**

Run: `npm run typecheck:server && npx tsc -p projects/app/tsconfig.app.json --noEmit`
Expected: no errors.

- [ ] **Step 4: Compare plain-game hashes against the pre-branch commit**

As the Engine work did: seeded 4-bot games (seeds 1-4, up to 200 moves) have equal final state hashes at the pre-branch commit and at HEAD. Report both columns. If a hash differs, say which task caused it.
