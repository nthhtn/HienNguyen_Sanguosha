# Content and extensibility

How cards, Generals, skills and modes are defined in `projects/content`, and
what adding one involves. The rule that drives all of this (CLAUDE.md): adding
a card or General means adding its definition, not editing a central switch.

## Two halves: data and logic

Every card and General has two parts that live in different places.

| Half | Where | What it holds | Written by |
|---|---|---|---|
| **Data** | `projects/content/data/` (one JSON file per card or General) | name, Kingdom, HP, gender, printed rule text, suit and rank of every printing | a crawl of a public English Sanguosha reference, then reviewed |
| **Logic** | `projects/content/src/lib/` (TypeScript) | what the card or skill actually does: targets, effects, triggers, steps | by hand, after the rule text is written |

`buildContentRegistry()` ([registry.ts](../../projects/content/src/lib/registry.ts))
merges them into a `ContentRegistry`:

```ts
interface ContentRegistry {
  cards:    Map<string, CardDefinition>;      // keyed by card id
  generals: Map<string, GeneralDefinition>;   // keyed by General id
}
```

- A **General** exists because its data file exists. Its skills come from a
  hand-coded `GeneralSkillSet` keyed by the same id. A General with data and no
  skill logic is a playable vanilla General (`skills: []`). Skill logic with no
  data file throws when the registry is built.
- A **card** exists because it is listed in the registry's card array. Its
  printings (suit, rank, count) come from its data file and decide how many
  copies the deck holds and which faces they have. A card with no printings
  throws when the deck is built, so it can never silently go undealt.

The data files are why wiki pages, card art and rules text can be shown
without the UI knowing any card: the app reads them through content's display
helpers (`generalDisplayData`, `cardDisplayData`, `abilityName`, `abilityHint`,
`competeOutcomeText`…), never by importing JSON.

### Assets

Card and General art lives in `projects/content/assets/` and is described by
`manifest.json` (source URL, crawl date, dimensions). The images are scans of
commercial cards and are **gitignored**: only the manifest is committed.
`scripts/crawl-assets.py` repopulates them locally. `angular.json` serves them
at `/card-art/...` (images) and the audio files at their own paths.

## Writing a card

A `CardDefinition` ([registry/types.ts](../../projects/engine/src/lib/registry/types.ts))
is an object of optional hooks. The smallest useful one, Draw Two:

```ts
export const drawTwoCard: CardDefinition = {
  id: 'draw-two',
  name: 'Draw Two',
  category: 'tool',
  legalPlayTargets: () => [[]],                 // playable with no target
  play: (state, ctx) => toolOnTargets(ctx.card, ctx.seatId, [{ kind: 'seat', seatId: ctx.seatId }]),
  onTarget: (_state, { userSeatId }) => [{ kind: 'DrawCardsEffect', seatId: userSeatId, count: 2 }],
};
```

