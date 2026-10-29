# Mechanics to code patterns

Paths are under `projects/`. Names were taken from the code on 2026-10-29. Grep each one before naming it in a table, and prefer the "Adding a General" section of `docs/architecture/content-and-extensibility.md` where it disagrees.

Core types: `engine/src/lib/registry/types.ts` (`SkillDefinition`, `Abilities`, `ActiveSkill`, `Conversion`, `AbilityModifiers`). Shared helpers: `content/src/lib/shared/` (`skills.ts`, `steps.ts`, `compete.ts`, `awaken.ts`, `judgments.ts`, `suits.ts`, `choices.ts`, `queries.ts`).

## Activation

| Wording | Pattern | Example |
|---|---|---|
| "Play Phase: you may use..." | `active: { usesPerTurn?, canUse, start }`, only in the owner's Play Phase | Marriage (`generals/wu.ts`), Heaven's Justice (`fire.ts`) |
| "After / when / whenever..." | `triggers` built with `on<Event>('before:X' or 'after:X', { condition, effect })` | Evil Hero (`wei.ts`) |
| Always on (range, distance, limits) | `modifiers` (`distanceToOthers`, `shaLimit`, `ignoresArmor`, `untargetableBy`, `suitAs`, ...), compulsory | Horsemanship (`shu.ts`) |

Gaps: a static rule with no matching `modifiers` field; a draw-count change (use a `before:DrawPhaseEffect` trigger, `atDrawPhase`).

## Frequency

| Wording | Pattern | Example |
|---|---|---|
| Once per turn, active | `active.usesPerTurn: 1`, counted in `state.turn.abilityUses` | Marriage |
| Once per turn, trigger | `IncrementEffect {scope:'turn', key}` plus a check in `condition`. Hand-rolled, no helper. | Kindness (`shu.ts`) |
| Once per game | A seat mark (`IncrementEffect {scope:'seat', key}`) checked in `canUse` or `condition`. `limited: true` is a label, the engine does not enforce it. | Upheaval (`forest.ts`), Nirvana (`fire.ts`) |
| Awakening | `awakeningAtTurnStart` (`shared/awaken.ts`) | `mountain.ts` |
| Several per turn | Omit `usesPerTurn` | Battered Body (`wu.ts`) |

## Obligation and reveal

- Compulsory: `compulsory: true`, effects returned directly. Optional: wrap in `ask(owner, effects, otherwise?)`. Inside a card step use `askAtStep` or `actedOn`. At the Draw Phase use `atDrawPhase`.
- A hidden General's reveal is handled by the engine when an ask or active skill is used. The author writes no reveal code. The project rules (reveal conditions, 2026-10-20) still apply, so state them in the rules block.

## Targets and cards

- Player: `selectionOf` with `of: 'seats'`, or `choiceOf` with `seatOptions`. Eligibility goes in `canUse` and `eligibleIds` (`otherLivingSeatIds`, `isHurt`, `seatGender`, `seatDistance`, `attackRange`).
- Card on a seat: `seatCardOptions` (`shared/choices.ts`). Example: Feedback (`wei.ts`).
- Card cost: `selectionOf` with `of: 'cards'`, then `discardMoves` in `onStep`. Give: `then: {kind:'give', ...}`. Move: `MoveCardEffect` with `onlyFrom`.
- Suit and colour: `suitOf`, `colourFor` (`shared/suits.ts`), never `card.suit` for the owner. Type: `registry.cards.get(card.definitionId)?.category`.
- Gap: stash-pile costs have little precedent.

## Effects

- Damage: `skillDamage`; heal: `heal`; draw: `draw`; lose HP: `LoseHpEffect`.
- Judgment: `JudgeEffect` with `reader: {kind:'skill', owner}`, result read in `onJudged`. Changing a judgment: `JUDGMENT_CHANGERS` (`shared/judgments.ts`). Example: Unyielding, Devil (`wei.ts`).
- Gap: a judging skill needs entries in the judgment display `READERS` table and in the bot's `goodForJudged`.

## Compete

`competeStart` / `competeStep` (`shared/compete.ts`). The result arrives as `data.won`; a tie loses. Needs a `COMPETE_OUTCOMES` entry in `display.ts`. Gap: bots have no generic Compete policy. Example: Heaven's Justice (`fire.ts`).

## Treat as

`conversions: Conversion[]` with `as`, `cards`, `from`, `accepts`, `when: 'play'|'respond'|'both'`. Examples: Fighting Saint, Dragon Courage (`shu.ts`), First Aid (`qun.ts`). Gap: a new conversion must be added to the bots' `CONVERSION_SKILLS`.

## Phase

`on<PhaseChangedEvent>('after:PhaseChangedEvent', ...)` checking `e.phase` and `e.seatId === owner.seatId`. Skipping a phase: `SetTurnFlagEffect` with `skipFlagOf(phase)`, which lasts only until the turn ends. Gap: a skip that must outlive the turn, or land on another seat, has no pattern.

## Response windows

A skill opening its own window builds an `OpenResponseEffect` with a `PendingResponse` by hand (no helper). Hooking into a card's flow: `atStep([...])`. Gap: the hand-built window.

## Per-skill tables the build touches

Mark each needed or not in step 5:

- Bots: `bots/src/lib/skills.ts` and the pack's bot file (`wantsSkill`, `skillSelection`, `skillChoice`, `CONVERSION_SKILLS`, `goodForJudged`)
- `ABILITY_HINTS` and `COMPETE_OUTCOMES` in `content/src/lib/display.ts`
- Selection prompts in `display.ts`: `SELECTION_TEXT` (read by `selectionText`) keyed by the skill id for the skill's first selection, and `STEP_SELECTION_TEXT` (read by `stepSelectionText`) keyed `<skillId>/<step>` for later steps
- `CLEARED_WORDING` or a Kingdom Wars variant (`kingdomWarsVariants.ts`, plus `kingdomWarsBase.ts` if it shares bot behaviour)
- Vietnamese: `data/locales/vi/prose.json`, plus the generals file for the deck
- The pack's simulator spec
