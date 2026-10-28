# Elemental Damage, Fire and Lightning Attack, Blaze and Chains Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fire and thunder damage, Fire Attack and Lightning Attack (elemental Sha), dealt Blaze, working Chains with full propagation, Wood Armor's fire weakness, and thunder Lightning.

**Architecture:** The engine gains generic chain state and propagation over damage natures (it names no card). Content adds the elemental Sha (a nature on the card as played, reusing Sha's steps), Chains, and the nature changes to Blaze, Lightning and Wood Armor. Bots and the app follow.

**Tech Stack:** TypeScript, Jest, Angular 22 (signals, standalone), i18n en/vi catalogs.

**Spec:** `docs/superpowers/specs/2026-10-16-elemental-damage-and-chains-design.md` (approved 2026-10-16). Read it first; its Decisions are the binding rule text.

## Global Constraints

- The engine names no card or skill; chain state and propagation are generic (CLAUDE.md).
- UI holds no rules; it shows engine state and legal actions.
- UI text: English Title Case for names and labels, sentence case for sentences; Vietnamese sentence case; new Vietnamese is a draft (`npm run i18n:status`).
- A card played as itself keeps its nature; a card a skill converts to Sha is a plain Sha (spec "Details of propagation").
- Propagated damage: original amount = the amount when the damage is created (source-side bonuses included, target-side changes excluded); same nature, source and cause; the target applies only its own effects; never propagates again; Black Pommel's armor-ignoring does not follow it.
- The deck gains 5 Fire Attack, 9 Lightning Attack, 3 Blaze, 6 Chains; every seeded hash changes, so specs that pin deck contents or hashes are updated in the task that changes the deck.
- Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Tests first (RED), then code, then the whole `npx jest`.
- Project Postgres is `my_sanguosha-db-1` on port 5433; never touch `staffing-*` containers.

## Review Focus

Failure modes the spec implies that no task's tests would otherwise exercise (each is pinned in the task that owns the code):

1. A chained seat dies from the first fire damage: the others are still damaged, in order, and a dead seat is skipped later (Task 1).
2. A chain with a seat that gets unchained or eliminated mid-propagation (Task 1).
3. Plain damage to a chained seat: no propagation, the seat stays chained (Task 1).
4. Damage prevented to 0 (Ice Sword) or a dodged Fire Attack: no unchaining, no propagation (Task 1, Task 2).
5. A Wine-boosted Fire Attack on a chained pair: the others take the boosted original amount (Task 3).
6. A Fire Attack played through a Wusheng-style conversion is plain (Task 2).
7. Chaining the same seat twice in one card (two targets are distinct seats) and chaining a seat with hidden Generals (Task 4).
8. An empty draw pile when Chains is recast (Task 4; the reshuffle rule already applies).

---

### Task 1: Engine — chain state and propagation

**Files:**
- Modify: `projects/engine/src/lib/domain/types.ts` (Seat, Damage), `projects/engine/src/lib/pipeline/effects.ts`, `projects/engine/src/lib/pipeline/resolve.ts`, the events union, redaction/serialization if a field must be listed, the elimination path that clears per-seat state.
- Test: new `projects/engine/src/lib/pipeline/chains.spec.ts`; extend the sim leak/invariant specs if they enumerate fields.

**Interfaces:**
- Produces: `Seat.chained?: true`; `Damage.base?: number` (the amount at creation) and `Damage.chained?: true` (marks a propagated hit); `Effect` `{ kind: 'SetChainedEffect'; seatId: string; chained: boolean }` and an event `ChainToggledEvent { seatId, chained }` logged when the state actually changes; `isChained(state, seatId): boolean` exported from the engine for content and bots.
- Consumes: the existing `DamageEffect`, `resolveEffect` and `afterTriggerFollowUps`.

- [ ] **Step 1: Write failing tests (`chains.spec.ts`)** using the engine's own test fixtures with plain seats and `DamageEffect`s (no card ids):
  - `SetChainedEffect` chains and unchains and logs `ChainToggledEvent` only on change.
  - Two chained seats A, B and a third unchained C: 2 thunder damage to A leaves A unchained, damages B by 2 (unchained afterwards), never touches C; fire behaves alike.
  - Plain damage to a chained seat: no propagation, still chained.
  - Order: with chained A, C, D (seat order A, B, C, D) damage to A damages C then D; damage to C damages D then A (starting after the damaged seat).
  - Original amount: a first `DamageEffect` of amount 2 rewritten to 3 by a before-trigger (test registry) still propagates 2; each propagated hit applies a before-trigger of its own (a +1 trigger on seat C makes C take 3).
  - Propagated damage does not propagate again (a third chained seat is hit exactly once by one wave).
  - Seat dies during its own hit (dying round with no rescue): the wave continues to the next living chained seat; a seat eliminated before its turn is skipped; a seat unchained before its turn is skipped.
  - Damage reduced to 0 by a before-trigger: the seat stays chained and nothing propagates.
  - Elimination clears `chained`.
  - Game end mid-wave stops the wave (no throw).

- [ ] **Step 2: Run to confirm they fail.** `npx jest --selectProjects engine -t chain`

- [ ] **Step 3: Implement.**
  - `resolveEffect`: for a `DamageEffect` without `damage.base`, stamp `base = amount` before the before-triggers run.
  - `applyEffect` `DamageEffect`: when the target is chained, the nature is fire or thunder and the amount after rewrites is above 0, clear `chained` and log `ChainToggledEvent`.
  - After the damage's event follow-ups (the skills' reactions, the dying round), queue one `ChainPropagationEffect { damage; remaining: string[] }` as the LAST of the follow-ups, so everything those follow-ups spawn runs first (newer items are queued in front of it). `remaining` = the other living chained seats in turn order starting after the damaged seat, taken when the first damage completed. The propagation effect, when it runs, takes the first remaining seat: if it is still living and still chained, queue `[DamageEffect { damage with target: that seat, amount: damage.base, chained: true, base: damage.base }, ChainPropagationEffect(rest)]`; otherwise continue with the rest. Only damage without `chained: true` starts a wave.
  - Clear `chained` when a seat is eliminated.
  - Export `isChained`.

