# Content and extensibility

How cards, Generals, skills and modes are defined in `projects/content`, and
what adding one involves. The rule that drives all of this (CLAUDE.md): adding
a card or General means adding its definition, not editing a central switch.

## Two halves: data and logic

Every card and General has two parts that live in different places.

| Half | Where | What it holds | Written by |
|---|---|---|---|
| **Data** | `projects/content/data/` (one JSON file per card or General, plus `decks/` and `locales/`) | name, Kingdom, HP, gender, printed rule text, suit and rank of every printing; each deck's distribution; Vietnamese names and prose | a crawl of a public English Sanguosha reference, then reviewed |
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
- A **card** exists because it is listed in the registry's card array. A card
  with no printings in the deck being dealt can never silently go undealt: it
  throws when the deck is built.
- **Kingdom Wars Generals** are registered beside the Identity ones under ids
  prefixed `kingdomWars:`; see "Decks and the Kingdom Wars content" below.

The data files are why wiki pages, card art and rules text can be shown
without the UI knowing any card: the app reads them through content's display
helpers (`generalDisplayData`, `cardDisplayData`, `abilityName`, `abilityHint`,
`competeOutcomeText`, `judgmentOutcomeText`…), never by importing JSON.

## Decks and the Kingdom Wars content

A **deck** ([decks.ts](../../projects/content/src/lib/decks.ts)) is only a
distribution: which cards it holds and the suit and rank of each copy.
Behaviour, text and range stay on the card, so a card exists once and decks say
how it is dealt. There are two, chosen per game by `GameRules.deck`
(`DECK_IDS = ['identity', 'kingdomWars']`; the protocol repeats the list and a
server test checks the two agree). A game with no deck is dealt from
`DEFAULT_DECK_ID`, Kingdom Wars: it is the deck that is played, and Identity
waits for its own rules (`docs/deferrals.md`).

- **Identity** is built from the card data: each card's own printings.
- **Kingdom Wars** is read from `data/decks/kingdom-wars/deck.json`, produced by a
  crawl of the Kingdom Wars deck and its Generals. Cards that exist only in this
  deck (`kingdomWarsCards.ts`) are registered with their own definitions;
  others reuse the Identity card.

The deck also decides which Generals are dealt: Guozhan draws from the
Identity pool or the Kingdom Wars pool, never both.

A Kingdom Wars General's skill is resolved in this order
([kingdomWarsSkills.ts](../../projects/content/src/lib/kingdomWarsSkills.ts)):

1. a **variant**: a `SkillDefinition` in `generals/kingdom-wars-<force>.ts`,
   registered in `KINGDOM_WARS_VARIANTS` by General id and the skill's Chinese
   name. This is for a skill whose rules differ from Identity's.
2. otherwise the **Identity skill**, when the Kingdom Wars wording was audited and
   cleared as the same rule (`CLEARED_WORDING`, or a "nil" difference note).
3. otherwise the skill is *not ready*: it shows in the wiki and the General is
   playable without it.

`kingdomWarsBase.ts` is a leaf module mapping each variant to the Identity skill
whose prompts, hints and bot behaviour it shares. It exists so that display
code and the bots can reach variants without an import cycle, and
`importGraph.spec.ts` keeps it that way.

## Languages

Vietnamese data lives in `data/locales/vi/`: `cards.json`, `generals.json`,
`kingdom-wars-cards.json`, `kingdom-wars-generals.json`, `prose.json` (outcome and
hint text), `glossary.json` and `review.json`. English prose tables are in code
(`ENGLISH_PROSE`). `prose.vi.spec.ts` requires every English prose entry to have
a Vietnamese one with the same placeholders, `names.vi.spec.ts` checks that
translations name only things that exist, and `glossary.vi.spec.ts` checks that
the glossary's terms are used consistently. A new entry therefore ships with a
Vietnamese draft, which a native speaker later reviews.

### Assets

