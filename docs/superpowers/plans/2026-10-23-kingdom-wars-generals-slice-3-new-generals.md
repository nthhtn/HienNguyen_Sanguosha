# Kingdom Wars Generals Slice 3: The 9 New Generals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gan Fu Ren, Yue Jin, Ding Feng, Ji Ling, Kong Rong, Ma Teng, Pan Feng, Tian Feng and Zou Shi play in the Kingdom Wars deck with their 15 skills exactly as confirmed.

**Architecture:** Each new General's skills are variants (`SkillDefinition`, id `kingdomWars:<skillIdOf(English name)>`) registered in `KINGDOM_WARS_VARIANTS[<record id>][<Chinese name>]`, in the per-force files from slice 2 (`kingdom-wars-wei.ts`, `kingdom-wars-shu.ts`, `kingdom-wars-wu.ts`, `kingdom-wars-qun.ts`). The 9 Generals already sit in the registry as `kingdomWars:<id>` with no skills, so registering a variant is what makes a skill playable. Three engine mechanics come first (exposure-aware Kingdoms, the killer on a dying event, hiding a General and blocking reveals); each General task then needs only content.

**Tech Stack:** TypeScript, Jest (`npm test`), engine in `projects/engine/src/lib`, content in `projects/content/src/lib` (helpers in `shared/`), test harness `generals/skills.testing.ts`.

**Spec:** `docs/superpowers/specs/2026-10-22-kingdom-wars-generals-engine-design.md` (slice 3). The binding rule text is `docs/superpowers/specs/2026-10-23-kingdom-wars-generals-slice-3-rules.md`; every skill below implements it exactly.

**Branch:** new branch `feat/kingdom-wars-generals-new` from `main` (slices 1 and 2 are merged).

## Global Constraints

- Dynasty Wars games must not change: all existing specs stay green, and a Dynasty Wars simulation is unchanged. Engine additions are optional fields or new effects that Dynasty Wars never produces.
- Variant ids are `kingdomWars:` + `skillIdOf(English skill name in the Kingdom Wars record)`; ids are unique across the registry (`findSkill`) and never equal a Dynasty Wars skill id. Ma Teng's Horsemanship is therefore `kingdomWars:horsemanship` (same modifiers as Dynasty Wars' `horsemanship`, which it lists as its base).
- No branching on the deck or on General ids inside a skill; no central switch; variants register in data.
- "Lord", never "Ruler". No Lord skills.
- Anything the rules file calls "may" is asked each time; compulsory skills ask only to reveal a hidden General first (existing engine behaviour).
- Hidden information stays hidden (`domain/redact.ts`); the sim's leak checks stay green.
- A seat's Kingdom counts only while the seat is exposed (a General revealed). A hidden seat has no Kingdom for these skills.
- UI text follows the casing rules in `CLAUDE.md`; new Vietnamese text starts as draft (`npm run i18n:status`). The Generals use the placeholder portrait (`GENERAL_PLACEHOLDER_ART_URL`), already in place.
- Each task carries its own tests and keeps `npm test` green before its commit.

## Review Focus

- A seat whose Generals are both hidden is invisible to every Kingdom check: Prudence, Call of Valour, Tian Feng, Ji Ling's second target (Tasks 1, 4, 8, 10, 11).
- Hiding a General that holds a skill with pending business (Zou Shi hides one of a seat mid-Play-Phase, or while it has a trigger waiting) leaves no engine error and no skill still working from the hidden General (Task 12).
- Femme Fatale blocks every kind of reveal in her turn: the Start-window offer, trigger-asked reveals, reveal-on-use of a card, and the use of a hidden General's skill; her own seat and a death's reveal are not blocked (Task 3, 12).
- Tian Feng's Kingdom-death loss and Prudence/Comity target a seat that dies mid-resolution without an engine error (Tasks 4, 8, 9).
- Ji Ling's duel winner's Sha is a Sha for every Sha rule (Shan answers, Armor, Chains, Gender Swords) yet never counts toward the one-Sha limit and never needs a card (Task 11).

---

### Task 1: Exposure-aware Kingdoms

**Files:** Modify `projects/content/src/lib/shared/kingdom.ts`; Test `shared/kingdom.spec.ts`.