- [ ] **Step 4: Run** `npx jest --selectProjects engine`, then the whole `npx jest` and `npx tsc` for engine, sim and app; fix fallout (state hashes of existing seeded specs do not change yet since nothing chains).

- [ ] **Step 5: Commit.**

### Task 2: Content — Fire Attack and Lightning Attack (elemental Sha)

**Files:**
- Create: `projects/content/src/lib/cards/fire-attack.ts` and `lightning-attack.ts` (or one parameterised factory in `sha.ts`), tests in `projects/content/src/lib/cards/sha-elemental.spec.ts`.
- Modify: `projects/engine/src/lib/domain/types.ts` (`UsedCard.nature?: 'fire' | 'thunder'`), `useCard` so a card played as itself carries its definition's nature, `cards/sha.ts` (`damageOf` reads `step.card.nature ?? 'normal'`), `registry.ts`, `cards/equipment/green-dragon-blade.ts`, `wiki.ts`, and every other site that compares a physical card's `definitionId === 'sha'` or reads `'sha'` from `definitionId`/card plays.

**Interfaces:**
- Consumes: Task 1 is not needed here.
- Produces: `CardDefinition.shaNature?: 'fire' | 'thunder'` (data-driven), card ids `fire-attack` and `lightning-attack`; helper `isShaCard(registry, definitionId): boolean` in `shared/queries.ts` that is true for Sha and the elemental Sha; `UsedCard.nature` set only when the card is played as itself.

