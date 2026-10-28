# Kingdom Wars Cards in the Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the six Kingdom Wars-only cards (Wuxie Kingdom, Amass, Ascertain, Ally Far Attack Near, Six Swords of Wu, Trident Glaive) engine/content behaviour so the Kingdom Wars deck deals all but Fire Fan (107 cards) and plays them under the approved rules.

**Architecture:** Each card is one `CardDefinition` file under `projects/content/src/lib/cards/` (equipment under `cards/equipment/`), registered in `registry.ts`, reusing the existing Tool lifecycle (`toolOnTargets` → Wuxie check → `onTarget`), `makeEquipmentCard`, `atStep`/`askAtStep`, selections and choices. Three small engine additions: an attack-range aura modifier (Six Swords), a per-card answer condition plus a per-Tool Kingdom cancellation mark (Wuxie Kingdom), and secret card/General views in a pending choice (Ascertain).

**Tech Stack:** TypeScript, Jest (`npx jest <path>`), Angular app for names only. Engine stays framework-free.

**Spec:** `docs/superpowers/specs/2026-10-21-kingdom-wars-cards-engine-design.md` (all rules confirmed by the user; read its "Rules" and "Details settled" sections first).

## Global Constraints

- Card names: "Wuxie Kingdom" (`wuxie-guo`), "Ally Far Attack Near" (`ally-far-attack-near`), "Amass" (`amass`), "Ascertain" (`ascertain`), "Six Swords of Wu" (`wu-six-swords`), "Trident Glaive" (`trident-glaive`). Never "Negate Kingdom" or "Alliance".
- "Kingdom" = `Seat.kingdom` ('Wei' | 'Shu' | 'Wu' | 'Qun' | 'hidden'); `'hidden'` means no Kingdom. Read it live at every query.
- No central switch over card ids; engine names no card (content supplies ids). No Angular or browser APIs in `engine` or `content`. State stays plain serialisable data.
- Identity deck and Identity tests keep passing; none of the six is in Identity.
- UI text follows CLAUDE.md "UI text style" (English Title Case labels, Vietnamese sentence case); new Vietnamese is draft, `review.json` untouched; `en` and `vi` catalogs keep identical keys.
- Kingdom Wars deal: 107 cards (Fire Fan only is undealt).
- Work on a branch `feat/kingdom-wars-cards-engine`; commit after each task; commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

Inputs the spec implies that no single rule line tests; each has a test in the owning task.

1. Wuxie Kingdom used against a Tool whose later target is a hidden-General seat that is not in the Kingdom: that target is still affected (Task 5).
2. Amass user with no exposed General targets only themselves; two Kingdom mates where one dies or is cancelled mid-order (Task 6).
3. Ascertain on a target with an empty hand and both Generals exposed: option 2 is still offered and shows nothing; another seat's view never contains the looked-at cards or General (Task 8).
4. Ally Far Attack Near with the user hidden and every other seat hidden: not playable (Task 7).
5. Six Swords of Wu: leaves play (discarded/replaced) and the bonus vanishes at once; a hidden-General Kingdom mate gets nothing (Task 3).

---

### Task 1: Names and display data for Kingdom Wars-only cards

**Files:**
- Modify: `projects/content/src/lib/display.ts` (`cardDisplayData`), `projects/app/src/app/wiki/wiki-labels.ts` (drop the Kingdom Wars fallback added earlier)
- Create: `projects/content/src/lib/kingdomWarsCards.ts`
- Test: `projects/content/src/lib/display.spec.ts`

**Interfaces:**
- Produces `kingdomWarsCardIds(): string[]` and `kingdomWarsCardData(id: string): { name: string; nameZh: string; category: 'tool' | 'equipment'; subtype: 'weapon' | null; range: number | null; text: string } | null`, built from `data/decks/kingdom-wars/{cards,ids,texts.en}.json` for the six cards with `identityCardId === null`.
- `cardDisplayData(id, locale)` now also returns a result for these six ids (name from `ids.json`, text from `texts.en.json`, Vietnamese from `locales/vi/kingdom-wars-cards.json`).