| Hook | When the engine calls it |
|---|---|
| `legalPlayTargets`, `targetPick` | to build the legal actions for this card |
| `play` | the card is used; returns the effects to queue |
| `onResponse` | a window this card opened was answered (a Duel turning back) |
| `onTarget` | a Tool's rule on one target, after its Wuxie check |
| `onJudged`, `onCleanup` | a delayed Tool read its judgment, or finished its turn in the judgment area |
| `abilities` | active while the card is worn: triggers, modifiers, conversions |
| `onUnequip` | the card left an equip slot |
| `onStep` | one named step of its resolution (a Sha's `sha-shan`) |

Cards never touch the state directly. They return **effects**, and the engine
applies them. A card that changes how other cards behave does it with
`abilities.modifiers` (Crossbow's `shaLimit`, a horse's `distanceToOthers`) or
with triggers (Silver Lion's damage cap is a `before:DamageEffect` trigger).
Content reads those modifiers through its own queries (`shared/queries.ts`,
`shared/shaRules.ts`); the engine never does.

## Writing a skill

A `SkillDefinition` shares the card `abilities` shape (triggers, modifiers,
conversions) and adds:

| Field | Meaning |
|---|---|
| `compulsory` | applies without asking; off while its General is hidden |
| `lord` | a Lord skill: never in play (Kingdom War has no Lord) |
| `awakening`, `limited` | once-per-game rules |
| `active` | a skill used on purpose in the Play Phase: `canUse`, `start`, `usesPerTurn` |
| `onStep` | the skill's own multi-move resolution |
| `onJudged` | reading a judgment the skill asked for |
| `spareGenerals`, `afterDeath` | the two special cases Incarnation and Heartbroken need |

Most skills are written with the helpers in
[shared/skills.ts](../../projects/content/src/lib/shared/skills.ts) so they all
speak the same vocabulary:

- `on<Event>('after:DamageDealtEvent', { condition, effect })` declares a trigger;
- `ask(owner, effects)` offers "use this skill?" (the *may* skills);
- `selectionOf`, `choiceOf` open a pick of cards, seats or options;
- `skillStep(owner, 'name', data)` queues the skill's own next step;
- `used(owner, 'outcome', targetSeatId)` logs an `AbilityUsedEvent` the UI can
  describe.

A skill must always act for the `owner` the engine passes in and never look up
"its" seat by General id: the same General can sit at two seats in a test.

### Multi-move mechanics: steps

A mechanic that needs more than one decision is a chain of steps whose data
lives in the queue. Compete
([shared/compete.ts](../../projects/content/src/lib/shared/compete.ts)) is the
reference example: `competeStart` opens the user's face-down pick,
`compete-user` opens the target's pick, `compete-target` shows and discards
both cards and queues the owning skill's result step with `won` set. Heaven's
Justice, Rouse the Tiger and Intense Edge each supply only their own result
step. The same pattern drives Bewilder's doubt round and Sha's dodge steps.

## Writing a game mode

A mode is a `GameModeDefinition`: `setup`, `checkWinCondition`, `triggers`,
`maxSeats`. Everything specific to Kingdom War (the two Generals per seat, the
shared HP pool, revealing at half HP, the dying round, the kill reward and
penalty, the reveal bonuses) is a trigger or a setup step in
[kingdomWar.ts](../../projects/content/src/lib/modes/kingdomWar.ts), not engine
code. A second mode would be a second object of the same shape.

## Adding content: the checklist

The process rule in CLAUDE.md: **write the precise rule text before the code**
for any non-trivial mechanic. In this repo that is a spec in
`docs/superpowers/specs/`, then a plan in `docs/superpowers/plans/`, then
test-first implementation. Trivial additions that reuse a specified pattern
skip the spec.

**A new card**

1. Add its data file under `data/cards/<category>/` and import it in
   `data/cards/index.ts`, which assembles the `cardsData` record. (The two
   Python scripts that first assembled and restructured the data,
   `assemble-content-data.py` and `restructure-content-data.py`, were one-off
   tools; only `crawl-assets.py` is reusable.)
2. Write the `CardDefinition` in `src/lib/cards/` and add it to the card array
   in `registry.ts`.
3. Run `scripts/crawl-assets.py --only <id>` to fetch its art and add it to
   the manifest, if the data file has a `source.url`.
4. Test it with the table helper in `generals/skills.testing.ts` (a small hand
   built `GameState`) and drive it through `harness()`.
5. If bots should use it, teach `projects/bots` (see
   [Bots and simulation](bots-and-simulation.md)).

**A new General**

1. Add its data file under `data/generals/<kingdom>/` and import it in
   `data/generals/index.ts`.
2. Write its skills in the matching `src/lib/generals/<set>.ts` and add the
   `{ id, skills }` entry to that set's list. Registration is by that list, so
   no other file changes.
3. Add display text in `display.ts` only where the UI needs it: the
   `ABILITY_HINTS` line for an ask, selection prompts, and a
   `COMPETE_OUTCOMES` entry for a skill that competes.
4. Add the id to the pack's id list in `generals/index.ts`.
5. Extend that pack's simulator spec so a seeded game fires the skill (see
   [Bots and simulation](bots-and-simulation.md)).

**A new table rule or mode behavior** is a trigger on the mode, with a test in
`kingdomWar.spec.ts`; an optional rule also gets a field on `GameRules`.

## What keeps this honest

- The registry refuses to build when skill logic has no data file, and
  `registry.spec.ts` and `generals/index.spec.ts` check the Generals it builds
  and that each pack's id list names real Generals with data.
- `wiki.spec.ts` builds the Wiki from the same data, so a missing field shows
  up as a test failure.
- The simulator plays whole games with each pack's Generals and fails on an
  invariant break, a game that does not end, or a skill that never fires.