- [ ] **Step 1: Failing tests** (`sha-elemental.spec.ts`), using the content test harness (`skills.testing`): a Fire Attack deals 1 fire damage after a failed Shan; Lightning Attack 1 thunder; both count toward the one-Sha limit (a second Sha is not offered, Crossbow lifts it, Roar lifts it); Wine adds 1; a Shan answers them; Duel and Barbarians accept a Fire Attack as the Sha played; Green Dragon Blade's follow-up Sha offers Fire Attack cards; Wusheng-style conversion of a Fire Attack or any card to Sha yields a plain Sha (a spec in `shu.spec.ts` or here); Black Shield stops a black Lightning Attack; Ice Sword on a Lightning Attack still works; a dodged Fire Attack deals nothing.
- [ ] **Step 2: Run to confirm they fail.**
- [ ] **Step 3: Implement.** One shared Sha definition factory with a nature parameter (so steps stay in one place). Audit with grep: `rg "'sha'" projects/{content,bots,app}/src --glob '!*.spec.ts'` and every `definitionId === 'sha'`; each either means "the Sha card" and must use `isShaCard`, or means "as: 'sha'" and is fine. List the sites touched in the commit message.
- [ ] **Step 4: Run the whole suite**; update seeded hashes and deck-pinned specs (the deck gained 14 cards).
- [ ] **Step 5: Commit.**

### Task 3: Content — Wood Armor weakness, thunder Lightning, fire Blaze (and dealing it)

**Files:**
- Modify: `cards/equipment/wood-armor.ts`, `cards/lightning.ts`, `cards/blaze.ts` (remove `outOfDeck`; fire nature; update comments), `guozhan.ts` comment on deck, their specs (`equipment.spec.ts`, `delayed.spec.ts`, `tools.spec.ts`).
- Test: extend those specs plus `sha-elemental.spec.ts`.

**Interfaces:**
- Consumes: Task 1 (propagation, for the Wine/chain case), Task 2 (`UsedCard.nature`).
- Produces: nothing new.

- [ ] **Step 1: Failing tests:** Fire Attack on a Wood Armor wearer deals 2; Lightning Attack 1; plain Sha has no effect (as today); Black Pommel's Fire Attack deals 1 (weakness ignored) and a Black Pommel plain Sha is no longer stopped by Wood Armor (as today); Blaze's damage is fire and +1 on Wood Armor; Lightning strike is thunder 3 and propagates along a chain (`seat-a` struck, chained `seat-b` takes 3); Blaze is in a dealt deck; **Wine-boosted Fire Attack (extra 1) on a chained pair: the other seat takes the boosted original amount (2), and a Wood Armor seat takes 3**; Black Pommel's armor-ignoring does not follow the wave (the second seat's Wood Armor still adds 1).
- [ ] **Step 2: Run to confirm they fail.**
- [ ] **Step 3: Implement.** Wood Armor: `stopsSha('wood-armor', (step) => !step.card.nature)` plus a `before:DamageEffect` trigger modelled on Silver Lion that adds 1 to fire damage on its wearer unless `armorIgnored`. Lightning: `nature: 'thunder'`. Blaze: `nature: 'fire'`, drop `outOfDeck`, fix the deck-builder comment.
- [ ] **Step 4: Run the whole suite**; update deck/hash-pinned specs (3 Blaze dealt).
- [ ] **Step 5: Commit.**

### Task 4: Content — Chains and Pang Tong's Shackle

**Files:**
- Create: `projects/content/src/lib/cards/chains.ts`, spec `chains.spec.ts` (card behaviour), registration in `registry.ts`.
- Modify: `projects/content/src/lib/generals/fire.ts` (Shackle gains the Chains conversion, comment updated), `fire-shu.spec.ts`.

**Interfaces:**
- Consumes: Task 1 (`SetChainedEffect`, `isChained`), the Tool helpers (`toolOnTargets`, Wuxie flow), `untargetableBy`.
- Produces: card id `chains` (Tool, 6 printings from the data); Shackle conversion id `shackle-chains` converting 1 club hand card as `chains`, with the existing recast option kept.