**Interfaces:**
- Consumes: `Seat.kingdom` (the true Kingdom, set when the Generals are chosen and never `'hidden'` afterwards) and `Seat.generals[slot].revealed`.
- Produces: `exposedKingdom(state, seatId)` returns `null` unless at least one of the seat's Generals is revealed; `sameKingdomSeatIds(state, seatId)` follows. New `exposedKingdomCounts(state: GameState): Map<string, number>`: living exposed seats per Kingdom (the engine has no Ambitionist yet, so each Kingdom is one group).

- [ ] **Step 1: Failing tests** in `kingdom.spec.ts`: a seat with `kingdom: 'Wei'` and both Generals `revealed: false` has `exposedKingdom` null and is not in `sameKingdomSeatIds` of its Wei neighbour; revealing the deputy only makes it `'Wei'`; a dead seat is excluded from `exposedKingdomCounts`.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/shared/kingdom.spec.ts`; confirm the new tests FAIL (the current helpers read `seat.kingdom` alone; the existing spec only models a hidden seat as `kingdom: 'hidden'`).
- [ ] **Step 3: Implement.** Existing Dynasty Wars consumers of these helpers are Amass, Wuxie Kingdom, Ally Far Attack Near and Six Swords of Wu. If any of their specs fails after the fix, STOP and report which: that is a Dynasty Wars behaviour change the user must rule on, not a fix to slide in.
- [ ] **Step 4: Run** `npm test`; expect PASS.
- [ ] **Step 5: Commit** `fix(content): a Kingdom counts only while the seat is exposed`.

### Task 2: The killer on a dying event

**Files:** Modify `projects/engine/src/lib/pipeline/events.ts` (`SeatDyingEvent`), `pipeline/effects.ts` (the `DyingEffect` case, about line 494); Test `pipeline/dying.spec.ts`.

**Interfaces:** Produces `SeatDyingEvent.killerSeatId?: string`, copied from `DyingEffect.killerSeatId` when the event is emitted.

- [ ] **Step 1: Failing test** in `dying.spec.ts`: damage from seat B that drops A to 0 emits `SeatDyingEvent` with `seatId: 'a'` and `killerSeatId: 'b'`; HP loss with no source emits it without `killerSeatId`.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement** the optional field and its copy.
- [ ] **Step 4: Run** `npm test`; expect PASS (log snapshots in Dynasty Wars specs must not change: the field is absent when `DyingEffect` has none).
- [ ] **Step 5: Commit** `feat(engine): SeatDyingEvent names the damage source`.

### Task 3: Hide a General and block reveals

**Files:** Modify `projects/engine/src/lib/pipeline/effects.ts` and `events.ts` (`HideGeneralEffect`, `GeneralHiddenEvent`), `registry/types.ts` (`SkillDefinition.blocksOtherReveals?: true`), `skills/generalSkills.ts` (`revealBlockedFor`), the reveal paths in `rules/legality.ts` and `pipeline/resolve.ts`, `domain/redact.ts` if it needs to learn the event; the app's and bots' event renderers (grep `GeneralRevealedEvent` and mirror each use for `GeneralHiddenEvent`); Test `pipeline/reveal.spec.ts`, `skills/generalSkills.spec.ts`, `domain/redact.spec.ts`.

**Interfaces:**
- Produces: `{ kind: 'HideGeneralEffect'; seatId: string; slot: 'main' | 'deputy' }` sets that General's `revealed` to `false` (no-op if already hidden), logs `GeneralHiddenEvent { kind; seatId; slot }`, and gives no reveal bonus later when it is exposed again unless Dynasty Wars' bonus rule says a first reveal only (read how the bonus is decided and keep a re-reveal from paying it twice).
- Produces: `revealBlockedFor(state: GameState, seatId: string, registry: ContentRegistry): boolean`: true when `state.turn.ownerSeatId !== seatId` and the turn owner holds an in-play, already revealed skill with `blocksOtherReveals`. Every path that reveals a General by a seat's choice or an ask consults it: the Start-window reveal action, `needsReveal` skill and conversion uses (they are not offered), trigger-ask reveals (the skill is skipped, not asked), and reveal-on-use of a card (Roar). A death's reveal (`onDeath`) is never blocked.
- Hidden Generals' skills drop out of `skillsInPlay` the same way they already do for a hidden General (no change needed beyond `revealed: false`).

- [ ] **Step 1: Failing tests:** `reveal.spec.ts`: hiding the Main of a seat with both revealed leaves the Deputy revealed and the Main's non-compulsory skills `needsReveal`; its compulsory skills go off; hiding a hidden General changes nothing; `GeneralHiddenEvent` appears in the log; a redacted view shows the General as hidden again. `generalSkills.spec.ts`: `revealBlockedFor` is true for another seat during the owner's turn when the owner's revealed skill has the flag, false for the owner, false when the owner's General is hidden, false in another seat's turn. A legality spec: during that turn the blocked seat is not offered a hidden General's skill, and a Start-window reveal action throws.
- [ ] **Step 2: Run** `npx jest projects/engine`; expect FAIL.
- [ ] **Step 3: Implement** the interfaces. Find the application points by grepping `RevealGeneralEffect` and `revealed` across engine, content, bots and app (the earlier survey lists `legality.ts` ~100/213/289, `resolve.ts` ~136-145/204/242-265/623-628/734-766, and the `Roar` path through `shaPlayRevealOwner`).
- [ ] **Step 4: Run** `npm test` and the sim leak specs; expect PASS.
- [ ] **Step 5: Commit** `feat(engine): hide a General, and a skill that blocks other seats' reveals`.