Card and General art, animation, and audio live in `projects/content/assets/`
and are described by `manifest.json` (source URL, crawl date, dimensions). Where
they came from and the terms they are used under are in that folder's
[README](../../projects/content/assets/README.md). `angular.json` serves the
images at `/card-art/...` and the audio files at their own paths. The assets
module (`assets.ts`) resolves a card's or General's image for the UI.

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
| `lord` | a Lord skill: kept as data but never in play (Guozhan has no Lord yet) |
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
`maxSeats`. Everything specific to Guozhan (the two Generals per seat, the
shared HP pool, the dying round, the kill reward and
penalty, the reveal bonuses) is a trigger or a setup step in
[guozhan.ts](../../projects/content/src/lib/modes/guozhan.ts), not engine
code. A second mode would be a second object of the same shape.

## Adding content: the checklist

The process rule in CLAUDE.md: **write the precise rule text before the code**
for any non-trivial mechanic. In this repo that is a spec in
`docs/superpowers/specs/`, then a plan in `docs/superpowers/plans/`, then
test-first implementation. Trivial additions that reuse a specified pattern
skip the spec.

**A new card**

1. Add its data file under `data/cards/<category>/` and import it in
   `data/cards/index.ts`, which assembles the `cardsData` record. (The Python
   scripts in `scripts/` that first assembled, restructured and crawled the data
   were one-off tools.)
2. Write the `CardDefinition` in `src/lib/cards/` and add it to the card array
   in `registry.ts`.
3. Add its art under `assets/` and record it in `manifest.json`.
4. Test it with the table helper in `generals/skills.testing.ts` (a small hand
   built `GameState`) and drive it through `harness()`.
5. Add its Vietnamese draft to `data/locales/vi/cards.json` (and `kingdom-wars-cards.json` for a Kingdom Wars-only card).
6. If bots should use it, teach `projects/bots` (see
   [Bots and simulation](bots-and-simulation.md)).

**A new General**

1. Add its data file under `data/generals/<kingdom>/` and import it in
   `data/generals/index.ts`.
2. Write its skills in the matching `src/lib/generals/<set>.ts` and add the
   `{ id, skills }` entry to that set's list. Registration is by that list, so
   no other file changes.
3. Add display text in `display.ts` only where the UI needs it: the
   `ABILITY_HINTS` line for an ask, selection prompts (`stepSelectionText` looks up
   `<skillId>/<step>` before a step name shared by several skills), and a
   `COMPETE_OUTCOMES` entry for a skill that competes.
4. Add the id to the pack's id list in `generals/index.ts`.
5. Add its Vietnamese draft to `data/locales/vi/generals.json` and any new
   prose to `prose.json`.
6. Extend that pack's simulator spec so a seeded game fires the skill (see
   [Bots and simulation](bots-and-simulation.md)).

**A Kingdom Wars General** whose skill matches Identity's needs no code: audit the
wording, add the Chinese skill name to `CLEARED_WORDING`, and the Identity skill
runs. When the rules differ, write a variant in the matching
`generals/kingdom-wars-<force>.ts`, add it to that file's variants map, and add its
`kingdomWarsBase` entry if it shares prompts or bot behaviour with an Identity skill.

**A new table rule or mode behavior** is a trigger on the mode, with a test in
`guozhan.spec.ts`; an optional rule also gets a field on `GameRules`.

## What keeps this honest

- The registry refuses to build when skill logic has no data file, and
  `registry.spec.ts` and `generals/index.spec.ts` check the Generals it builds
  and that each pack's id list names real Generals with data.
- `wiki.spec.ts` builds the Wiki from the same data, so a missing field shows
  up as a test failure.
- The simulator plays whole games with each pack's Generals and fails on an
  invariant break, a game that does not end, or a skill that never fires.

## Ambitionists in content

Content reads a seat's Kingdom through `exposedKingdom` / `sameKingdomSeatIds`
(`projects/content/src/lib/shared/kingdom.ts`), which return no Kingdom for an Ambitionist. A card or
skill that groups seats by Kingdom should use those helpers, never `seat.kingdom`, so an Ambitionist is
always a group of one.