- [ ] **Step 1: Write failing tests** in `display.spec.ts`: `cardDisplayData('amass')` has name `'Amass'` and a non-empty text; `cardDisplayData('wu-six-swords', 'vi')` has name `'Ngô Lục Kiếm'`; `cardDisplayData('trident-glaive')` has `range` 3 and `subtype` `'weapon'`; `cardDisplayData('nope')` is null; `kingdomWarsCardIds()` equals the six ids (sorted).
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/display` — expect FAIL.
- [ ] **Step 3: Implement** `kingdomWarsCardData`/`kingdomWarsCardIds` in `kingdomWarsCards.ts` and fall back to them in `cardDisplayData` when the id is not in `cardsData`. Remove the `kingdomWarsCardTranslation` fallback in `wiki-labels.ts` `wikiCardView` (it now goes through `cardDisplayData`), keeping `kingdomWarsCardTranslation` exported only if still used.
- [ ] **Step 4: Run** `npx jest projects/content projects/app/src/app/wiki` — expect PASS (Wiki Vietnamese specs for the six cards still pass).
- [ ] **Step 5: Commit** `feat(content): display data for the six Kingdom Wars-only cards`.

### Task 2: Kingdom helpers

**Files:**
- Create: `projects/content/src/lib/shared/kingdom.ts`
- Test: `projects/content/src/lib/shared/kingdom.spec.ts`

**Interfaces:**
- Produces: `exposedKingdom(state: GameState, seatId: string): Exclude<Kingdom, 'hidden'> | null` (null when `seat.kingdom === 'hidden'`); `sameKingdomSeatIds(state: GameState, seatId: string): string[]` — living seats in turn order from `seatId` that share its exposed Kingdom, always starting with `seatId`; if `seatId` has no Kingdom the result is `[seatId]` alone.

- [ ] **Step 1: Write failing tests** using the repo's test-state builder (copy the pattern in `shared/queries.spec.ts`): three seats (Wei revealed, Wei revealed, hidden): `sameKingdomSeatIds(first)` = `[first, second]`; for the hidden seat = `[hidden]`; a dead Wei seat is excluded; `exposedKingdom(hidden)` is null.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/shared/kingdom` — expect FAIL.
- [ ] **Step 3: Implement** both functions with `livingSeatOrderFrom` from `engine`.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom helpers`.

### Task 3: Six Swords of Wu (attack-range aura)

**Files:**
- Modify: `projects/engine/src/lib/registry/types.ts` (`AbilityModifiers`), `projects/content/src/lib/shared/queries.ts` (`attackRange`), `projects/content/src/lib/cards/equipment/index.ts` or new `projects/content/src/lib/cards/equipment/wu-six-swords.ts`
- Test: `projects/content/src/lib/cards/equipment/wu-six-swords.spec.ts`

**Interfaces:**
- Consumes: `sameKingdomSeatIds` (Task 2), `kingdomWarsCardData('wu-six-swords').range` (2).
- Produces: `AbilityModifiers.attackRangeBonusTo?(state: GameState, ownerSeatId: string, seatId: string): number` — the bonus the owner's ability gives to `seatId`'s attack range. `attackRange()` now adds, for every living seat, the sum of `attackRangeBonusTo` over that seat's active abilities. Export `wuSixSwordsCard: CardDefinition` (id `wu-six-swords`, weapon, range 2).

- [ ] **Step 1: Write failing tests:** owner (Wu, revealed) + Kingdom mate (Wu, revealed, unarmed): mate's `attackRange` is 2, owner's is 3; a Wu mate with a hidden-General Kingdom (hidden) gets 1; owner with no exposed General: owner 3, all others unchanged; other Kingdom's seat unchanged; after the sword moves to the discard pile the mate's range is back to 1 (Review Focus 5); a mate holding a range-3 weapon has 4.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/cards/equipment/wu-six-swords` — expect FAIL.
- [ ] **Step 3: Implement** the modifier type, the `attackRange` sum, and the card via `makeEquipmentCard('wu-six-swords', 'Six Swords of Wu', 'weapon', range, { abilities: { modifiers: { attackRangeBonusTo } } })` where the bonus is 1 when `seatId` is in `sameKingdomSeatIds(state, ownerSeatId)`.
- [ ] **Step 4: Run** `npx jest projects/content projects/engine` — expect PASS.
- [ ] **Step 5: Commit** `feat(engine,content): Six Swords of Wu and the attack-range aura`.

### Task 4: Trident Glaive

**Files:**
- Create: `projects/content/src/lib/cards/equipment/trident-glaive.ts`
- Test: `projects/content/src/lib/cards/equipment/trident-glaive.spec.ts`