### Task 4: Gan Fu Ren

**Files:** Modify `projects/content/src/lib/generals/kingdom-wars-shu.ts`; Test `generals/kingdom-wars-shu.spec.ts`.

**Interfaces:** Consumes `exposedKingdom`/`sameKingdomSeatIds` (Task 1), `after:HealEvent` (see `wind.ts` ~183), `ask`, `used`, `draw`. Registered under `'gan-fu-ren'`: `淑慎` → `kingdomWars:prudence`, `神智` → `kingdomWars:divine-wisdom`. Add both ids to `VARIANTS_WITHOUT_BASE` in `kingdomWarsBase.ts` and give them their texts the way slice 2's `kingdomWars:scrutinize` has.

- [ ] **Step 1: Failing tests:** Prudence: healing 2 points in one `HealEffect` asks twice; the choices are living exposed seats of her Kingdom other than her, never a seat with both Generals hidden, and with none to pick nothing is asked; picking one makes it draw 1; declining draws nothing. Divine Wisdom: at the start of her turn she is asked; with 3 hand cards at HP 3 she discards all and heals 1; with 2 cards at HP 3 she discards 2 and does not heal; with an empty hand she is not asked.
- [ ] **Step 2: Run** `npx jest projects/content/src/lib/generals/kingdom-wars-shu.spec.ts`; expect FAIL.
- [ ] **Step 3: Implement** both skills as optional (asked) skills.
- [ ] **Step 4: Run** the spec and `npm test`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Gan Fu Ren`.

### Task 5: Yue Jin

**Files:** Modify `generals/kingdom-wars-wei.ts`; Test `generals/kingdom-wars-wei.spec.ts`.

**Interfaces:** Registered under `'yue-jin'`: `骁果` → `kingdomWars:dauntless`. Trigger `after:PhaseChangedEvent` at the End Phase of another seat's turn (see `kingdom-wars-wei.ts:77` for the pattern). Her discard is a Basic card from hand (`registry.cards.get(c.definitionId)?.category === 'basic'`); the victim chooses an Equipment card from hand or equipment area to discard, or takes 1 damage from her via `skillDamage`. Texts as in Task 4.

- [ ] **Step 1: Failing tests:** she is asked only in another seat's End Phase and only while she holds a Basic hand card; after she discards one, a victim holding an Equipment card in hand may discard it (no damage), may discard a worn one, or declines and takes 1 damage; a victim with no Equipment card takes 1 damage without a choice; her own turn's End Phase asks nothing.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec and `npm test`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Yue Jin`.

### Task 6: Ding Feng

**Files:** Modify `generals/kingdom-wars-wu.ts`, `cards/sha.ts` (`targetPick`, `shaTargetIds` use), `shared/queries.ts` (`seatDistance`), `shared/shaRules.ts`; Test `generals/kingdom-wars-wu.spec.ts`, `shared/queries.spec.ts`.