- [ ] **Step 1: Failing tests:** Chains targets 1 or 2 living seats at any distance (including a seat with hidden Generals), each target toggles; a Wuxie on one target cancels only that toggle; the Recast option discards the card and draws 1 (also with an empty draw pile after a reshuffle); a seat that cannot be targeted by Tools stays out; Chains targets are offered by `legalPlayTargets` in pairs and singly; Pang Tong's Shackle offers a club as Chains and recast, both through reveal-to-use for a hidden Pang Tong; Chains cannot be used twice on the same seat in one card; history-visible events (`ChainToggledEvent`) appear in order.
- [ ] **Step 2: Run to confirm they fail.**
- [ ] **Step 3: Implement** Chains as a Tool with `targetPick` (min 1, max 2) following an existing multi-target Tool (Steal/Coerce patterns) and a Recast play option following Draw Two / Shackle patterns.
- [ ] **Step 4: Run the whole suite**; update deck/hash specs (6 Chains dealt).
- [ ] **Step 5: Commit.**

### Task 5: Bots

**Files:**
- Modify: `projects/bots/src/lib/card-play.ts`, `helpers.ts` (card values), tests under `projects/bots`.
- Test: bot specs for playing Fire Attack and Lightning Attack, ignoring Chains.

**Interfaces:**
- Consumes: Task 2's `isShaCard`.

- [ ] **Step 1: Failing tests:** the rule-based bot plays a Fire Attack or Lightning Attack as it plays a Sha (same targeting and one-per-turn rules), never plays or recasts Chains, counts Chains as a spare card for discards, and keeps the fuzz bot's behaviour (it picks any legal action; the property and sim specs still pass with Chains in the deck).
- [ ] **Step 2: Run to confirm they fail.**
- [ ] **Step 3: Implement** `case 'sha':` and the value in `helpers.ts` through `isShaCard`.
- [ ] **Step 4: Run** `npx jest --selectProjects bots` and `--selectProjects sim`.
- [ ] **Step 5: Commit.**

### Task 6: App — chain marker, history, damage words, Wiki, i18n

**Files:**
- Modify: `projects/app/src/app/game-board/seat-tile.ts` (or the avatar) for a chain marker, `action-history.ts`, `response-description.ts` (nature word), `i18n/en.ts` and `vi.ts`, `projects/content/src/lib/wiki.ts` and `display.ts`/prose for card text, Wood Armor's wiki text.
- Test: specs next to each changed file, plus the catalog parity spec.

**Interfaces:**
- Consumes: `Seat.chained`, `ChainToggledEvent`, `Damage.nature`.

- [ ] **Step 1: Failing specs:** a chained seat shows a chain marker, an unchained one does not; history lines "Seat 1 chained Hing" / "Seat 1 unchained Hing"; damage lines say "took 1 fire damage" / "thunder damage" and plain reads as today; Wiki lists Fire Attack and Lightning Attack beside Sha, with Chains and Blaze entries; Wood Armor's text mentions the fire weakness; Vietnamese strings exist as drafts and the parity spec passes.
- [ ] **Step 2: Run to confirm they fail.**
- [ ] **Step 3: Implement** following CLAUDE.md's UI text style; draft Vietnamese needs native review.
- [ ] **Step 4: Run** the whole `npx jest`, `npx tsc -p projects/app/tsconfig.app.json --noEmit`, `npm run i18n:status`.
- [ ] **Step 5: Commit.**

### Task 7: Whole-branch verification

**Files:** none (a fix to an earlier task if something fails).

- [ ] **Step 1: Run** `npx jest`; expected: all pass.
- [ ] **Step 2: Run** `npx jest --selectProjects sim && npm run test:db && npm run typecheck:server && npx tsc -p projects/app/tsconfig.app.json --noEmit`; expected: pass and no type errors.
- [ ] **Step 3: Seeded games.** Run seeded 4-bot games (seeds 1-4, up to 200 moves, helpers as in `server/src/game/engineGame.spec.ts`) at HEAD and report: games finish, no exception, chain events and elemental damage occur in at least one seed (count them). Hashes differ from the pre-branch commit by design; say so. Replay each game with `checkHashes` on and report any failure.