**Interfaces:**
- Consumes: `askAtStep`/`atStep` (`shared/steps.ts`), `seatDistance`, `handOf` (`shared/queries.ts`), `OpenSelectionEffect` (see `axe.ts` for the selection shape), `DamageEffect`.
- Produces: `tridentGlaiveCard: CardDefinition` (id `trident-glaive`, weapon, range 3).

Rule: after the wearer's Slash dealt damage to a target that is still living, and the wearer holds a hand card, ask (use/don't); on use pick 1 hand card to discard, then pick one living seat at `seatDistance` 1 from the target (excluding the target; the wearer may be chosen when at distance 1); that seat takes 1 normal damage with the wearer as source. Hook after the Sha's damage resolves: copy where Gender Swords/Ice Sword hook `sha-damage`, but trigger on the damage having been dealt (a `after:DamageDealtEvent` trigger whose `damage.cause.card.as === 'sha'`), not on Duel or other damage.

- [ ] **Step 1: Write failing tests:** (a) Slash damages target, wearer uses it: card discarded, chosen neighbour at distance 1 takes 1 damage; (b) wearer chooses self at distance 1: takes 1 damage, source is themselves; (c) Duel damage does not offer it; (d) empty hand: not offered; (e) Slash kills the target: not offered (Decided: nothing happens); (f) declining leaves everything unchanged; (g) the target is never in the pick list.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement** as above.
- [ ] **Step 4: Run** `npx jest projects/content/src/lib/cards/equipment` — expect PASS.
- [ ] **Step 5: Commit** `feat(content): Trident Glaive`.

### Task 5: Wuxie Kingdom (engine mechanic + card)

**Files:**
- Modify: `projects/engine/src/lib/registry/types.ts` (`CardDefinition`), `projects/engine/src/lib/domain/types.ts` (`GameState`), `projects/engine/src/lib/pipeline/effects.ts` (new effect), `projects/engine/src/lib/pipeline/toolLifecycle.ts`, `projects/engine/src/lib/rules/legality.ts` (answer legality), `projects/content/src/lib/shared/tools.ts` (`COUNTER_CARD_IDS`)
- Create: `projects/content/src/lib/cards/wuxie-guo.ts`
- Test: `projects/engine/src/lib/pipeline/toolLifecycle.spec.ts` (or the file the existing Wuxie tests live in), `projects/content/src/lib/cards/wuxie-guo.spec.ts`

**Interfaces:**
- Produces: `CardDefinition.answerCondition?(state: GameState, pending: PendingResponse, seatId: string, registry: ContentRegistry): boolean` — when present, a card in `allowedCardIds` is only offered/accepted if it returns true. Effect `{ kind: 'CancelToolForKingdomEffect'; tool: UsedCard; kingdom: Kingdom }` that records `{ toolKey, kingdom }` in `GameState.toolCancellations?: { toolKey: string; kingdom: Kingdom }[]` (`toolKey` as `subjectKey` builds it minus the target). Rule in `applyLifecycleEffect`'s `ToolOnTargetEffect`: a target seat whose live `kingdom` matches a recorded cancellation for this tool is skipped with no Wuxie check and no rule. `ToolResolvedEffect` clears that tool's records. Export `wuxieGuoCard` (id `wuxie-guo`) and `COUNTER_CARD_IDS = ['wuxie', 'wuxie-guo']`.
- Content rule: `answerCondition` is true when the window's subject is a Tool whose target seat is a living seat with an exposed Kingdom, or when the subject is another counter card (then it acts as a plain Wuxie, no Kingdom effect). Its `play` while answering a Tool window returns `[CancelToolForKingdomEffect]` for the target seat's current Kingdom; the normal single-target cancel still happens via the existing `onAnswer`.

- [ ] **Step 1: Read** `engine/src/lib/pipeline/resolve.ts` and `rules/legality.ts` to find where an answering card's `play` is called and how `allowedCardIds` filters answers; confirm `state.pendingResponse` is readable during that `play`, and if not add the pending window to `PlayContext`.
- [ ] **Step 2: Write failing tests (engine):** a Tool queued at three targets (Wei, Wei, Qun) with the first answered by Wuxie Kingdom: the second Wei target is skipped with no Wuxie check, the Qun target is still checked and affected; a hidden-General target is still affected and never offered a skipped state (Review Focus 1); a seat that reveals as Wei after the cancel but before its turn is skipped too (Decided); `toolCancellations` is empty after the Tool resolves.
- [ ] **Step 3: Write failing tests (content):** Wuxie Kingdom is not offered against a hidden-General target; it is offered against an exposed one; answering a Wuxie with it cancels that Wuxie only (no Kingdom record); a plain Wuxie answers a Wuxie Kingdom and vice versa (my call 1); it is never playable in the Play Phase (`legalPlayTargets: () => []`).
- [ ] **Step 4: Run** `npx jest projects/engine projects/content/src/lib/cards/wuxie-guo` — expect FAIL.
- [ ] **Step 5: Implement** the types, the effect (and its apply, plus event-free logging), the lifecycle skip, the legality hook, and the card; register in Task 9.
- [ ] **Step 6: Run** `npx jest projects/engine projects/content` — expect PASS, including all existing Wuxie tests.
- [ ] **Step 7: Commit** `feat(engine,content): Wuxie Kingdom`.