**Interfaces:**
- `kingdomWars:close-combat` (compulsory-free, optional per Sha): a skill modifier-free design: add `AbilityModifiers.extraShaTargets?: number` (read through `activeAbilities` like `extraTargetsWhenLastCard`), counted in `targetPick`'s `max`. The extra target must be another legal Sha target (`shaTargetIds`, which already limits by attack range including weapon range) and within physical distance 1 of the user (`getSeatDistance`, no mount or modifier), with the first target not repeated. Because Close Combat is "can", the picker lets the user choose one target or two (`min: 1`).
- `kingdomWars:swift-and-deadly` (active, once per Play Phase: `usesPerTurn: 1`): discard 1 card (hand or equipment), pick another living seat; sets turn flag `distance1:<fromSeatId>:<toSeatId>`; `seatDistance(state, from, to, registry)` returns 1 when that flag is set (never lower; only that direction).
- Registered under `'ding-feng'`: `短兵`, `奋迅`. Texts as in Task 4.

- [ ] **Step 1: Failing tests:** Close Combat: with the target at distance 1 and another at distance 1 within range, the Sha may take both (two targets, both resolve); a candidate at distance 2 or out of weapon range is not offered; unarmed (range 1) works; Sky Scorcher's last-card bonus adds on top. Swift and Deadly: after use, `seatDistance(ding, target)` is 1 and `seatDistance(target, ding)` is unchanged; the flag ends with the turn; a Steal on a far seat becomes legal; a second use in the same phase is not offered; with no card to discard it is not offered.
- [ ] **Step 2: Run** the specs; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the specs and `npm test` (all Sha and distance specs must stay green); expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Ding Feng`.

### Task 7: Pan Feng

**Files:** Modify `generals/kingdom-wars-qun.ts`; Test `generals/kingdom-wars-qun.spec.ts`.

**Interfaces:** Registered under `'pan-feng'`: `狂斧` → `kingdomWars:insanity-axe`. Trigger `after:DamageDealtEvent` where the source is Pan Feng and `damage.cause.card.as` is a Sha (`isShaDamage` in `shared/abilities.ts`), the target is alive, and the target has a worn card. Asked; she picks one worn card of the target, then either moves it into her own equipment area (`MoveCardEffect` to her `equipZoneId`, her card in that slot, if any, discarded first) or discards it. Texts as in Task 4.

- [ ] **Step 1: Failing tests:** a Sha that damages a seat wearing a Weapon: she may move it (her empty weapon slot now holds it) or discard it; with her weapon slot full, moving replaces it and her old weapon goes to the discard pile; damage that is not from a Sha (a Duel, a skill) does not trigger; a victim with no worn cards does not trigger; two damaged seats (Chains) ask once each.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec and `npm test`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Pan Feng`.

### Task 8: Tian Feng

**Files:** Modify `generals/kingdom-wars-qun.ts`; Test `generals/kingdom-wars-qun.spec.ts`.

**Interfaces:** Consumes `SeatDyingEvent.killerSeatId` (Task 2), `exposedKingdom` (Task 1). Registered under `'tian-feng'`: `死谏` → `kingdomWars:deathly-counsel`, `随势` → `kingdomWars:with-the-tide`.
- Deathly Counsel: `after:CardMovedEvent` with the `linkedCamps` condition in `generals/wu.ts` (his hand left a zone and is now empty); asked; he picks another living seat and one of its hand or equipment cards (`seatCardOptions(..., { judgment: false })`) to discard. Not asked when no other seat has such a card.
- With the Tide (compulsory): `after:SeatDyingEvent` for another seat when `killerSeatId` is a seat of Tian Feng's exposed Kingdom (the killer may be Tian Feng or the dying seat's own ally), Tian Feng draws 1; `after:SeatEliminatedEvent` of another seat of his exposed Kingdom (by its Kingdom at death), Tian Feng loses 1 HP (`LoseHpEffect`).
- Texts as in Task 4.