### Task 6: Amass

**Files:**
- Create: `projects/content/src/lib/cards/amass.ts`
- Test: `projects/content/src/lib/cards/amass.spec.ts`

**Interfaces:**
- Consumes: `sameKingdomSeatIds` (Task 2), `toolOnTargets`, `cardStep` (`shared/steps.ts`), `OpenSelectionEffect` with `then: { kind: 'discard' }`.
- Produces: `amassCard: CardDefinition` (id `amass`). `legalPlayTargets: () => [[]]`; `play` queues `toolOnTargets` for `sameKingdomSeatIds(state, ctx.seatId)` (fixed at use; user alone when no exposed General); `onTarget` returns `DrawCardsEffect` (2) then `cardStep('amass-discard', …)`; `onStep('amass-discard')` opens a mandatory selection for the target of `min(2, cards held in hand + equipment)` cards (nothing if it holds none).

- [ ] **Step 1: Write failing tests:** two Wei mates + a Shu seat: both Wei draw 2 then discard 2 in turn order starting with the user, the Shu seat is untouched; the first target finishes drawing and discarding before the second draws (check the log order); user with hidden Generals: only the user is a target (Decided) and Amass is playable; a target cancelled by Wuxie is skipped and the rest continue; a target that dies before its turn is skipped (Review Focus 2); a target with 1 card and an empty draw pile discards what it has; the discard may include equipment.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx jest projects/content/src/lib/cards/amass` — expect PASS.
- [ ] **Step 5: Commit** `feat(content): Amass`.

### Task 7: Ally Far Attack Near

**Files:**
- Create: `projects/content/src/lib/cards/ally-far-attack-near.ts`
- Test: `projects/content/src/lib/cards/ally-far-attack-near.spec.ts`

**Interfaces:**
- Produces: `allyFarAttackNearCard: CardDefinition` (id `ally-far-attack-near`). `legalPlayTargets` offers one `[seat]` per living other seat with an exposed Kingdom that differs from the user's (every exposed other seat when the user has no Kingdom); none → `[]`. `play` is `toolOnTargets` with that single target; `onTarget` returns `DrawCardsEffect` target 1 then user 3.

- [ ] **Step 1: Write failing tests:** Wei user vs Shu exposed target: target draws 1 then user draws 3; same-Kingdom and hidden targets are not offered; a hidden user may target any exposed seat; with no exposed other seat it is not playable (Review Focus 4); one Wuxie on it cancels both draws.
- [ ] **Step 2: Run** — expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npx jest projects/content/src/lib/cards/ally-far-attack-near` — expect PASS.
- [ ] **Step 5: Commit** `feat(content): Ally Far Attack Near`.

### Task 8: Ascertain with Recast and a secret view

**Files:**
- Modify: `projects/engine/src/lib/domain/redact.ts` (a `secret` choice keeps its cards and General options visible to its chooser only), `projects/engine/src/lib/domain/types.ts` (`ChoiceOption.shows` gets `{ kind: 'general'; generalId: string }`), `projects/content/src/lib/cards/chains.ts` (generalise Recast helpers), `projects/app` (render the new option kind: General name; the card options already render)
- Create: `projects/content/src/lib/cards/ascertain.ts`
- Test: `projects/content/src/lib/cards/ascertain.spec.ts`, `projects/engine/src/lib/domain/redact.spec.ts`