- [ ] **Step 1: Failing tests:** Deathly Counsel: playing his last card asks; discarding it from a seat's hand and from its equipment works; with other cards left in hand it does not ask. With the Tide: a same-Kingdom seat's damage that makes another seat dying draws 1; damage from another Kingdom does not; a source that has both Generals hidden does not; an ally dying costs him 1 HP; a dying seat of another Kingdom costs nothing; he dying himself costs nothing extra; he does not lose HP for a hidden ally's death unless that seat is exposed at death (a death reveals it first: use the revealed Kingdom).
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec and `npm test`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Tian Feng`.

### Task 9: Kong Rong

**Files:** Modify `generals/kingdom-wars-qun.ts`; Test `generals/kingdom-wars-qun.spec.ts`.

**Interfaces:** Registered under `'kong-rong'`: `名士` → `kingdomWars:celebrity`, `礼让` → `kingdomWars:comity`.
- Celebrity (compulsory): `before:DamageEffect` (see `forest.ts:108`) when the target is Kong Rong and `damage.source` is a seat with at least one General not revealed: amount reduced by 1 to a minimum of 0 (a 0-damage effect resolves as no damage, as Dynasty Wars' other reducers do). No source: no change.
- Comity: asked when cards he discards or loses from hand or equipment area reach the discard pile (the `before:DiscardZoneEffect` pattern at `forest.ts:58`, and the cards of a discard selection); not cards he used that resolve into the discard pile. He may give those cards to another living seat, which receives them in hand; one ask per instance (one effect, however many cards). Texts as in Task 4.

- [ ] **Step 1: Failing tests:** Celebrity: a Sha from a seat with a hidden Deputy deals 0 (or 1 less from 2); from a fully revealed seat unchanged; damage with no source unchanged; a seat's own hidden state is not the test. Comity: his discard of 2 cards in the Discard Phase asks once and giving them puts both in the chosen seat's hand; declining leaves them in the discard pile; a Sha he plays is not asked; losing a worn card to Dismantle asks (the card is lost from his equipment to the discard pile); with every other seat dead nothing is asked.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.** Comity's interception point is the builder's call (before the discard move, or giving back from the pile right after it); the tests above pin the behaviour.
- [ ] **Step 4: Run** the spec and `npm test`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Kong Rong`.

### Task 10: Ma Teng

**Files:** Modify `generals/kingdom-wars-qun.ts`; Test `generals/kingdom-wars-qun.spec.ts`.

**Interfaces:** Consumes `exposedKingdomCounts`, `sameKingdomSeatIds` (Task 1). Registered under `'ma-teng'`: `马术` → `{ ...horsemanship, id: 'kingdomWars:horsemanship' }` with base `horsemanship` in `KINGDOM_WARS_VARIANT_BASE`; `雄异` → `kingdomWars:call-of-valour`: `limited: true`, `active` (Play Phase): every living exposed seat of his Kingdom, himself first, draws 3; then if his Kingdom's count is no greater than every other exposed Kingdom's count, he heals 1 (ties heal). See `fire.ts:158` and `forest.ts:440` for `limited` skills. Texts as in Task 4.

- [ ] **Step 1: Failing tests:** Horsemanship: his distance to others is 1 less, never below 1; Call of Valour: three Qun seats draw 3 each; a hidden Qun seat does not; with Qun the smallest he heals 1, with a tie he heals, with a larger Kingdom he does not; at full HP healing does nothing and no error; it cannot be used a second time in the game (including a later turn); it is offered only in his Play Phase.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec and `npm test`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Ma Teng`.

### Task 11: Ji Ling

**Files:** Modify `generals/kingdom-wars-qun.ts`, `shared/compete.ts` only if a result step needs more data; Test `generals/kingdom-wars-qun.spec.ts`.

**Interfaces:** Consumes `competeStart`/`competeStep` (Points Duel: the engine calls it competing), `PlayContext.free` (a free Sha never counts toward a limit or spends Wine; see Green Dragon Blade's follow-up Sha). Registered under `'ji-ling'`: `双刃` → `kingdomWars:double-edged`: at the start of his Play Phase (`after:PhaseChangedEvent`, as the other Play-Phase-start skills), asked; he picks another living seat with a hand card and competes. On a win, he picks the loser or, when the loser is exposed, another living exposed seat of the loser's Kingdom (`sameKingdomSeatIds`), and a Sha is played at it with `free: true`, no card, no range limit, all Sha rules applying. On a loss or a tie, his Play Phase ends (the engine's skip-to-next-phase path used by other Play Phase enders; find it by grepping `skipPlay`/`SkipNextEffect`). The competing cards are discarded as in Dynasty Wars. Texts as in Task 4.

- [ ] **Step 1: Failing tests:** a win aimed at a seat 3 away still deals Sha damage when it has no Shan; a Shan answers it; Armor (Black Shield / Eight Trigrams) applies; the winner then plays his normal Sha and the one-Sha limit is intact (he still has his full Sha count); a win against an exposed seat offers its Kingdom-mates as other targets and none for a hidden loser; a tie ends his Play Phase; a loss ends it; with no seat holding a hand card he is not asked; both competing cards are discarded.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec and `npm test`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Ji Ling`.

### Task 12: Zou Shi

**Files:** Modify `generals/kingdom-wars-qun.ts`; Test `generals/kingdom-wars-qun.spec.ts`, a sim spec in Task 13.