**Interfaces:**
- Produces: `ascertainCard: CardDefinition` (id `ascertain`). `legalPlayTargets`: `[]`-target Recast offer (`[[]]` entry, as Chains) plus one `[seat]` per living other seat. `isRecastPlay`/`isRecast` in `chains.ts` accept `'ascertain'` as well (same no-target play, no Wuxie check, draws 1, not "use" or "discard" for reacting skills). `onTarget`: a `secret` `OpenChoiceEffect` for the user offering up to three options: "Main General"/"Deputy General" for each hidden General (shown as `{ kind: 'general' }` after picking, or only when still hidden), and "Hand Cards" always; if both Generals are exposed only "Hand Cards". Picking opens a second `secret` choice showing the cards (`shows.kind === 'card'`) or the General, with one `label` option "Done" and no effects. The shared log must show only that Ascertain was used.

- [ ] **Step 1: Write failing tests (content):** Recast discards the card and draws 1 with no Wuxie window and does not count as using a card (reuse the Chains Recast assertions); both Generals exposed → only the hand option, including with an empty hand (Review Focus 3); one hidden General → it and the hand are offered; both hidden → both slots offered; Wuxie cancels it.
- [ ] **Step 2: Write failing tests (engine redact):** for a `secret` choice owned by seat A containing seat B's hand cards and a hidden General, A's redacted view shows real card ids and the General; B's and C's views contain neither (empty options) (Review Focus 3).
- [ ] **Step 3: Run** `npx jest projects/engine/src/lib/domain/redact projects/content/src/lib/cards/ascertain` — expect FAIL.
- [ ] **Step 4: Implement** the redaction change, the option kind, the card, and the app rendering/labels for the new option (names via `generalDisplayData`).
- [ ] **Step 5: Run** `npx jest projects/engine projects/content projects/app` — expect PASS.
- [ ] **Step 6: Commit** `feat(engine,content,app): Ascertain with Recast and a secret view`.

### Task 9: Register, deal, Wiki and whole-game checks

**Files:**
- Modify: `projects/content/src/lib/registry.ts` (add the six cards), `projects/content/src/lib/wiki.spec.ts`, `projects/content/src/lib/decks.spec.ts`, `projects/content/src/lib/modes/guozhan.spec.ts`, `projects/app/src/app/wiki/wiki-pages.spec.ts`
- Test: those specs plus a new simulation spec in `projects/sim` that plays Kingdom Wars-deck games with bots to completion

**Interfaces:**
- Consumes: `wuxieGuoCard`, `amassCard`, `ascertainCard`, `allyFarAttackNearCard`, `wuSixSwordsCard`, `tridentGlaiveCard`.

- [ ] **Step 1: Update the expectations to the new truth:** the Wiki "not in the game" list becomes `['fire-fan']` (title "one is not"); `undealtCardIds` for the Kingdom Wars deck is `['fire-fan']`; the Kingdom Wars draw pile is 107.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib projects/app/src/app/wiki` — expect FAIL on those assertions only.
- [ ] **Step 3: Register** the six cards in `buildContentRegistry`.
- [ ] **Step 4: Run** `npx jest projects/content projects/app/src/app/wiki` — expect PASS.
- [ ] **Step 5: Simulation:** add a spec running N seeded bot games on the Kingdom Wars deck (follow the existing sim harness spec) and assert every game ends with a result and no engine error. Run `npx jest projects/sim` — expect PASS; if a bot cannot answer a new pending window (Ascertain's views, Amass's discard), fix the legal-action handling in `projects/bots`.
- [ ] **Step 6: Full run:** `npx jest` and `npx tsc --noEmit -p projects/app/tsconfig.app.json` — expect all pass.
- [ ] **Step 7: Browser check** with the `run` skill: start a Kingdom Wars local game, play each of the six cards at least once or say which could not be reached; say what was and was not checked.
- [ ] **Step 8: Commit** `feat: deal and play the six Kingdom Wars-only cards`.

---

## Self-review

- **Spec coverage:** Wuxie Kingdom (Task 5), Amass (6), Ascertain + Recast + private view (8), Ally Far Attack Near (7), Six Swords (3), Trident Glaive (4), names/UI (1), deal count and Wiki (9), Identity unchanged (Global Constraints, full run in 9). Bots only need legality (Task 9 step 5).
- **Types:** `sameKingdomSeatIds` (Task 2) is used in Tasks 3 and 6; `answerCondition`, `CancelToolForKingdomEffect` and `COUNTER_CARD_IDS` are defined in Task 5 and registered in Task 9; `kingdomWarsCardData` (Task 1) supplies the range in Tasks 3 and 4.
- **Known risk:** Task 5 depends on `state.pendingResponse` being readable during an answering card's `play` (Step 1 checks it).