**Interfaces:** Consumes `HideGeneralEffect`, `SkillDefinition.blocksOtherReveals`, `revealBlockedFor` (Task 3). Registered under `'zou-shi'`:
- `祸水` → `kingdomWars:femme-fatale`: `blocksOtherReveals: true`; also an `active` skill (Play Phase, only while her General is hidden) whose `start` returns no effects; using a hidden General's active skill already reveals it, so this is the free voluntary reveal (the one exception to "no free Play Phase reveal", as the user confirmed).
- `倾城` → `kingdomWars:impetus-for-conflicts`: `active`, any number of uses per Play Phase: `canUse` needs an Equipment card (hand or worn) and another living seat with both Generals revealed; the user discards one Equipment card, picks such a seat, then picks one of that seat's two Generals (shown by name, they are exposed) to hide via `HideGeneralEffect`.
- Texts as in Task 4.

- [ ] **Step 1: Failing tests:** Femme Fatale: hidden Zou Shi's player may use it in the Play Phase to expose her General without another cost; during her turn another seat is offered no reveal (Start window, skill use, trigger ask, Roar-style reveal-on-use), in anyone else's turn they are; if she is hidden at her turn start, nobody else can reveal until she exposes; her own seat is not blocked. Impetus: needs an Equipment card; a target with one General hidden is not offered; hiding the Main leaves the Deputy's skills working and the Main's gone; both Generals can be hidden by two uses (the seat is then hidden: its `redact` view shows no General); the hidden General can be exposed again outside her turn by the normal conditions; using it twice in one phase works.
- [ ] **Step 2: Run** the spec; expect FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the spec and `npm test`; expect PASS.
- [ ] **Step 5: Commit** `feat(content): Kingdom Wars Zou Shi`.

### Task 13: Wiki, simulation and completeness

**Files:** Modify `projects/sim/src/kingdomWars.spec.ts`; Test `wikiKingdomWarsGenerals.spec.ts`, `kingdomWarsVariants.spec.ts`, `kingdomWarsGenerals.vi.spec.ts`.

- [ ] **Step 1: Failing tests:** every skill of the 9 Generals reads `worksAsKingdomWars` (Wiki), none `missing`; every variant id satisfies the `kingdomWarsVariants.spec.ts` rules (`kingdomWars:` + skillIdOf of the English name, unique, not a Dynasty Wars id); each new variant has an English and a Vietnamese name (`abilityName`), and the Vietnamese ones count as draft in `npm run i18n:status`. Sim: a seeded Kingdom Wars game forces a table with each of the 9 as Main (the `forcedPairing.ts` helpers from slice 2's sim spec) and plays to a result with bots: no engine error and no leak.
- [ ] **Step 2: Run** `npx jest projects/sim/src/kingdomWars.spec.ts projects/content/src/lib` ; expect FAIL.
- [ ] **Step 3: Implement** the fixtures only; fix any engine error the sim shows in the owning skill, with a test there. Bots only need to play legally.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck:server`, `npm run build`, `npm run i18n:status`; expect all green and no missing keys. Then run a Dynasty Wars simulation and confirm its result is unchanged from `main`.
- [ ] **Step 5: Commit** `test: Kingdom Wars new Generals end to end`.

---

## Self-review notes

- Spec coverage (slice 3): all 9 Generals and 15 skills have a task (Ma Teng's 2, Zou Shi's 2, Ding Feng's 2, Tian Feng's 2, Kong Rong's 2, Gan Fu Ren's 2, Yue Jin's, Ji Ling's, Pan Feng's one each = 15). The engine mechanics the spec names (Zou Shi's blocking and hiding, Ji Ling's Sha from a Points Duel, Tian Feng's Kingdom-and-dying trigger, Ma Teng's single use tied to Kingdom size, Ding Feng's distance of 1) are Tasks 3, 11, 2 and 8, 10 and 6; Task 1 is the Kingdom foundation they share.
- Open risk, found while planning: `exposedKingdom` reads `seat.kingdom` without checking exposure, and the engine stores the true Kingdom from General selection. If Task 1's test fails on current code, Dynasty Wars' Amass, Wuxie Kingdom, Ally Far Attack Near and Six Swords of Wu already read hidden seats' Kingdoms; that is reported to the user before the fix lands.
- Not in this slice: wording-only audit (slice 4), bot intelligence for the new skills.
