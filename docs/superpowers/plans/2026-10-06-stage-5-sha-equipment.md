# Stage 5: Sha Steps, Abilities and the Remaining Equipment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- Give Sha explicit steps that abilities hook into.
- Let a seat be asked "use this?", pick cards or seats, and use cards as another card.
- Make the last eleven equipment cards playable: Eight Trigrams, Black Shield, Wood Armor, Ancient Scimitar, Ice Sword, Axe, Longbow, Gender Swords, Green Dragon Blade, Sky Scorcher and Serpent Spear.
- The deck goes from 106 to 118 cards: Eight Trigrams +2, Wood Armor +2, and +1 each for Black Shield, Ancient Scimitar, Ice Sword, Axe, Longbow, Gender Swords, Sky Scorcher and Serpent Spear. Green Dragon Blade is already in the deck; it gains its ability.

**Architecture:**
- **The engine (generic, names no card):**
  - `UsedCard` is what a card in use is: what it counts as, its colour, its physical cards and, for a conversion, `via`. `CardPlayedEvent`, `PlayContext`, `ResponseContext` and `Damage.cause` carry it. One `useCard` path in `resolve.ts` serves plays, answers, conversions and ability-played cards.
  - `CardStepEffect { step, card, userSeatId, target, data }`. Applying it calls the card's `onStep`. Abilities hook in with `before:CardStepEffect` triggers that rewrite the step, cancel it, or turn it into an ask.
  - `AskUseEffect` opens a pending choice with two options, Use and Don't. `AbilityUsedEffect` logs an `AbilityUsedEvent` for the Action History.
  - `pendingSelection`: a seat picks `min`–`max` cards or seats. A plain-data continuation says what the picks lead to: `discard`, `use-card` or `card-step`. It pauses the queue like a choice. It can coexist with an open response window, as when Serpent Spear answers a Duel.
  - `Abilities.conversions` produce `UseConversionAction`s, in the Play Phase (with targets) and in response windows. Using one opens a 2-card selection whose continuation uses the cards as the produced card.
  - Small additions:
    - `MoveCardEffect.onlyFrom`, so the judged card's own trip to the discard pile skips a card a reader already moved.
    - `JudgeEffect.data`, passed to `onJudged`.
    - `PendingResponse.outcome`, a display-only effect.
    - `AbilityModifiers.untargetableBy`.
    - `previewEffect` re-checks each later before-trigger against the rewritten effect, and stops once the effect becomes another kind.
- **Content:**
  - Sha runs on steps: `sha-use` → `sha-targeted` → `sha-armor` → `sha-shan` → `sha-dodged` | `sha-hit` → `sha-damage` → `sha-after-damage`. Coerce's Sha runs on them from `sha-targeted`. Hail of Arrows asks through a `hail-shan` step, so Eight Trigrams covers both.
  - `shared/steps.ts` holds the helpers: `cardStep`, `atStep` (a before-trigger at named steps), `askAtStep`, and `actedOn`/`hasActed`, which keep each ability to one say per step.
  - The equipment moves to `cards/equipment/`, with one file per card that has abilities.
  - Gender data (all 57 Generals) and `seatGender` are pulled forward from stage 6 for Gender Swords.
- **Around the engine:**
  - **Bots:** the spec's rules for every ask, selection and conversion. The random bot fills a selection template.
  - **App:**
    - An Ask dialog and a Selection dialog.
    - Conversions in the action list and the Response dialog.
    - A text option in the Choice dialog (Gender Swords' "let them draw").
    - New Action History lines.
    - The Eight Trigrams judgment in the Response dialog.

**Tech Stack:** TypeScript, Jest (ts-jest), Angular 22 (app tasks).

**Spec:**
- `docs/superpowers/specs/2026-10-05-sha-equipment-design.md` (rule text, engine design, content, bots, UI, testing).
- `docs/superpowers/specs/2026-10-05-general-skills-design.md`, "Gender" and "Gender data": the rule and the data, pulled forward.
- `docs/superpowers/specs/2026-10-05-all-cards-and-skills-roadmap-design.md`: the stage table and the decisions ("may" always asks; no elemental damage).

**Already built in earlier stages (not redone here):**
- Equipment abilities (`triggers`, `modifiers.shaLimit`, `modifiers.ignoresArmor`) and `onUnequip`.
- `activeAbilities`, Crossbow, Black Pommel, Silver Lion, Wine, horses.
- Choices (`OpenChoiceEffect`, `ChooseOptionAction`), judgments (`JudgeEffect`, `onJudged`), turn flags, the Tool lifecycle.
- Printings for all eleven new cards are already in the data files.

**Where this plan departs from the specs, and why:**
- **Abilities hook in through before-triggers only.** The spec has Axe, Green Dragon Blade and Eight Trigrams listening `after:` a step. After-triggers fire on events, and their follow-ups run *ahead of* the step's own results. So an `after:` hook at `sha-dodged` or `sha-shan` would run in the wrong order. Instead every step ability is a `before:CardStepEffect` trigger:
  - A compulsory ability rewrites the step (Ancient Scimitar raises `data.extra`).
  - A stopping ability replaces the step with an `AbilityUsedEffect`, so the stop is logged (Black Shield, Wood Armor).
  - An optional ability replaces the step with an `AskUseEffect` whose Don't re-queues the step, marked so that ability isn't asked again.
  - `previewEffect` stops at a rewrite into another kind of effect. The step's later abilities get their say when the marked step comes back.
- **No `SkillTrigger.optional` flag yet.** Content builds its asks with `askAtStep`. The engine-side flag belongs with stage 6's "Reveal X to use Y", which needs it.
- **Names kept from stage 4.** `TriggerOwner` stays (as an alias of the new domain type `AbilityOwner`), and `gatherTriggeredSkills` keeps its name. The General owner's `skillId` comes with stage 6.
- **1-card conversions wait for stage 7.** Only Serpent Spear (2 cards) exists now, so `Conversion.cards` is `2`. The "As Sha" chip on hand cards waits with them.
- **A 2-card play conversion carries its targets.** `UseConversionAction` (play) is listed once per legal target list, like `PlayCardAction`. So there is no follow-up target choice. The action list groups them under one "Use 2 Cards as Sha" button.
- **The selection action is `SelectAction { ids }`.** One action covers card and seat selections (Sky Scorcher picks seats).
- **Deferred to stage 7, where something first needs them:**
  - "Shan needed: 2" in the Response dialog (nothing in stage 5 needs more than one Shan).
  - "Asked only if some legal response exists" (no stage 5 conversion makes a Peach or a Wuxie).
  - The `distanceToOthers`/`distanceFromOthers` modifiers (distance stays slot-based).
- **Ability-ask hints are content's display data.** The crawled rule text uses old terms ("attack", "escape"), so `content/display.ts` gains `abilityHint(id)`, for example "Discard 2 cards to make your Sha hit {target}".
- **The Response window states damage without Ancient Scimitar.** The window's display-only `outcome` is the base damage, with Wine. Scimitar's +1 is decided at step 5, after the window.
- **History wording.** An ability Use reads "Seat 2 used Axe on Hing". The spec's ": the Sha hits" follows from the next line ("Hing took 1 damage from Seat 2").

## Global Constraints

- **The engine names no card or skill.** Content supplies everything card-specific (CLAUDE.md, "Extensibility").
- **Game state stays plain serialisable data.** Continuations and asks hold effects, never functions. Absent optional state is left out (`pendingSelection` absent, not `null`).
- **Rule text (Sha-Equipment spec, verbatim in substance):**
  - **Sha's colour:** red or black. A Sha made from two cards is red if both are red, black if both are black, and has **no colour** otherwise; it has no suit and no rank.
  - **Steps, per target:**
    1. Targeted.
    2. Armour check.
    3. Shan asked.
    4. Dodged or hit.
    5. Damage.
    6. After damage.
  - **Counting:** a Sha played in your Play Phase counts toward the limit, and spends Wine, when it is played, whatever happens later.
  - **Black Pommel** turns off the target's armour from step 2 to step 5. That covers Eight Trigrams, Black Shield, Wood Armor and Silver Lion.
  - **Gender Swords** (range 2), may. At step 1, if the target's gender differs from yours, the target chooses: discard 1 hand card, or let you draw 1. A target with no hand cards must let you draw. A seat with no gender never differs.
  - **Sky Scorcher** (range 4), may. When you play your **last hand card** as a Sha in your Play Phase, add up to 2 more targets within your attack range. Each target goes through steps 2–6 on its own, in seat order from you.
  - **Serpent Spear** (range 3), conversion. Whenever you could play or use a Sha, you may use 2 hand cards as one Sha (Play Phase, Duel, Barbarians, Coerce). In your Play Phase it counts toward the limit.
  - **Axe** (range 3), may. At step 4, if dodged, discard 2 other cards from hand or equipment (not the Axe). The Sha then hits.
  - **Green Dragon Blade** (range 3), may. At step 4, if dodged, play another Sha at the same target. It doesn't count toward the limit, ignores range, and starts at step 1. This can repeat.
  - **Ice Sword** (range 2), may. At step 5, before damage, prevent it. Instead discard 2 of the target's cards, one at a time, each chosen as Break chooses (only 1 if it has only 1). Only if the target has at least 1 card.
  - **Ancient Scimitar** (range 2), compulsory. At step 5, if the target has no hand cards, +1 damage.
  - **Longbow** (range 5), may. At step 6, after your Sha damages a seat, discard one of its mounts. You choose if it wears both.
  - **Eight Trigrams**, may. Whenever you need a Shan (Sha or Hail of Arrows), judge first. Red counts as a Shan, though no card leaves your hand. On black you may still play a Shan. It provides at most one Shan.
  - **Black Shield**, compulsory. At step 2, a black Sha has no effect on you. A no-colour Sha still does.
  - **Wood Armor**, compulsory. At step 2, a Sha has no effect on you. Barbarians and Hail of Arrows skip you as a target, so there's no Wuxie check for you.
  - **How they combine:**
    - Scimitar's +1 comes before Silver Lion's cap.
    - Wine's +1 and Scimitar's +1 add together.
    - Ice Sword's prevention means no Longbow and no Scimitar.
    - A no-effect Sha still counts toward the limit and still spends Wine.
    - A Green Dragon Blade follow-up is a new Sha: Wine is already spent, and it gets its own armour check.
- **Gender rule (General Skills spec):** a seat's gender is its Main General's while the Main is revealed, else its Deputy's while that is revealed, else none. Base females: Diao Chan, Huang Yueying, Zhen Ji, Da Qiao, Sun Shangxiang. Expansion females: Xiao Qiao, Zhu Rong, Cai Wenji. Each General file gets `"gender"` and `source.genderFrom: "manual (standard character list)"`.
- **Bots (spec):**
  - **Free abilities:** always Use: Eight Trigrams, Longbow, Gender Swords, Sky Scorcher (extra targets at non-allies only).
  - **Axe:** Use only against a non-ally; discard the 2 least useful cards.
  - **Ice Sword:** Use when the target is a non-ally above 1 HP who wears equipment.
  - **Green Dragon Blade:** Use whenever holding another Sha.
  - **Serpent Spear:** convert only with no real Sha (or Shan to answer with), and when the 2 least useful hand cards aren't Peach.
  - **Gender Swords target:** discard a hand card when holding more than 2, else let them draw.
- **UI text** follows CLAUDE.md's UI text style. Buttons are Title Case ("Use", "Don't", "Add Targets", "Use 2 Cards as Sha"). Prompts and history lines use sentence case and keep keywords capitalised (Sha, Shan, Mount, HP, card names).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **A no-colour Sha against Black Shield.** Serpent Spear made from a red and a black card still hits a Black Shield wearer. (Test in Task 8.)
2. **A target gone mid-Sha.** With Sky Scorcher, a target eliminated before its turn in the steps is skipped: no window, no damage, no crash. (Test in Task 8.)
3. **Cancelling a conversion inside a response window.** Serpent Spear's selection, opened in a Duel and cancelled, leaves the Duel's window open and answerable. (Test in Task 4.)
4. **Eight Trigrams' judged card.** It is in the discard pile before the Shan window opens, and nothing is left in `processing`. (Test in Task 6.)
5. **Pausing on the new decisions.** A game paused on an ask or a selection survives a JSON round trip and resumes identically. The selecting seat's redacted view still lets it act. (Tests in Tasks 3 and 8.)

---

## File Structure

**Engine (`projects/engine/src/lib/`)**
- Modify:
  - `domain/types.ts`: `AbilityOwner`, `UsedCard.via`, `Damage.cause.card`, `PendingResponse.outcome`, the `ability` reason, the choice verb and option kinds, `PendingSelection`, `SelectionContinuation` and `GameState.pendingSelection`.
  - `domain/usedCard.ts`: `usedCardFrom`, `colourOf`, `usedCardKey`.
  - `registry/types.ts`: `TriggerOwner` alias, `PlayContext.card`/`free`, the registry argument on `play`, `ResponseContext.card`, `JudgedContext.data`, `onStep`, `Conversion`, `Abilities.conversions` and `AbilityModifiers.untargetableBy`.
  - `pipeline/effects.ts`: the new effects (`CardStepEffect`, `AskUseEffect`, `AbilityUsedEffect`, `OpenSelectionEffect`), `MoveCardEffect.onlyFrom` and `JudgeEffect.data`.
  - `pipeline/events.ts`: `CardPlayedEvent.card` becomes `UsedCard`, plus `AbilityUsedEvent` and `SelectionMadeEvent`.
  - `pipeline/actions.ts`: `SelectAction`, `CancelSelectionAction`, `UseConversionAction`.
  - `pipeline/resolve.ts`: `useCard`, the step dispatch, the selection and conversion actions, and pausing on a selection.
  - `pipeline/judgment.ts`: `data`, `onlyFrom`.
  - `rules/legality.ts`, `rules/activeSeat.ts`, `domain/redact.ts`.
- Create:
  - `pipeline/cardStep.ts`
  - `rules/selection.ts` (`validateSelection`)
  - `rules/conversions.ts` (`conversionsOf`, `conversionActions`)
  - Tests: `domain/usedCard.spec.ts`, `pipeline/cardStep.spec.ts`, `pipeline/selection.spec.ts`, `pipeline/conversion.spec.ts`
- `public-api.ts`: export the new files.

**Content (`projects/content/`)**
- Move `src/lib/cards/equipment.ts` to `src/lib/cards/equipment/index.ts`.
- Create in `src/lib/cards/equipment/`:
  - `eight-trigrams.ts`, `black-shield.ts`, `wood-armor.ts`
  - `gender-swords.ts`, `ancient-scimitar.ts`, `ice-sword.ts`, `longbow.ts`
  - `axe.ts`, `green-dragon-blade.ts`, `sky-scorcher.ts`, `serpent-spear.ts`
  - `sha-equipment.spec.ts` (grows over Tasks 6–8)
- Create: `src/lib/shared/steps.ts`, `src/lib/cards/sha-steps.spec.ts`, `src/lib/shared/gender.ts` (+spec).
- Modify:
  - Cards: `src/lib/cards/sha.ts`, `coerce.ts`, `mass-attack.ts`.
  - Shared: `src/lib/shared/abilities.ts`.
  - `src/lib/registry.ts`, `src/lib/display.ts`.
  - Tests: `cards.spec.ts`, `tools.spec.ts`, `wine.spec.ts`, `equipment-abilities.spec.ts`, `registry.spec.ts`, `modes/kingdomWar.spec.ts`.
- Data:
  - The 57 General files in `data/generals/*/*.json`.
  - `data/generals/index.ts` (the `gender` field).
  - `scripts/restructure-content-data.py` (the same field).

**Bots:** modify `projects/bots/src/lib/rule-based.ts`, `random.ts` and their specs.

**Sim:** modify `projects/sim/src/invariants.ts` (+spec).

**App (`projects/app/src/app/`)**
- Modify:
  - `labels.ts`, `decision-timer.service.ts`.
  - `game-board/`:
    - `action-history.ts`, `response-description.ts`
    - `choice-description.ts`, `choice-dialog.ts`
    - `action-list.ts`, `response-dialog.ts`, `game-board.ts`
- Create in `game-board/`:
  - `ask-dialog.ts`, `selection-dialog.ts`
  - `ability-description.ts`
  - Each with a spec.

**Docs:** modify `docs/architecture/event-chain.md`.

---

### Task 1: `UsedCard` everywhere; one `useCard` path

Behaviour doesn't change in this task. Every card in use becomes a `UsedCard`, so a conversion can later produce one with two physical cards.

**Files:**
- Modify:
  - Engine: `domain/types.ts`, `domain/usedCard.ts`, `registry/types.ts`, `pipeline/events.ts`, `pipeline/resolve.ts`.
  - Content: `cards/sha.ts`, `cards/coerce.ts`, `shared/abilities.ts`.
  - App: `game-board/action-history.ts`, `game-board/response-description.ts`.
- Create: `projects/engine/src/lib/domain/usedCard.spec.ts`
- Modify tests:
  - Engine: `pipeline/resolve.spec.ts`.
  - Content: `cards/cards.spec.ts`, `cards/tools.spec.ts`, `cards/wine.spec.ts`, `cards/equipment-abilities.spec.ts`.
  - App: `response-description.spec.ts`, `action-history.spec.ts`.

**Interfaces:**
- Produces:

```ts
// domain/types.ts
export type AbilityOwner =
  | { kind: 'general'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'equipment'; seatId: string; cardInstanceId: string };
export interface UsedCard {
  as: string; colour: 'red' | 'black' | 'none'; suit?: CardInstance['suit']; rank?: number;
  physical: CardInstance[];
  via?: { owner: AbilityOwner; abilityId: string; conversionId: string };
}
// Damage.cause gains `card?: UsedCard`.
// domain/usedCard.ts
export function colourOf(card: Pick<CardInstance, 'suit'>): 'red' | 'black';
export function usedCardFrom(cards: CardInstance[], as: string, via?: UsedCard['via']): UsedCard;
export function usedCardKey(card: UsedCard): string; // 'a+b', or 'virtual' for none
// registry/types.ts
export type TriggerOwner = AbilityOwner;
export interface PlayContext { seatId: string; cardInstanceId: string; card: UsedCard; targets: Target[]; respondingTo?: string; free?: boolean }
// CardDefinition.play(state, ctx, registry)
export interface ResponseContext { pending: PendingResponse; seatId: string; cardInstanceId: string; card: UsedCard }
// events.ts: CardPlayedEvent.card: UsedCard
// content: shaWindow(card: UsedCard, fromSeatId: string, target: Target, amount?: number): Effect
```

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/domain/usedCard.spec.ts`:

```ts
import { CardInstance } from './types';
import { colourOf, usedCardFrom, usedCardKey, usedCardOf } from './usedCard';

const c = (instanceId: string, suit: CardInstance['suit']): CardInstance => ({ instanceId, definitionId: 'filler', suit, rank: 4 });
const via = { owner: { kind: 'equipment' as const, seatId: 'a', cardInstanceId: 'spear' }, abilityId: 'serpent-spear', conversionId: 'serpent-spear' };

describe('used cards', () => {
  it('reads hearts and diamonds as red, spades and clubs as black', () => {
    expect([colourOf(c('1', 'heart')), colourOf(c('2', 'diamond')), colourOf(c('3', 'spade')), colourOf(c('4', 'club'))]).toEqual(['red', 'red', 'black', 'black']);
  });

  it('one card used as itself keeps its suit, rank and colour', () => {
    expect(usedCardFrom([c('1', 'heart')], 'filler')).toEqual(usedCardOf(c('1', 'heart')));
  });

  it('two cards: red if both red, black if both black, else no colour; never a suit or rank', () => {
    expect(usedCardFrom([c('1', 'heart'), c('2', 'diamond')], 'sha')).toEqual({ as: 'sha', colour: 'red', physical: [c('1', 'heart'), c('2', 'diamond')] });
    expect(usedCardFrom([c('1', 'spade'), c('2', 'club')], 'sha').colour).toBe('black');
    expect(usedCardFrom([c('1', 'heart'), c('2', 'club')], 'sha').colour).toBe('none');
  });

  it('keeps the conversion that made it', () => {
    expect(usedCardFrom([c('1', 'heart'), c('2', 'club')], 'sha', via).via).toEqual(via);
  });

  it('is keyed by its physical cards, or "virtual" with none', () => {
    expect(usedCardKey(usedCardFrom([c('a', 'heart'), c('b', 'club')], 'sha'))).toBe('a+b');
    expect(usedCardKey({ as: 'sha', colour: 'none', physical: [] })).toBe('virtual');
  });
});
```

In `projects/content/src/lib/cards/cards.spec.ts`, the logged plays now carry used cards. Replace the `expect(next.log.filter(...)).toEqual([...])` block of "logs who used which card on whom" with:

```ts
    expect(next.log.filter((e) => e.kind === 'CardPlayedEvent')).toEqual([
      {
        kind: 'CardPlayedEvent', seatId: 'seat-a', targets: [{ kind: 'seat', seatId: 'seat-b' }],
        card: { as: 'sha', colour: 'black', suit: 'spade', rank: 1, physical: [{ instanceId: 'sha-1', definitionId: 'sha', suit: 'spade', rank: 1 }] },
      },
      {
        kind: 'CardPlayedEvent', seatId: 'seat-b', targets: [], inResponseTo: { seatId: 'seat-a', cardInstanceId: 'sha-1' },
        card: { as: 'shan', colour: 'black', suit: 'club', rank: 2, physical: [{ instanceId: 'shan-1', definitionId: 'shan', suit: 'club', rank: 2 }] },
      },
    ]);
```

In `projects/content/src/lib/cards/equipment-abilities.spec.ts`, Silver Lion's Black Pommel check now reads the damage's cause card:
- Add `usedCardOf` to the `engine` import.
- Replace the `hit` helper with:

```ts
  const hit = (amount: number, cause?: CardInstance, from: string | null = 'seat-a'): QueueItem => ({
    kind: 'DamageEffect',
    damage: {
      source: from ? { kind: 'seat', seatId: from } : null, target: { kind: 'seat', seatId: 'seat-b' }, amount, nature: 'normal',
      ...(cause ? { cause: { cardInstanceId: cause.instanceId, card: usedCardOf(cause) } } : {}),
    } as Damage,
  });
```

Then change `hit(2, 's1')` to `hit(2, card('s1', 'sha'))` and `hit(2, 'd1')` to `hit(2, card('d1', 'shan'))`.

In `projects/content/src/lib/cards/wine.spec.ts`:
- Add `usedCardOf` to the `engine` import.
- In `boostedSha`, change `cause: { cardInstanceId: 's1' }` to `cause: { cardInstanceId: 's1', card: usedCardOf(card('s1', 'sha')) }`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/engine/src/lib/domain/usedCard.spec.ts projects/content/src/lib/cards`
Expected: FAIL. `usedCardFrom` doesn't exist, and plays still log a bare card.

- [ ] **Step 3: Domain types and `usedCard.ts`**

In `projects/engine/src/lib/domain/types.ts`, add after `Target`:

```ts
// Who an ability belongs to: a General's skill (the seat and slot it was
// gathered for: the same General can be held by more than one seat), or a worn
// card (its wearer and the card).
export type AbilityOwner =
  | { kind: 'general'; seatId: string; slot: 'main' | 'deputy' }
  | { kind: 'equipment'; seatId: string; cardInstanceId: string };
```

Replace the `UsedCard` interface with:

```ts
// A card as it is being used: what it counts as, its colour, and the physical
// cards behind it (one normally; none for a card a skill makes, two for a
// Serpent Spear Sha). `via` names the conversion that made it, if any.
export interface UsedCard {
  as: string;
  colour: 'red' | 'black' | 'none';
  suit?: CardInstance['suit'];
  rank?: number;
  physical: CardInstance[];
  via?: { owner: AbilityOwner; abilityId: string; conversionId: string };
}
```

In `Damage`, change `cause` to:

```ts
  // What caused it. `card` is the card as used (a Serpent Spear Sha has two
  // physical cards); `cardInstanceId` is its first physical card, if any.
  cause?: { cardInstanceId?: string; card?: UsedCard; skillId?: string };
```

Replace `projects/engine/src/lib/domain/usedCard.ts` with:

```ts
import { CardInstance, UsedCard } from './types';

export function colourOf(card: Pick<CardInstance, 'suit'>): 'red' | 'black' {
  return card.suit === 'heart' || card.suit === 'diamond' ? 'red' : 'black';
}

// One physical card used as itself.
export function usedCardOf(card: CardInstance): UsedCard {
  return { as: card.definitionId, colour: colourOf(card), suit: card.suit, rank: card.rank, physical: [card] };
}

// Cards used together as one `as` card (Serpent Spear's 2 hand cards as a Sha):
// red if all are red, black if all are black, otherwise no colour. A single
// card keeps its suit and rank; two or more have none.
export function usedCardFrom(cards: CardInstance[], as: string, via?: UsedCard['via']): UsedCard {
  const colours = new Set(cards.map(colourOf));
  return {
    as,
    colour: colours.size === 1 ? [...colours][0] : 'none',
    ...(cards.length === 1 ? { suit: cards[0].suit, rank: cards[0].rank } : {}),
    physical: cards,
    ...(via ? { via } : {}),
  };
}

// A used card's identity for ids: its physical cards' instance ids, or
// 'virtual' for a card with none.
export function usedCardKey(card: UsedCard): string {
  return card.physical.map((c) => c.instanceId).join('+') || 'virtual';
}
```

- [ ] **Step 4: Registry types and the event**

In `projects/engine/src/lib/registry/types.ts`:
- Import `AbilityOwner` from `'../domain/types'`.
- Replace the `PlayContext` interface with:

```ts
export interface PlayContext {
  seatId: string;
  // The first physical card's instance id ('' for a card with none).
  cardInstanceId: string;
  // The card as used: itself, or what a conversion made it.
  card: UsedCard;
  targets: Target[];
  respondingTo?: string;
  // Played by an ability, outside the Play Phase's limits (Green Dragon
  // Blade's follow-up Sha): it never counts toward a limit or spends Wine.
  free?: boolean;
}
```

- Change `play` in `CardDefinition` to:

```ts
  play(state: GameState, ctx: PlayContext, registry: ContentRegistry): unknown[];
```

- Add to `ResponseContext`, after `cardInstanceId`:

```ts
  // The answering card as used (two physical cards for a Serpent Spear Sha).
  card: UsedCard;
```

- Replace the `TriggerOwner` type and its comment with:

```ts
// Who a gathered trigger acts for. `owner` is undefined only for a mode's own
// triggers. (The domain name is AbilityOwner.)
export type TriggerOwner = AbilityOwner;
```

In `projects/engine/src/lib/pipeline/events.ts`, change `CardPlayedEvent.card` and its comment:

```ts
// A seat used a card: played it in its Play phase, or answered a pending
// response with it. Played cards are face-up, so the face is public. `card` is
// the card as used: one physical card normally, two for a Serpent Spear Sha.
export interface CardPlayedEvent {
  kind: 'CardPlayedEvent';
  seatId: string;
  card: UsedCard;
```

(leave `targets` and `inResponseTo` as they are).

- [ ] **Step 5: One `useCard` path in `resolve.ts`**

In `projects/engine/src/lib/pipeline/resolve.ts`:
- Add to the imports: `PendingResponse, Target, UsedCard` from `'../domain/types'`, and `usedCardOf` from `'../domain/usedCard'`.
- Add before `resolveAction`:

```ts
interface UseOptions {
  targets: Target[];
  // The window this use answers; absent for a play.
  respondTo?: PendingResponse;
  // Counted toward per-turn limits (turn.cardPlays): a proactive play.
  counted: boolean;
  // Played by an ability, outside the Play Phase's limits.
  free?: boolean;
}

// What an answer to `pending` answered, for the log.
function inResponseToOf(pending: PendingResponse): NonNullable<CardPlayedEvent['inResponseTo']> {
  const reason = pending.reason;
  if (reason?.kind === 'wuxie') {
    return {
      seatId: reason.toolUserSeatId,
      ...(reason.tool.physical[0] ? { cardInstanceId: reason.tool.physical[0].instanceId } : {}),
      ...(reason.target.kind === 'seat' ? { targetSeatId: reason.target.seatId } : {}),
    };
  }
  if (reason?.kind === 'counter-wuxie') return { seatId: reason.wuxieSeatId, counters: true };
  if (reason?.kind === 'card-effect') {
    return { seatId: reason.userSeatId, ...(reason.card.physical[0] ? { cardInstanceId: reason.card.physical[0].instanceId } : {}) };
  }
  const answered = pending.context.effect.kind === 'DamageEffect' ? pending.context.effect.damage : null;
  return {
    ...(answered?.source?.kind === 'seat' ? { seatId: answered.source.seatId } : {}),
    ...(answered?.cause?.cardInstanceId ? { cardInstanceId: answered.cause.cardInstanceId } : {}),
    ...(reason?.kind === 'dying' ? { dyingSeatId: reason.seatId } : {}),
  };
}

// One card used, as itself or as what a conversion made it: logs the
// CardPlayedEvent, then queues the physical cards' trip to the discard pile,
// the event's after-triggers, the card's own effects and, for an answer, what
// the window says answering leads to. The caller has checked legality.
function useCard(state: GameState, seatId: string, used: UsedCard, options: UseOptions, ctx: EngineContext): ResolveResult {
  const definition = lookupCard(ctx.registry, used.as);
  const pending = options.respondTo;
  const event: CardPlayedEvent = {
    kind: 'CardPlayedEvent',
    seatId,
    card: used,
    targets: options.targets,
    ...(pending ? { inResponseTo: inResponseToOf(pending) } : {}),
  };
  const afterLog = logged(pending ? { ...state, pendingResponse: null } : state, [event]);
  const cardInstanceId = used.physical[0]?.instanceId ?? '';
  const effects = definition.play(
    afterLog,
    {
      seatId,
      cardInstanceId,
      card: used,
      targets: options.targets,
      ...(pending ? { respondingTo: pending.id } : {}),
      ...(options.free ? { free: true } : {}),
    },
    ctx.registry
  ) as Effect[];
  // Counted when played, for per-turn limits, whatever happens next.
  const plays = afterLog.turn.cardPlays ?? {};
  const counted: GameState = options.counted
    ? { ...afterLog, turn: { ...afterLog.turn, cardPlays: { ...plays, [used.as]: (plays[used.as] ?? 0) + 1 } } }
    : afterLog;
  // A used card leaves the hand at once, so it can't be reused mid-resolution.
  // Equipment and delayed Tools played as themselves are placed by their own play().
  const placesItself = !pending && !used.via && (definition.category === 'equipment' || !!definition.delayed);
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  const leaveHand: Effect[] = placesItself
    ? []
    : used.physical.map((c) => ({ kind: 'MoveCardEffect', cardInstanceId: c.instanceId, toZoneId: discardPileId }));
  // The opening card's say in what the answer leads to (e.g. a Duel turning back).
  const fromSource = pending?.sourceCard
    ? ((lookupCard(ctx.registry, pending.sourceCard.definitionId).onResponse?.(afterLog, { pending, seatId, cardInstanceId, card: used }) ?? []) as Effect[])
    : [];
  const followUps = afterTriggerFollowUps(counted, [event], ctx);
  return {
    state: queueFront(counted, [...leaveHand, ...followUps, ...effects, ...(pending?.onAnswer ?? []), ...fromSource]),
    events: [event],
  };
}
```

- In `case 'PlayCardAction'`, keep every check up to and including the `allowed.some(...)` legality throw. Replace everything after it (from `const cardDefinition = ...` to the `return`) with:

```ts
      return useCard(state, action.seatId, usedCardOf(cardInHand), { targets: action.targets, counted: true }, ctx);
```

- In `case 'RespondAction'`, keep every check up to and including the `allowedCardIds` throw. Replace everything after it (from `const cardDefinition = ...` to the closing `return`) with:

```ts
      return useCard(state, action.seatId, usedCardOf(cardInHand), { targets: [], respondTo: pending, counted: false }, ctx);
```

- [ ] **Step 6: Content**

In `projects/content/src/lib/cards/sha.ts`:
- Import `UsedCard` (type) and `usedCardKey` from `engine`.
- Change `shaWindow` to take the used card:

```ts
// The window a Sha opens: `target` plays a Shan or takes 1 damage from
// `fromSeatId`. Shared with Coerce, whose Sha is played as an answer.
export function shaWindow(card: UsedCard, fromSeatId: string, target: Target, amount = 1): Effect {
  const first = card.physical[0]?.instanceId;
  return {
    kind: 'OpenResponseEffect',
    pendingResponse: {
      id: `sha-response-${usedCardKey(card)}`,
      respondingSeatId: target.seatId,
      allowedActionKinds: ['RespondAction', 'PassAction'],
      allowedCardIds: ['shan'],
      context: {
        effect: {
          kind: 'DamageEffect',
          damage: { source: { kind: 'seat', seatId: fromSeatId }, target, amount, nature: 'normal', cause: { ...(first ? { cardInstanceId: first } : {}), card } },
        },
      },
    },
  };
}
```

- In `shaCard.play`, change the last line to `return [...spend, shaWindow(ctx.card, ctx.seatId, ctx.targets[0], boosted ? 2 : 1)];`.

In `projects/content/src/lib/cards/coerce.ts`, change `onResponse` to read the used card:

```ts
  onResponse: (state, { pending, seatId, card }) => {
    const victimSeatId = pending.reason?.kind === 'card-effect' ? pending.reason.victimSeatId : undefined;
    const victim = state.seats.find((s) => s.id === victimSeatId && !s.eliminated);
    return victim ? [shaWindow(card, seatId, seat(victim.id))] : [];
  },
```

In `projects/content/src/lib/shared/abilities.ts`, replace `armorIgnored` with:

```ts
// Whether armour has no effect on `damage`: it comes from a Sha whose user has
// an ability that ignores armour (Black Pommel).
export function armorIgnored(state: GameState, damage: Damage, registry: ContentRegistry): boolean {
  if (damage.cause?.card?.as !== 'sha' || damage.source?.kind !== 'seat') return false;
  return activeAbilities(state, damage.source.seatId, registry).some((a) => a.modifiers?.ignoresArmor);
}
```

Direct `play()` calls in tests now need the used card and the registry. Make these three changes, adding `usedCardOf` to each file's `engine` import:
- `cards/cards.spec.ts`: `shaCard.play(state, { seatId: 'seat-a', cardInstanceId: 'sha-1', card: usedCardOf(state.zones[1].cards[0]), targets: [] }, registry())`.
- `cards/tools.spec.ts`, the Duel no-op: `duelCard.play(state, { seatId: 'seat-a', cardInstanceId: 'card-1', card: { as: 'duel', colour: 'black', physical: [] }, targets: [] }, registry())`.
- `cards/wine.spec.ts`: `shaCard.play(boosted, { seatId: 'seat-a', cardInstanceId: 's1', card: usedCardOf(card('s1', 'sha')), targets: [], respondingTo: 'x' }, registry)`.

- [ ] **Step 7: Engine and app tests that build `CardPlayedEvent`s**

In `projects/engine/src/lib/pipeline/resolve.spec.ts`:
- Import `usedCardOf` from `'../domain/usedCard'`.
- In the expected events of the test around line 156, change `card: { instanceId: 'test-card-1', ... }` to `card: usedCardOf({ instanceId: 'test-card-1', definitionId: 'test-damage-card', suit: 'spade', rank: 5 })`.

In `projects/app/src/app/game-board/action-history.spec.ts` and `response-description.spec.ts`:
- Import `usedCardOf` from `'engine'`.
- Wrap every `CardPlayedEvent`'s `card` value:

```bash
sed -i '' -E "s/(kind: 'CardPlayedEvent'.*card: )([a-zA-Z]+)(, targets)/\1usedCardOf(\2)\3/" projects/app/src/app/game-board/action-history.spec.ts projects/app/src/app/game-board/response-description.spec.ts
```

Then hand-fix the one the pattern misses in `action-history.spec.ts`: `card: { ...peach, instanceId: 'peach-2' }` becomes `card: usedCardOf({ ...peach, instanceId: 'peach-2' })`.

- [ ] **Step 8: The app reads used cards**

In `projects/app/src/app/game-board/action-history.ts`:
- Import `UsedCard` from `'engine'`.
- Change `const playedCards = new Map<string, CardInstance>();` to `const playedCards = new Map<string, UsedCard>();`.
- Add after `named`:

```ts
// A used card for a history line: "Sha (7 ♠)" for one card used as itself,
// otherwise its name.
const usedLabel = (used: UsedCard) =>
  used.physical.length === 1 && used.physical[0].definitionId === used.as ? named(used.physical[0]) : cardName(used.as);
// The card shown beside a line: the physical card, when there is exactly one.
const faceOf = (used: UsedCard): CardInstance | null => (used.physical.length === 1 ? used.physical[0] : null);
```

- Replace the whole `case 'CardPlayedEvent'` block with:

```ts
      case 'CardPlayedEvent': {
        const used = event.card;
        for (const c of used.physical) {
          playedCards.set(c.instanceId, used);
          awaitingMove.add(c.instanceId);
        }
        const face = faceOf(used);
        const answered = event.inResponseTo;
        if (answered?.dyingSeatId) {
          const saved = answered.dyingSeatId === event.seatId ? 'themselves' : name(answered.dyingSeatId);
          action(`${name(event.seatId)} used ${usedLabel(used)} to save ${saved}`, face);
        } else if (answered?.counters && answered.seatId) {
          action(`${name(event.seatId)} cancelled ${name(answered.seatId)}'s ${cardName(used.as)} with ${usedLabel(used)}`, face);
        } else if (answered?.targetSeatId && answered.seatId) {
          const tool = answered.cardInstanceId ? playedCards.get(answered.cardInstanceId) : undefined;
          const toolName = tool ? cardName(tool.as) : 'Tool';
          const on = answered.targetSeatId === answered.seatId ? '' : ` on ${name(answered.targetSeatId)}`;
          action(`${name(event.seatId)} cancelled ${name(answered.seatId)}'s ${toolName}${on} with ${usedLabel(used)}`, face);
        } else if (answered) {
          const answeredCard = answered.cardInstanceId ? playedCards.get(answered.cardInstanceId) : undefined;
          const against = answered.seatId
            ? ` against ${name(answered.seatId)}${answeredCard ? `'s ${cardName(answeredCard.as)}` : ''}`
            : ' in response';
          action(`${name(event.seatId)} used ${usedLabel(used)}${against}`, face);
        } else if (cardDisplayData(used.as)?.category === 'equipment') {
          action(`${name(event.seatId)} equipped ${usedLabel(used)}`, face);
        } else if (event.targets.length > 0) {
          action(`${name(event.seatId)} used ${usedLabel(used)} on ${event.targets.map(target).join(', ')}`, face);
        } else {
          action(`${name(event.seatId)} used ${usedLabel(used)}`, face);
        }
        break;
      }
```

In `projects/app/src/app/game-board/response-description.ts`:
- In `lastPlayOf`, change the match to `event.kind === 'CardPlayedEvent' && event.card.physical.some((c) => c.instanceId === instanceId)`.
- Change `cardName(played.card)` (both uses) to `cardName({ definitionId: played.card.as })`.
- In the `latest` loop, change `cardName(event.card)` to `cardName({ definitionId: event.card.as })`.

- [ ] **Step 9: Run everything**

Run: `npx jest`
Expected: PASS, every project. Fix any remaining type error the compiler names by the same pattern: wrap a bare card with `usedCardOf(...)`, or read `.as` instead of `.definitionId` on an event's card.

- [ ] **Step 10: Commit**

```bash
git add projects
git commit -m "refactor(engine): every card in use is a UsedCard; one useCard path for plays and answers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: Card steps, asking to use, and logging an ability

**Files:**
- Create: `projects/engine/src/lib/pipeline/cardStep.ts`, `projects/engine/src/lib/pipeline/cardStep.spec.ts`
- Modify:
  - Engine: `domain/types.ts`, `registry/types.ts`, `pipeline/effects.ts`, `pipeline/events.ts`, `pipeline/judgment.ts`, `pipeline/resolve.ts`.
  - App: `game-board/choice-description.ts` (+spec), `game-board/choice-dialog.ts`, `game-board/action-history.ts`.
  - Bots: `rule-based.ts`.

**Interfaces:**
- Consumes: `AbilityOwner`, `UsedCard` (Task 1).
- Produces:

```ts
// effects.ts
| { kind: 'CardStepEffect'; step: string; card: UsedCard; userSeatId: string; target: Target; data?: Record<string, unknown> }
| { kind: 'AskUseEffect'; owner: AbilityOwner; abilityId: string; effects: Effect[]; otherwise?: Effect[]; targetSeatId?: string }
| { kind: 'AbilityUsedEffect'; owner: AbilityOwner; abilityId: string; outcome: string; targetSeatId?: string }
// MoveCardEffect gains onlyFrom?: string; JudgeEffect gains data?: Record<string, unknown>
// registry/types.ts
onStep?(state: GameState, step: Extract<Effect, { kind: 'CardStepEffect' }>): unknown[]; // on CardDefinition
// JudgedContext gains data?: Record<string, unknown>
// domain/types.ts
// DecisionReason gains { kind: 'ability'; owner: AbilityOwner; abilityId: string; targetSeatId?: string }
// PendingChoice.verb: 'take' | 'discard' | 'use'
// ChoiceOption.shows gains { kind: 'use' } | { kind: 'decline' }
// PendingResponse gains outcome?: Effect
// events.ts
export interface AbilityUsedEvent { kind: 'AbilityUsedEvent'; owner: AbilityOwner; abilityId: string; outcome: string; targetSeatId?: string }
// An AskUseEffect's choice: options 'use' then 'decline'; id `ask-<abilityId>-<seatId>-<log length>`.
```

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/pipeline/cardStep.spec.ts`:

```ts
import { advanceToDecision, previewEffect, resolve } from './resolve';
import { Effect } from './effects';
import { createRng } from '../rng/rng';
import { usedCardOf } from '../domain/usedCard';
import { AbilityOwner, CardInstance, GameState, QueueItem } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, SkillTrigger } from '../registry/types';

type Step = Extract<Effect, { kind: 'CardStepEffect' }>;

const bolt: CardInstance = { instanceId: 'bolt-1', definitionId: 'bolt', suit: 'heart', rank: 3 };
const charm: CardInstance = { instanceId: 'charm-1', definitionId: 'charm', suit: 'spade', rank: 1 };
const charmOwner: AbilityOwner = { kind: 'equipment', seatId: 'b', cardInstanceId: 'charm-1' };
const step = (name: string, data: Record<string, unknown> = {}): Step => ({
  kind: 'CardStepEffect', step: name, card: usedCardOf(bolt), userSeatId: 'a', target: { kind: 'seat', seatId: 'b' }, data,
});

// Bolt: 'aim' leads to 'strike'; 'strike' deals 1 damage, plus data.extra, to the target.
const boltCard: CardDefinition = {
  id: 'bolt', name: 'Bolt', category: 'basic', play: () => [],
  onStep: (_state, s) =>
    s.step === 'aim'
      ? [{ ...s, step: 'strike' }]
      : [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: s.userSeatId }, target: s.target, amount: 1 + Number(s.data?.['extra'] ?? 0), nature: 'normal' } }],
};
const plainCard: CardDefinition = { id: 'plain', name: 'Plain', category: 'basic', play: () => [] };

// Seat b wears a charm whose abilities are `triggers`.
function ctxWith(triggers: SkillTrigger[] = [], more: CardDefinition[] = []) {
  const charmCard: CardDefinition = { id: 'charm', name: 'Charm', category: 'equipment', equipSlot: 'armor', play: () => [], abilities: { triggers } };
  const registry: ContentRegistry = { cards: new Map([boltCard, plainCard, charmCard, ...more].map((c) => [c.id, c])), generals: new Map() };
  const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
  return { registry, mode };
}
const atStrike = (
  effect: SkillTrigger['effect'],
  condition: SkillTrigger['condition'] = (_s, x) => (x as Step).step === 'strike'
): SkillTrigger => ({ point: 'before:CardStepEffect', condition, effect });

function table(queue: QueueItem[] = [], drawPile: CardInstance[] = []): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'none', revealed: true }, deputy: { generalDefinitionId: 'none', revealed: true } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: drawPile },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [charm] },
    ],
    pendingResponse: null, ...(queue.length > 0 ? { resolutionQueue: queue } : {}),
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}
const hpB = (s: GameState) => s.seats[1].combinedHp;
const run = (s: GameState, ctx = ctxWith()) => advanceToDecision(s, ctx).state;
const cardsIn = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);

describe('card steps', () => {
  it('applying a step queues what the card’s onStep says, at the front', () => {
    const next = run(table([step('aim')]));
    expect(hpB(next)).toBe(3);
    expect(next.log.map((e) => e.kind)).toEqual(['DamageDealtEvent']);
  });

  it('a before-trigger may rewrite a step', () => {
    expect(hpB(run(table([step('aim')]), ctxWith([atStrike((_s, x) => [{ ...(x as Step), data: { extra: 1 } }])])))).toBe(2);
  });

  it('a before-trigger returning nothing cancels the step', () => {
    expect(hpB(run(table([step('aim')]), ctxWith([atStrike(() => [])])))).toBe(4);
  });

  it('a card with no onStep can’t take a step', () => {
    const odd: Step = { ...step('aim'), card: usedCardOf({ ...bolt, definitionId: 'plain' }) };
    expect(() => run(table([odd]))).toThrow('Card plain has no onStep');
  });
});

describe('previewing rewrites', () => {
  it('checks each later trigger against the step as rewritten so far', () => {
    const addOne = atStrike((_s, x) => [{ ...(x as Step), data: { extra: 1 } }]);
    // Would make it 5, but only while nothing has been added yet.
    const addFive = atStrike(
      (_s, x) => [{ ...(x as Step), data: { extra: 5 } }],
      (_s, x) => (x as Step).step === 'strike' && (x as Step).data?.['extra'] === undefined
    );
    expect(previewEffect(table(), step('strike'), ctxWith([addOne, addFive]))).toMatchObject({ data: { extra: 1 } });
  });

  it('stops once a trigger turns the step into another kind of effect', () => {
    const ask = atStrike((_s, x) => [{ kind: 'AskUseEffect', owner: charmOwner, abilityId: 'charm', effects: [], otherwise: [x as Step] }]);
    const cancel = atStrike(() => []);
    expect(previewEffect(table(), step('strike'), ctxWith([ask, cancel]))).toMatchObject({ kind: 'AskUseEffect' });
  });
});

describe('asking to use an ability', () => {
  const draw: Effect = { kind: 'DrawCardsEffect', seatId: 'b', count: 1 };
  const ask = (otherwise: Effect[] = []): Effect => ({ kind: 'AskUseEffect', owner: charmOwner, abilityId: 'charm', effects: [draw], otherwise, targetSeatId: 'a' });
  const asked = (otherwise: Effect[] = []) => run(table([ask(otherwise)], [{ ...bolt, instanceId: 'd1' }]));
  const choose = (s: GameState, optionId: string) => resolve(s, { kind: 'ChooseOptionAction', seatId: 'b', choiceId: s.pendingChoice!.id, optionId }, ctxWith()).state;

  it('asks the owner’s seat, with Use and Don’t', () => {
    expect(asked().pendingChoice).toMatchObject({
      seatId: 'b',
      verb: 'use',
      reason: { kind: 'ability', owner: charmOwner, abilityId: 'charm', targetSeatId: 'a' },
      options: [{ id: 'use', shows: { kind: 'use' } }, { id: 'decline', shows: { kind: 'decline' } }],
    });
  });

  it('Use queues the ability’s effects, and the pick is logged', () => {
    const next = choose(asked(), 'use');
    expect(cardsIn(next, 'b:hand')).toEqual(['d1']);
    expect(next.log.find((e) => e.kind === 'ChoiceMadeEvent')).toMatchObject({ seatId: 'b', verb: 'use', shows: { kind: 'use' } });
  });

  it('Don’t queues what happens otherwise', () => {
    const next = choose(asked([{ kind: 'MoveCardEffect', cardInstanceId: 'charm-1', toZoneId: 'a:hand' }]), 'decline');
    expect(cardsIn(next, 'b:hand')).toEqual([]);
    expect(cardsIn(next, 'a:hand')).toEqual(['charm-1']);
  });

  it('an owner who is out isn’t asked: what happens otherwise goes ahead', () => {
    const s = table([{ ...ask([{ kind: 'MoveCardEffect', cardInstanceId: 'charm-1', toZoneId: 'a:hand' }]) }]);
    const next = run({ ...s, seats: [s.seats[0], { ...s.seats[1], eliminated: true }] });
    expect(next.pendingChoice).toBeUndefined();
    expect(cardsIn(next, 'a:hand')).toEqual(['charm-1']);
  });
});

describe('small engine pieces', () => {
  it('AbilityUsedEffect logs who used what, and to what end', () => {
    const next = run(table([{ kind: 'AbilityUsedEffect', owner: charmOwner, abilityId: 'charm', outcome: 'no-effect', targetSeatId: 'a' }]));
    expect(next.log).toEqual([{ kind: 'AbilityUsedEvent', owner: charmOwner, abilityId: 'charm', outcome: 'no-effect', targetSeatId: 'a' }]);
  });

  it('MoveCardEffect with onlyFrom moves the card only while it is still there', () => {
    expect(run(table([{ kind: 'MoveCardEffect', cardInstanceId: 'charm-1', toZoneId: 'discardPile', onlyFrom: 'processing' }])).log).toEqual([]);
    const moved = run(table([{ kind: 'MoveCardEffect', cardInstanceId: 'charm-1', toZoneId: 'a:hand', onlyFrom: 'b:equip' }]));
    expect(cardsIn(moved, 'a:hand')).toEqual(['charm-1']);
  });

  it('a judgment passes its data to the reader, and skips the judged card’s move if the reader already moved it', () => {
    const seen: unknown[] = [];
    const omen: CardDefinition = {
      id: 'omen', name: 'Omen', category: 'basic', play: () => [],
      onJudged: (_state, { judged, data }) => {
        seen.push(data);
        return [{ kind: 'MoveCardEffect', cardInstanceId: judged.instanceId, toZoneId: 'a:hand' }];
      },
    };
    const s = table([{ kind: 'JudgeEffect', seatId: 'a', tool: { as: 'omen', colour: 'none', physical: [] }, data: { note: 1 } }], [{ ...bolt, instanceId: 'j1' }]);
    const next = run(s, ctxWith([], [omen]));
    expect(seen).toEqual([{ note: 1 }]);
    expect(cardsIn(next, 'a:hand')).toEqual(['j1']);
    expect(cardsIn(next, 'discardPile')).toEqual([]);
  });
});
```

Add to `projects/app/src/app/game-board/choice-description.spec.ts`. Import `choiceOptionLabel` if the file doesn't already:

```ts
describe('ability asks', () => {
  it('labels the Use and Don’t options', () => {
    expect(choiceOptionLabel({ kind: 'use' }, [])).toBe('Use');
    expect(choiceOptionLabel({ kind: 'decline' }, [])).toBe("Don't");
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/engine/src/lib/pipeline/cardStep.spec.ts projects/app/src/app/game-board/choice-description.spec.ts`
Expected: FAIL. `CardStepEffect`, `AskUseEffect` and the other new kinds don't exist.

- [ ] **Step 3: Domain and registry types**

In `projects/engine/src/lib/domain/types.ts`:
- Add to `PendingResponse`, after `reason`:

```ts
  // For display only: what not answering is expected to lead to, when
  // context.effect is a step on the way there (a Sha's hit leads to damage).
  outcome?: Effect;
```

- Add to the `DecisionReason` union:

```ts
  // An ability's say: whether to use it (an ask), or what to pick for it (a
  // selection). `targetSeatId`: the seat it is aimed at, if any.
  | { kind: 'ability'; owner: AbilityOwner; abilityId: string; targetSeatId?: string };
```

(move the `;` from the previous last member to this one).

- In `PendingChoice`, change `verb` and its comment:

```ts
  // What picking does, for display: take the card, discard it, or (an ask)
  // use the ability or not.
  verb: 'take' | 'discard' | 'use';
```

- In `ChoiceOption.shows`, add two kinds:

```ts
  // A face-up card, or a seat's whole hand as one face-down option (the card
  // inside it is picked at random, so the chooser never sees the hand); for an
  // ask, Use or Don't (`decline` also serves "let them draw" and the like).
  shows: { kind: 'card'; card: CardInstance } | { kind: 'hidden-hand'; seatId: string; count: number } | { kind: 'use' } | { kind: 'decline' };
```

In `projects/engine/src/lib/registry/types.ts`:
- Add `import type { Effect } from '../pipeline/effects';`.
- Add to `CardDefinition`, after `onUnequip`:

```ts
  // One step of this card's resolution (CardStepEffect, e.g. a Sha's
  // 'sha-shan'). Its effects go to the front of the queue. Abilities hook in
  // with before:CardStepEffect triggers.
  onStep?(state: GameState, step: Extract<Effect, { kind: 'CardStepEffect' }>): unknown[];
```

- Add to `JudgedContext`:

```ts
  // What the JudgeEffect carried for its reader (Eight Trigrams: the step it answers).
  data?: Record<string, unknown>;
```

- [ ] **Step 4: Effects and the event**

In `projects/engine/src/lib/pipeline/events.ts`:
- Import `AbilityOwner` from `'../domain/types'`.
- Add:

```ts
// An ability applied (Black Shield stopping a Sha; Eight Trigrams counting as a
// Shan). `outcome` is content's code for what it did; `targetSeatId` is the
// other seat involved, if any.
export interface AbilityUsedEvent {
  kind: 'AbilityUsedEvent';
  owner: AbilityOwner;
  abilityId: string;
  outcome: string;
  targetSeatId?: string;
}
```

- Add `| AbilityUsedEvent` to `EngineEvent`.
- Change `ChoiceMadeEvent.verb` to `verb: PendingChoice['verb'];` and import `PendingChoice`.

In `projects/engine/src/lib/pipeline/effects.ts`:
- Import `AbilityOwner` with the domain types, and `queueFront` from `'./queue'`.
- Change `MoveCardEffect` to:

```ts
  // `onlyFrom`: move it only if it is still in that zone (a judged card a
  // reader already moved on).
  | { kind: 'MoveCardEffect'; cardInstanceId: string; toZoneId: string; onlyFrom?: string }
```

- Change `JudgeEffect` to:

```ts
  // A judgment for `seatId`, read by `tool` (CardDefinition.onJudged), which
  // also receives `data`.
  | { kind: 'JudgeEffect'; seatId: string; tool: UsedCard; data?: Record<string, unknown> }
```

- Add to the union:

```ts
  // One step of a card's resolution (a Sha's steps; see the Sha-Equipment
  // spec). The card's onStep says what it leads to; abilities hook in with
  // before:CardStepEffect triggers.
  | { kind: 'CardStepEffect'; step: string; card: UsedCard; userSeatId: string; target: Target; data?: Record<string, unknown> }
  // Asks `owner`'s seat whether to use an optional ability: Use queues
  // `effects`, Don't queues `otherwise`.
  | { kind: 'AskUseEffect'; owner: AbilityOwner; abilityId: string; effects: Effect[]; otherwise?: Effect[]; targetSeatId?: string }
  // Logs that an ability applied, for the Action History.
  | { kind: 'AbilityUsedEffect'; owner: AbilityOwner; abilityId: string; outcome: string; targetSeatId?: string }
```

- At the top of the `MoveCardEffect` case, after `origin` is found, add:

```ts
      if (effect.onlyFrom && origin?.id !== effect.onlyFrom) return { state, events: [] };
```

- Add cases before `default`:

```ts
    case 'AskUseEffect': {
      const owner = state.seats.find((s) => s.id === effect.owner.seatId);
      // An owner who is out can't be asked: what happens otherwise goes ahead.
      if (!owner || owner.eliminated) return { state: queueFront(state, effect.otherwise ?? []), events: [] };
      const choice: PendingChoice = {
        id: `ask-${effect.abilityId}-${owner.id}-${state.log.length}`,
        seatId: owner.id,
        reason: { kind: 'ability', owner: effect.owner, abilityId: effect.abilityId, ...(effect.targetSeatId ? { targetSeatId: effect.targetSeatId } : {}) },
        verb: 'use',
        options: [
          { id: 'use', shows: { kind: 'use' }, effects: effect.effects },
          { id: 'decline', shows: { kind: 'decline' }, effects: effect.otherwise ?? [] },
        ],
      };
      return { state: { ...state, pendingChoice: choice }, events: [] };
    }
    case 'AbilityUsedEffect': {
      const event: EngineEvent = {
        kind: 'AbilityUsedEvent',
        owner: effect.owner,
        abilityId: effect.abilityId,
        outcome: effect.outcome,
        ...(effect.targetSeatId ? { targetSeatId: effect.targetSeatId } : {}),
      };
      return { state: { ...state, log: [...state.log, event] }, events: [event] };
    }
```

Create `projects/engine/src/lib/pipeline/cardStep.ts`:

```ts
import { GameState } from '../domain/types';
import { ContentRegistry } from '../registry/types';
import { lookupCard } from '../registry/lookup';
import { ApplyResult, Effect } from './effects';
import { queueFront } from './queue';

// One step of a card's resolution: the card's onStep says what it leads to.
// Like the Tool lifecycle, it needs the registry and only reshapes the queue.
export function applyCardStep(state: GameState, step: Extract<Effect, { kind: 'CardStepEffect' }>, registry: ContentRegistry): ApplyResult {
  const definition = lookupCard(registry, step.card.as);
  if (!definition.onStep) throw new Error(`Card ${step.card.as} has no onStep (step ${step.step})`);
  return { state: queueFront(state, definition.onStep(state, step) as Effect[]), events: [] };
}
```

In `projects/engine/src/lib/pipeline/judgment.ts`, in the `JudgeEffect` case:
- Pass the data to the reader: `onJudged?.(turnedUp, { tool: effect.tool, seatId: effect.seatId, judged, ...(effect.data ? { data: effect.data } : {}) })`.
- Change `done` to skip a card a reading already moved:

```ts
      // The judged card goes to the discard pile, unless a reading moved it already.
      const done: Effect = { kind: 'MoveCardEffect', cardInstanceId: judged.instanceId, toZoneId: discardPile.id, onlyFrom: processing.id };
```

- [ ] **Step 5: Dispatch steps; preview stops at another kind**

In `projects/engine/src/lib/pipeline/resolve.ts`:
- Import `applyCardStep` from `'./cardStep'`.
- In `resolveEffect`, extend the dispatch:

```ts
  const applied = isLifecycleEffect(current)
    ? applyLifecycleEffect(state, current, ctx.registry)
    : isJudgmentStepEffect(current)
      ? applyJudgmentStepEffect(state, current, ctx.registry)
      : current.kind === 'CardStepEffect'
        ? applyCardStep(state, current, ctx.registry)
        : applyEffect(state, current);
```

- Replace `previewEffect` with:

```ts
// `effect` as its before-triggers would rewrite it (e.g. Silver Lion's cap),
// or null if one would cancel it. Applies nothing: the UI uses it to state what
// a pending effect would really do. Each trigger after the first is checked
// again against the effect as rewritten so far. A rewrite into another kind of
// effect (an ask) ends it: the rest get their say when the effect comes back.
export function previewEffect(state: GameState, effect: Effect, ctx: EngineContext): Effect | null {
  const beforeTriggers = gatherTriggeredSkills(state, ctx.registry, ctx.mode, `before:${effect.kind}`, effect);
  let current: Effect = effect;
  for (const [index, gathered] of beforeTriggers.entries()) {
    if (index > 0 && !gathered.trigger.condition(state, current, gathered.owner, ctx.registry)) continue;
    const outputs = gathered.trigger.effect(state, current, gathered.owner, ctx.registry) as Effect[];
    if (outputs.length === 0) return null;
    current = outputs[0];
    if (current.kind !== effect.kind) return current;
  }
  return current;
}
```

In `projects/engine/src/lib/pipeline/effects.ts`, `CardStepEffect` must never reach `applyEffect` (it needs the registry). The `default` case already throws for it, the same as for the Tool lifecycle's effects.

- [ ] **Step 6: Keep the app and bots compiling**

In `projects/app/src/app/game-board/choice-description.ts`:
- In `choiceOptionLabel`, add at the top:

```ts
  if (shows.kind === 'use') return 'Use';
  if (shows.kind === 'decline') return "Don't";
```

- In `choiceDialogOptions`, handle the hand first, then the face-up card, then everything else as a text option:

```ts
  return options.flatMap((option): ChoiceDialogOption[] => {
    const action = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === option.id);
    if (!action) return [];
    if (option.shows.kind === 'hidden-hand') {
      return Array.from({ length: option.shows.count }, (_, i) => ({ id: `${option.id}#${i + 1}`, action, faceDown: true as const, label: `Hand Card ${i + 1}` }));
    }
    if (option.shows.kind === 'card') {
      return [{ id: option.id, action, card: option.shows.card, label: choiceOptionLabel(option.shows, players) }];
    }
    return [{ id: option.id, action, label: choiceOptionLabel(option.shows, players) }];
  });
```

In `projects/app/src/app/game-board/choice-dialog.ts`, render a text option with no art. Change the art block to:

```html
              @if (option.card; as card) {
                <app-playing-card [card]="card" />
              } @else if (option.faceDown) {
                <img class="card-back" [src]="cardBackUrl" alt="" />
              }
```

In `projects/app/src/app/game-board/action-history.ts`, `case 'ChoiceMadeEvent'`: only a pick of a card waits for its card's move.

```ts
      case 'ChoiceMadeEvent':
        if (event.shows.kind === 'card' || event.shows.kind === 'hidden-hand') picked = event;
        break;
```

In `projects/bots/src/lib/rule-based.ts`, in `worth` (step 1b), add after the `hidden-hand` line:

```ts
      if (shows.kind !== 'card') return 0;
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest`
Expected: PASS, every project.

- [ ] **Step 8: Commit**

```bash
git add projects
git commit -m "feat(engine): card steps, asking to use an ability, and logging what an ability did

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Selections

**Files:**
- Create: `projects/engine/src/lib/rules/selection.ts`, `projects/engine/src/lib/pipeline/selection.spec.ts`
- Modify:
  - Engine: `domain/types.ts`, `pipeline/effects.ts`, `pipeline/events.ts`, `pipeline/actions.ts`, `pipeline/resolve.ts`, `rules/legality.ts`, `rules/activeSeat.ts`, `domain/redact.ts`, `public-api.ts`.
  - Sim: `projects/sim/src/invariants.ts` (+spec).
  - Bots: `projects/bots/src/lib/random.ts` (+spec), `rule-based.ts` (+spec).
  - App: `projects/app/src/app/labels.ts`, `game-board/action-list.ts`, `decision-timer.service.ts`.

**Interfaces:**
- Consumes: `useCard` (Task 1), `CardStepEffect` (Task 2).
- Produces:

```ts
// domain/types.ts
export interface PendingSelection {
  id: string; seatId: string; reason: DecisionReason;
  of: 'cards' | 'seats'; eligibleIds: string[]; min: number; max: number;
  then: SelectionContinuation; onCancel?: Effect[];
}
export type SelectionContinuation =
  | { kind: 'discard'; then?: Effect[] }
  | { kind: 'use-card'; as?: string; via?: UsedCard['via']; targets: Target[]; respondTo?: string; counted: boolean; free?: boolean }
  | { kind: 'card-step'; step: Extract<Effect, { kind: 'CardStepEffect' }> };
// GameState.pendingSelection?: PendingSelection
// effects.ts: | { kind: 'OpenSelectionEffect'; selection: PendingSelection }
// actions.ts
| { kind: 'SelectAction'; seatId: string; selectionId: string; ids: string[] }
| { kind: 'CancelSelectionAction'; seatId: string; selectionId: string }
// events.ts
export interface SelectionMadeEvent { kind: 'SelectionMadeEvent'; seatId: string; reason: DecisionReason; of: 'cards' | 'seats'; ids: string[] }
// rules/selection.ts
export function validateSelection(state: GameState, action: Extract<Action, { kind: 'SelectAction' }>): string | null;
```

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/pipeline/selection.spec.ts`:

```ts
import { advanceToDecision, resolve } from './resolve';
import { Effect } from './effects';
import { Action } from './actions';
import { createRng } from '../rng/rng';
import { usedCardOf } from '../domain/usedCard';
import { redactStateForSeat } from '../domain/redact';
import { getActiveSeatId } from '../rules/activeSeat';
import { getLegalActions } from '../rules/legality';
import { validateSelection } from '../rules/selection';
import { CardInstance, GameState, PendingSelection } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition, PlayContext } from '../registry/types';

const seen: PlayContext[] = [];
const stepsSeen: unknown[] = [];
// Bolt: played, its user draws 1 (and records how it was played). Its 'count'
// step draws its user one card per picked id.
const bolt: CardDefinition = {
  id: 'bolt', name: 'Bolt', category: 'basic',
  play: (_s, ctx) => { seen.push(ctx); return [{ kind: 'DrawCardsEffect', seatId: ctx.seatId, count: 1 }]; },
  onStep: (_s, step) => {
    stepsSeen.push(step.data);
    return [{ kind: 'DrawCardsEffect', seatId: step.userSeatId, count: (step.data?.['picked'] as string[]).length }];
  },
};
const registry: ContentRegistry = { cards: new Map([[bolt.id, bolt], ['filler', { id: 'filler', name: 'Filler', category: 'basic', play: () => [] }]]), generals: new Map() };
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId = 'filler'): CardInstance => ({ instanceId, definitionId, suit: 'club', rank: 5 });
const afterwards: Effect = { kind: 'DrawCardsEffect', seatId: 'b', count: 1 };

const selection = (over: Partial<PendingSelection> = {}): PendingSelection => ({
  id: 'sel-1', seatId: 'a',
  reason: { kind: 'ability', owner: { kind: 'equipment', seatId: 'a', cardInstanceId: 'x' }, abilityId: 'x' },
  of: 'cards', eligibleIds: ['k1', 'k2', 'bolt-1'], min: 2, max: 2, then: { kind: 'discard' }, ...over,
});

// Seat a holds k1, k2 and a Bolt; the queue opens `sel`, then seat b draws 1.
function opened(sel: PendingSelection = selection()): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'none', revealed: true }, deputy: { generalDefinitionId: 'none', revealed: true } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  const s: GameState = {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [card('d1'), card('d2'), card('d3')] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: [card('k1'), card('k2'), card('bolt-1', 'bolt')] },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: null, resolutionQueue: [{ kind: 'OpenSelectionEffect', selection: sel }, afterwards],
    log: [], rng: createRng(1), result: null, generalSelection: null,
  };
  return advanceToDecision(s, ctx).state;
}
const select = (s: GameState, ids: string[]) => resolve(s, { kind: 'SelectAction', seatId: 'a', selectionId: 'sel-1', ids }, ctx).state;
const cardsIn = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);

describe('selections', () => {
  it('pause the queue for the selecting seat, who is offered a template and Cancel', () => {
    const s = opened(selection({ onCancel: [] }));
    expect(s.pendingSelection).toMatchObject({ id: 'sel-1' });
    expect(s.resolutionQueue).toEqual([afterwards]);
    expect(getActiveSeatId(s)).toBe('a');
    expect(getLegalActions(s, 'a', registry)).toEqual([
      { kind: 'SelectAction', seatId: 'a', selectionId: 'sel-1', ids: [] },
      { kind: 'CancelSelectionAction', seatId: 'a', selectionId: 'sel-1' },
    ]);
    expect(getLegalActions(s, 'b', registry)).toEqual([]);
    expect(() => resolve(s, { kind: 'EndPhaseAction', seatId: 'a' }, ctx)).toThrow('not legal while a selection is pending');
  });

  it('validates the picks: the selector, eligible ids, no repeats, between min and max', () => {
    const s = opened();
    const pick = (ids: string[], seatId = 'a'): Extract<Action, { kind: 'SelectAction' }> => ({ kind: 'SelectAction', seatId, selectionId: 'sel-1', ids });
    expect(validateSelection(s, pick(['k1', 'k2']))).toBeNull();
    expect(validateSelection(s, pick(['k1', 'k2'], 'b'))).toMatch('not the selector');
    expect(validateSelection(s, pick(['k1', 'd1']))).toMatch('can’t be picked');
    expect(validateSelection(s, pick(['k1', 'k1']))).toMatch('twice');
    expect(validateSelection(s, pick(['k1']))).toMatch('between 2 and 2');
    expect(() => select(s, ['k1'])).toThrow('between 2 and 2');
  });

  it('discard: the picks go to the discard pile, then `then`, then the rest of the queue', () => {
    const next = select(opened(selection({ then: { kind: 'discard', then: [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }] } })), ['k1', 'k2']);
    expect(cardsIn(next, 'discardPile')).toEqual(['k1', 'k2']);
    expect(cardsIn(next, 'a:hand')).toEqual(['bolt-1', 'd1']);
    expect(cardsIn(next, 'b:hand')).toEqual(['d2']);
    expect(next.log[0]).toEqual({ kind: 'SelectionMadeEvent', seatId: 'a', reason: selection().reason, of: 'cards', ids: ['k1', 'k2'] });
  });

  it('card-step: the step goes ahead with the picks added to its data as `picked`', () => {
    const step: Extract<Effect, { kind: 'CardStepEffect' }> = {
      kind: 'CardStepEffect', step: 'count', card: usedCardOf(card('bolt-1', 'bolt')), userSeatId: 'a', target: { kind: 'seat', seatId: 'b' }, data: { extra: 1 },
    };
    const next = select(opened(selection({ of: 'seats', eligibleIds: ['a', 'b'], min: 1, max: 2, then: { kind: 'card-step', step } })), ['a', 'b']);
    // Bolt's 'count' step draws its user one card per picked seat.
    expect(stepsSeen).toEqual([{ extra: 1, picked: ['a', 'b'] }]);
    expect(cardsIn(next, 'a:hand')).toEqual(['k1', 'k2', 'bolt-1', 'd1', 'd2']);
  });

  it('use-card: the picked card is played at the targets, uncounted and free, then the rest of the queue', () => {
    seen.length = 0;
    const next = select(opened(selection({ eligibleIds: ['bolt-1'], min: 1, max: 1, then: { kind: 'use-card', targets: [{ kind: 'seat', seatId: 'b' }], counted: false, free: true } })), ['bolt-1']);
    expect(next.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ seatId: 'a', card: { as: 'bolt', physical: [{ instanceId: 'bolt-1' }] }, targets: [{ kind: 'seat', seatId: 'b' }] });
    expect(seen[0]).toMatchObject({ seatId: 'a', free: true, targets: [{ kind: 'seat', seatId: 'b' }] });
    expect(cardsIn(next, 'discardPile')).toEqual(['bolt-1']);
    expect(next.turn.cardPlays?.['bolt'] ?? 0).toBe(0);
  });

  it('Cancel queues onCancel; a selection without one can’t be cancelled', () => {
    const cancel = (s: GameState) => resolve(s, { kind: 'CancelSelectionAction', seatId: 'a', selectionId: 'sel-1' }, ctx).state;
    const next = cancel(opened(selection({ onCancel: [{ kind: 'DrawCardsEffect', seatId: 'a', count: 1 }] })));
    expect(next.pendingSelection).toBeUndefined();
    expect(cardsIn(next, 'a:hand')).toEqual(['k1', 'k2', 'bolt-1', 'd1']);
    expect(() => cancel(opened())).toThrow('can’t be cancelled');
  });

  it('a paused selection survives a JSON round trip, and the selector’s redacted view still offers it (Review Focus 5)', () => {
    const s = opened();
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(select(copy, ['k1', 'k2'])).toEqual(select(s, ['k1', 'k2']));
    expect(redactStateForSeat(s, 'a').pendingSelection).toEqual(s.pendingSelection);
    expect(getLegalActions(redactStateForSeat(s, 'a'), 'a', registry)[0]).toMatchObject({ kind: 'SelectAction' });
  });
});
```

Add to `projects/sim/src/invariants.spec.ts`, after `describe('a pending choice', …)`:

```ts
describe('a pending selection', () => {
  const selectionFor = (seatId: string): PendingSelection => ({
    id: 's', seatId, of: 'cards', eligibleIds: [], min: 1, max: 1, then: { kind: 'discard' },
    reason: { kind: 'ability', owner: { kind: 'equipment', seatId, cardInstanceId: 'x' }, abilityId: 'x' },
  });

  it('counts as a decision, so a game may rest with items queued behind it', () => {
    const s = baseState();
    expect(checkRestingState({ ...s, resolutionQueue: [{ kind: 'SkipNextEffect' }], pendingSelection: selectionFor(s.seats[0].id) })).toEqual([]);
  });

  it('flags a pending selection for an eliminated seat', () => {
    const s = baseState();
    const out = { ...s, seats: s.seats.map((x) => ({ ...x, eliminated: true })), pendingSelection: selectionFor(s.seats[0].id) };
    expect(checkInvariants(out)).toContain(`pendingSelection references eliminated seat ${s.seats[0].id}`);
  });
});
```

(import `PendingSelection` as a type from `engine`).

Add to `projects/bots/src/lib/random.spec.ts`:

```ts
describe('pickRandomAction with a selection', () => {
  it('fills the template with `min` of the eligible ids', () => {
    const s: GameState = {
      ...state(),
      pendingSelection: {
        id: 's1', seatId: 'seat-a', of: 'cards', eligibleIds: ['c1', 'c2', 'c3'], min: 2, max: 2, then: { kind: 'discard' },
        reason: { kind: 'ability', owner: { kind: 'equipment', seatId: 'seat-a', cardInstanceId: 'x' }, abilityId: 'x' },
      },
    };
    const { action } = pickRandomAction(s, createRng(3), emptyRegistry);
    if (action.kind !== 'SelectAction') throw new Error(`expected a SelectAction, got ${action.kind}`);
    expect(action.ids).toHaveLength(2);
    expect(action.ids.every((id) => ['c1', 'c2', 'c3'].includes(id))).toBe(true);
    expect(new Set(action.ids).size).toBe(2);
  });
});
```

Then add to `projects/bots/src/lib/rule-based.spec.ts`:
- Add `pendingSelection?: PendingSelection` to `ViewOptions`, and `...(o.pendingSelection ? { pendingSelection: o.pendingSelection } : {})` to `view()`.
- Import `PendingSelection`.
- Add:

```ts
  describe('selections', () => {
    const sel = (over: Partial<PendingSelection> = {}): PendingSelection => ({
      id: 's1', seatId: 'seat-0', reason: { kind: 'ability', owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'eq-0' }, abilityId: 'unknown' },
      of: 'cards', eligibleIds: ['p1', 's1', 'x1'], min: 2, max: 2, then: { kind: 'discard' }, ...over,
    });
    const template: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's1', ids: [] };
    const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's1' };
    const hand = [{ instanceId: 'p1', definitionId: 'peach' }, { instanceId: 's1', definitionId: 'sha' }, { instanceId: 'x1', definitionId: 'duel' }];

    it('cancels an unknown ability’s selection when it can', () => {
      expect(ruleBasedPolicy.decide(view({ hand, pendingSelection: sel({ onCancel: [] }) }), 'seat-0', [template, cancel], registry, null).action).toEqual(cancel);
    });

    it('otherwise picks the least useful eligible cards', () => {
      const { action } = ruleBasedPolicy.decide(view({ hand, pendingSelection: sel() }), 'seat-0', [template], registry, null);
      expect(action).toEqual({ ...template, ids: ['x1', 's1'] });
    });
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/engine/src/lib/pipeline/selection.spec.ts projects/sim projects/bots`
Expected: FAIL. `OpenSelectionEffect`, `SelectAction` and `validateSelection` don't exist.

- [ ] **Step 3: Types, effect, event and actions**

In `projects/engine/src/lib/domain/types.ts`, add after `ChoiceOption`:

```ts
// A seat picking cards or seats (Axe's 2 cards, Sky Scorcher's extra targets,
// Serpent Spear's 2 hand cards). Pauses the queue like a response window or a
// choice, and may be open over a response window (Serpent Spear answering).
export interface PendingSelection {
  id: string;
  seatId: string;
  reason: DecisionReason;
  of: 'cards' | 'seats';
  // The card instance ids, or seat ids, that may be picked.
  eligibleIds: string[];
  min: number;
  max: number;
  // What the picks lead to.
  then: SelectionContinuation;
  // Queued on Cancel; absent = the selection can't be cancelled.
  onCancel?: Effect[];
}

// What a selection's picks lead to: plain data, so the state stays serialisable.
export type SelectionContinuation =
  // Discard the picked cards, then queue `then`.
  | { kind: 'discard'; then?: Effect[] }
  // Use the picked cards as one `as` card (with no `as`: the one picked card as
  // itself), at `targets` or as the answer to the window `respondTo`.
  // `counted`: toward per-turn limits. `free`: outside the Play Phase's limits.
  | { kind: 'use-card'; as?: string; via?: UsedCard['via']; targets: Target[]; respondTo?: string; counted: boolean; free?: boolean }
  // Queue `step` with the picked ids added to its data as `picked`.
  | { kind: 'card-step'; step: Extract<Effect, { kind: 'CardStepEffect' }> };
```

Add to `GameState`, after `pendingChoice`:

```ts
  // The cards or seats a seat owes a pick of, if any. Absent (never null) when
  // none, like the choice.
  pendingSelection?: PendingSelection;
```

In `projects/engine/src/lib/pipeline/effects.ts`:
- Import `PendingSelection`.
- Add to the union:

```ts
  // Asks `selection.seatId` to pick cards or seats; the queue waits.
  | { kind: 'OpenSelectionEffect'; selection: PendingSelection }
```

- Add the case:

```ts
    case 'OpenSelectionEffect':
      return { state: { ...state, pendingSelection: effect.selection }, events: [] };
```

In `projects/engine/src/lib/pipeline/events.ts`, add (and add it to `EngineEvent`):

```ts
// A seat made a selection. Card ids name no face (a hand card stays hidden
// until it moves face up); seat ids are public.
export interface SelectionMadeEvent {
  kind: 'SelectionMadeEvent';
  seatId: string;
  reason: DecisionReason;
  of: 'cards' | 'seats';
  ids: string[];
}
```

In `projects/engine/src/lib/pipeline/actions.ts`, add to `Action` and to `ACTION_KINDS`:

```ts
  // Fills the pending selection; getLegalActions offers it as a template with no ids.
  | { kind: 'SelectAction'; seatId: string; selectionId: string; ids: string[] }
  | { kind: 'CancelSelectionAction'; seatId: string; selectionId: string }
```

Create `projects/engine/src/lib/rules/selection.ts`:

```ts
import { GameState } from '../domain/types';
import { Action } from '../pipeline/actions';

// Why `action` can't fill the pending selection, or null when it can: the
// selector, the selection's id, only eligible ids, no repeats, and between
// min and max of them. The engine, bots and the UI share this check.
export function validateSelection(state: GameState, action: Extract<Action, { kind: 'SelectAction' }>): string | null {
  const selection = state.pendingSelection;
  if (!selection || selection.id !== action.selectionId) return `No matching pending selection: ${action.selectionId}`;
  if (action.seatId !== selection.seatId) return `Seat ${action.seatId} is not the selector for ${selection.id}`;
  if (new Set(action.ids).size !== action.ids.length) return 'The same thing was picked twice';
  const ineligible = action.ids.find((id) => !selection.eligibleIds.includes(id));
  if (ineligible) return `${ineligible} can’t be picked here`;
  if (action.ids.length < selection.min || action.ids.length > selection.max) {
    return `Pick between ${selection.min} and ${selection.max}; got ${action.ids.length}`;
  }
  return null;
}
```

Export it from `projects/engine/src/public-api.ts` (`export * from './lib/rules/selection';`).

- [ ] **Step 4: The pipeline pauses and continues**

In `projects/engine/src/lib/pipeline/resolve.ts`:
- Import `PendingSelection` from the domain types, `SelectionMadeEvent` from `./events`, `validateSelection` from `'../rules/selection'`, and `usedCardFrom` with `usedCardOf`.
- In `advanceToDecision`'s break condition, add `|| current.pendingSelection`.
- In `drain`'s loop condition, add `&& !current.pendingSelection`.
- At the top of `resolveAction`, before the `pendingChoice` check, add:

```ts
  if (state.pendingSelection && action.kind !== 'SelectAction' && action.kind !== 'CancelSelectionAction') {
    throw new Error(`Action ${action.kind} is not legal while a selection is pending`);
  }
```

- Change the `pendingResponse` guard so a selection opened over a window isn't blocked by it:

```ts
  if (state.pendingResponse && !state.pendingSelection && !state.pendingResponse.allowedActionKinds.includes(action.kind)) {
```

- Add before `resolveAction`:

```ts
// What a selection's picks lead to (its continuation).
function continueSelection(state: GameState, selection: PendingSelection, ids: string[], ctx: EngineContext): ResolveResult {
  const then = selection.then;
  switch (then.kind) {
    case 'discard': {
      const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
      const moves: Effect[] = ids.map((id) => ({ kind: 'MoveCardEffect', cardInstanceId: id, toZoneId: discardPileId }));
      return { state: queueFront(state, [...moves, ...(then.then ?? [])]), events: [] };
    }
    case 'card-step':
      return { state: queueFront(state, [{ ...then.step, data: { ...then.step.data, picked: ids } }]), events: [] };
    case 'use-card': {
      const cards = ids.map((id) => {
        const card = state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === id);
        if (!card) throw new Error(`Card ${id} is in no zone`);
        return card;
      });
      const used = then.as ? usedCardFrom(cards, then.as, then.via) : usedCardOf(cards[0]);
      const respondTo = then.respondTo ? state.pendingResponse : null;
      if (then.respondTo && respondTo?.id !== then.respondTo) throw new Error(`Window ${then.respondTo} is no longer open`);
      return useCard(
        state,
        selection.seatId,
        used,
        { targets: then.targets, ...(respondTo ? { respondTo } : {}), counted: then.counted, ...(then.free ? { free: true } : {}) },
        ctx
      );
    }
  }
}
```

- Add the cases to `resolveAction`:

```ts
    case 'SelectAction': {
      const error = validateSelection(state, action);
      if (error) throw new Error(error);
      const selection = state.pendingSelection!;
      const { pendingSelection: _done, ...cleared } = state;
      // Logged for the history; nothing reacts to it.
      const event: SelectionMadeEvent = { kind: 'SelectionMadeEvent', seatId: action.seatId, reason: selection.reason, of: selection.of, ids: action.ids };
      const continued = continueSelection(logged(cleared, [event]), selection, action.ids, ctx);
      return { state: continued.state, events: [event, ...continued.events] };
    }

    case 'CancelSelectionAction': {
      const selection = state.pendingSelection;
      if (!selection || selection.id !== action.selectionId) throw new Error(`No matching pending selection: ${action.selectionId}`);
      if (action.seatId !== selection.seatId) throw new Error(`Seat ${action.seatId} is not the selector for ${selection.id}`);
      if (!selection.onCancel) throw new Error(`Selection ${selection.id} can’t be cancelled`);
      const { pendingSelection: _done, ...cleared } = state;
      return { state: queueFront(cleared, selection.onCancel), events: [] };
    }
```

In `projects/engine/src/lib/rules/legality.ts`, add after the `pendingChoice` block:

```ts
  if (state.pendingSelection) {
    const selection = state.pendingSelection;
    if (selection.seatId !== seatId) return [];
    // A template: the seat fills in the picked ids (validateSelection checks them).
    const actions: Action[] = [{ kind: 'SelectAction', seatId, selectionId: selection.id, ids: [] }];
    if (selection.onCancel) actions.push({ kind: 'CancelSelectionAction', seatId, selectionId: selection.id });
    return actions;
  }
```

In `projects/engine/src/lib/rules/activeSeat.ts`, change the candidate:

```ts
  const candidateId =
    state.pendingChoice?.seatId ?? state.pendingSelection?.seatId ?? state.pendingResponse?.respondingSeatId ?? state.turn.ownerSeatId;
```

and its comment: "…a pending chooser, then a pending selector, then a pending responder, acts before the turn owner."

In `projects/engine/src/lib/domain/redact.ts`, mask hidden cards inside a pending selection too:

```ts
    ...(state.pendingSelection ? { pendingSelection: maskHiddenCards(state.pendingSelection, hidden) } : {}),
```

- [ ] **Step 5: Sim, bots and app**

In `projects/sim/src/invariants.ts`:
- After the `pendingChoice` block, add:

```ts
  if (state.pendingSelection) {
    const seat = state.seats.find((s) => s.id === state.pendingSelection!.seatId);
    if (!seat) violations.push(`pendingSelection references unknown seat ${state.pendingSelection.seatId}`);
    else if (seat.eliminated) violations.push(`pendingSelection references eliminated seat ${seat.id}`);
  }
```

- In `checkRestingState`, change `decisionPending` to include `|| !!state.pendingSelection`.

In `projects/bots/src/lib/random.ts`:
- Import `shuffle`.
- Replace the last two lines of `pickRandomAction` with:

```ts
  const step = nextInt(rng, legal.length);
  const picked = legal[step.value];
  const selection = state.pendingSelection;
  if (picked.kind !== 'SelectAction' || !selection) return { action: picked, rng: step.rng };
  // A selection template: fill it with `min` eligible ids, picked at random.
  const shuffled = shuffle(selection.eligibleIds, step.rng);
  return { action: { ...picked, ids: shuffled.items.slice(0, selection.min) }, rng: shuffled.rng };
```

In `projects/bots/src/lib/rule-based.ts`:
- Add `type Select = Extract<Action, { kind: 'SelectAction' }>;`.
- Add after step 1 (General selection), before 1b:

```ts
  // 1a. A selection. With no rule for it, cancel when allowed; else pick the
  // least useful eligible cards.
  const selectTemplate = legal.find((a): a is Select => a.kind === 'SelectAction');
  if (selectTemplate && view.pendingSelection) {
    const selection = view.pendingSelection;
    const cancel = legal.find((a) => a.kind === 'CancelSelectionAction');
    if (cancel) return take(cancel);
    const ids = [...selection.eligibleIds].sort((a, b) => keepRank(view, registry, a) - keepRank(view, registry, b)).slice(0, selection.min);
    return take({ ...selectTemplate, ids });
  }
```

In `projects/app/src/app/labels.ts`, `actionLabel`, add:

```ts
    case 'SelectAction':
      return 'Confirm';
    case 'CancelSelectionAction':
      return 'Cancel';
```

In `projects/app/src/app/game-board/action-list.ts`, `isCardAction`, add `|| action.kind === 'SelectAction' || action.kind === 'CancelSelectionAction'` (the Selection dialog offers them, from Task 10).

In `projects/app/src/app/decision-timer.service.ts`:
- In `decision`, change the choice line to `if (state.pendingChoice || state.pendingSelection) return { kind: 'choice', state, key: this.keyOf(state) };`.
- In `defaultActions`, add at the top:

```ts
    // A selection: Cancel when it may be, else the first eligible picks.
    const cancel = legal.find((a) => a.kind === 'CancelSelectionAction');
    if (cancel) return [cancel];
    const select = legal.find((a): a is Extract<Action, { kind: 'SelectAction' }> => a.kind === 'SelectAction');
    if (select && state.pendingSelection) return [{ ...select, ids: state.pendingSelection.eligibleIds.slice(0, state.pendingSelection.min) }];
    // An ask (or "let them draw"): Don't.
    const decline = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === 'decline');
    if (decline) return [decline];
```

(import `Action` from `engine` if it isn't already).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest`
Expected: PASS, every project.

- [ ] **Step 7: Commit**

```bash
git add projects
git commit -m "feat(engine): selections of cards or seats, with plain-data continuations

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Conversions

**Files:**
- Create: `projects/engine/src/lib/pipeline/conversion.spec.ts`
- Modify:
  - Engine: `registry/types.ts`, `pipeline/actions.ts`, `rules/legality.ts`, `pipeline/resolve.ts`.
  - App: `projects/app/src/app/labels.ts` (+spec).

**Interfaces:**
- Consumes: `PendingSelection` with a `use-card` continuation (Task 3); `usedCardFrom` (Task 1).
- Produces:

```ts
// registry/types.ts
export interface Conversion { id: string; as: string; cards: 2; when: 'play' | 'respond' | 'both' }
// Abilities.conversions?: Conversion[]
// actions.ts
| { kind: 'UseConversionAction'; seatId: string; via: { owner: AbilityOwner; conversionId: string }; targets: Target[]; pendingResponseId?: string }
// rules/legality.ts
export interface OwnedConversion { owner: AbilityOwner; abilityId: string; conversion: Conversion }
export function conversionsOf(state: GameState, seatId: string, registry: ContentRegistry): OwnedConversion[];
export function conversionActions(state: GameState, seatId: string, registry: ContentRegistry): Extract<Action, { kind: 'UseConversionAction' }>[];
export function sameAbilityOwner(a: AbilityOwner, b: AbilityOwner): boolean;
// app labels.ts
export function conversionLabel(action: Extract<Action, { kind: 'UseConversionAction' }>, state: GameState, registry: ContentRegistry): string; // "Use 2 Cards as Sha"
```

A conversion's selection has id `convert-<conversionId>-<seatId>-<log length>` and reason `{ kind: 'ability', owner, abilityId }`. Its eligible ids are the seat's whole hand. Its continuation is `use-card` with `counted: true` for a play and `false` for an answer. `onCancel: []` returns the seat to where it was.

- [ ] **Step 1: Write the failing tests**

Create `projects/engine/src/lib/pipeline/conversion.spec.ts`:

```ts
import { advanceToDecision, resolve } from './resolve';
import { Action } from './actions';
import { createRng } from '../rng/rng';
import { getLegalActions } from '../rules/legality';
import { AbilityOwner, CardInstance, GameState, PendingResponse } from '../domain/types';
import { CardDefinition, ContentRegistry, GameModeDefinition } from '../registry/types';

type UseConversion = Extract<Action, { kind: 'UseConversionAction' }>;
const b = { kind: 'seat' as const, seatId: 'b' };
// Bolt: played at seat b, deals it 1 damage; as an answer it does nothing itself.
const bolt: CardDefinition = {
  id: 'bolt', name: 'Bolt', category: 'basic',
  legalPlayTargets: (state) => ((state.turn.cardPlays?.['bolt'] ?? 0) < 1 ? [[b]] : []),
  play: (_s, ctx) => (ctx.respondingTo ? [] : [{ kind: 'DamageEffect', damage: { source: { kind: 'seat', seatId: ctx.seatId }, target: ctx.targets[0], amount: 1, nature: 'normal' } }]),
};
// Spear: while worn, 2 hand cards may be used as a Bolt.
const spear: CardDefinition = {
  id: 'spear', name: 'Spear', category: 'equipment', equipSlot: 'weapon', play: () => [],
  abilities: { conversions: [{ id: 'spear', as: 'bolt', cards: 2, when: 'both' }] },
};
const filler: CardDefinition = { id: 'filler', name: 'Filler', category: 'basic', play: () => [] };
const registry: ContentRegistry = { cards: new Map([bolt, spear, filler].map((c) => [c.id, c])), generals: new Map() };
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, suit: CardInstance['suit'], definitionId = 'filler'): CardInstance => ({ instanceId, definitionId, suit, rank: 5 });
const owner: AbilityOwner = { kind: 'equipment', seatId: 'a', cardInstanceId: 'spear-1' };
const via = { owner, conversionId: 'spear' };

function table(hand: CardInstance[] = [card('h1', 'heart'), card('c1', 'club')], wearsSpear = true, pending: PendingResponse | null = null): GameState {
  const seat = (id: string, index: number) => ({
    id, index, kingdom: 'Wei' as const, combinedHp: 4, maxCombinedHp: 4, eliminated: false,
    generals: { main: { generalDefinitionId: 'none', revealed: true }, deputy: { generalDefinitionId: 'none', revealed: true } },
    hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
  });
  return {
    seats: [seat('a', 0), seat('b', 1)], players: [], turn: { turnNumber: 1, ownerSeatId: 'a', extraTurnStack: [] }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'a:hand', kind: 'hand', ownerSeatId: 'a', cards: hand },
      { id: 'a:equip', kind: 'equip', ownerSeatId: 'a', cards: wearsSpear ? [card('spear-1', 'spade', 'spear')] : [] },
      { id: 'b:hand', kind: 'hand', ownerSeatId: 'b', cards: [] },
      { id: 'b:equip', kind: 'equip', ownerSeatId: 'b', cards: [] },
    ],
    pendingResponse: pending, log: [], rng: createRng(1), result: null, generalSelection: null,
  };
}
// A window for seat a that a Bolt answers; unanswered, a takes 1 damage; answered, a draws nothing and b takes 1.
const window: PendingResponse = {
  id: 'w1', respondingSeatId: 'a', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['bolt'],
  context: { effect: { kind: 'DamageEffect', damage: { source: null, target: { kind: 'seat', seatId: 'a' }, amount: 1, nature: 'normal' } } },
  onAnswer: [{ kind: 'DamageEffect', damage: { source: null, target: b, amount: 1, nature: 'normal' } }],
};
const conversions = (s: GameState) => getLegalActions(s, 'a', registry).filter((x): x is UseConversion => x.kind === 'UseConversionAction');
const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;

describe('conversions in the Play Phase', () => {
  it('are offered once per legal target list of the card they make, with 2 hand cards and the card worn', () => {
    expect(conversions(table())).toEqual([{ kind: 'UseConversionAction', seatId: 'a', via, targets: [b] }]);
    expect(conversions(table([card('h1', 'heart')]))).toEqual([]);
    expect(conversions(table(undefined, false))).toEqual([]);
  });

  it('open a cancellable selection of exactly 2 hand cards', () => {
    const s = act(table(), conversions(table())[0]);
    expect(s.pendingSelection).toMatchObject({
      seatId: 'a', of: 'cards', eligibleIds: ['h1', 'c1'], min: 2, max: 2, onCancel: [],
      reason: { kind: 'ability', owner, abilityId: 'spear' },
    });
  });

  it('use the 2 cards as one card: no colour from red and black, both discarded, counted toward the limit', () => {
    const picking = act(table(), conversions(table())[0]);
    const s = act(picking, { kind: 'SelectAction', seatId: 'a', selectionId: picking.pendingSelection!.id, ids: ['h1', 'c1'] });
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({
      seatId: 'a', targets: [b],
      card: { as: 'bolt', colour: 'none', physical: [{ instanceId: 'h1' }, { instanceId: 'c1' }], via: { owner, abilityId: 'spear', conversionId: 'spear' } },
    });
    expect(s.zones.find((z) => z.id === 'discardPile')!.cards.map((c) => c.instanceId)).toEqual(['h1', 'c1']);
    expect(hp(s, 'b')).toBe(3);
    expect(s.turn.cardPlays).toEqual({ bolt: 1 });
    expect(conversions(s)).toEqual([]); // the made card's own limit applies
  });

  it('an action that isn’t offered is refused', () => {
    expect(() => act(table(), { kind: 'UseConversionAction', seatId: 'a', via, targets: [{ kind: 'seat', seatId: 'a' }] })).toThrow('can’t use that conversion');
  });
});

describe('conversions answering a window', () => {
  const answering = () => advanceToDecision(table(undefined, true, window), ctx).state;

  it('are offered when the window allows the card they make', () => {
    expect(conversions(answering())).toEqual([{ kind: 'UseConversionAction', seatId: 'a', via, targets: [], pendingResponseId: 'w1' }]);
    expect(conversions(advanceToDecision(table(undefined, true, { ...window, allowedCardIds: ['peach'] }), ctx).state)).toEqual([]);
  });

  it('answer with the 2 cards: the window’s answer goes ahead, uncounted', () => {
    const picking = act(answering(), conversions(answering())[0]);
    expect(picking.pendingResponse?.id).toBe('w1'); // still open under the selection
    const s = act(picking, { kind: 'SelectAction', seatId: 'a', selectionId: picking.pendingSelection!.id, ids: ['h1', 'c1'] });
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'a')).toBe(4);
    expect(hp(s, 'b')).toBe(3);
    expect(s.turn.cardPlays?.['bolt'] ?? 0).toBe(0);
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ seatId: 'a', inResponseTo: {} });
  });

  it('cancelled, the window is still open and answerable (Review Focus 3)', () => {
    const picking = act(answering(), conversions(answering())[0]);
    const s = act(picking, { kind: 'CancelSelectionAction', seatId: 'a', selectionId: picking.pendingSelection!.id });
    expect(s.pendingSelection).toBeUndefined();
    expect(s.pendingResponse?.id).toBe('w1');
    expect(getLegalActions(s, 'a', registry).map((x) => x.kind)).toEqual(['PassAction', 'UseConversionAction']);
  });
});
```

Add to `describe('actionLabel', …)` in `projects/app/src/app/labels.spec.ts`:

```ts
  it('labels a conversion by what it makes, and its targets for a play', () => {
    const base = stateWithZones();
    const state: GameState = {
      ...base,
      zones: [...base.zones, { id: 'equip-0', kind: 'equip', ownerSeatId: 'seat-0', cards: [{ instanceId: 'spear', definitionId: 'serpent-spear', suit: 'spade', rank: 12 }] }],
    };
    const registry = registryWithSha();
    registry.cards.set('serpent-spear', {
      id: 'serpent-spear', name: 'Serpent Spear', category: 'equipment', equipSlot: 'weapon', play: () => [],
      abilities: { conversions: [{ id: 'serpent-spear', as: 'sha', cards: 2, when: 'both' }] },
    });
    const use = (targets: Target[]): Action => ({
      kind: 'UseConversionAction', seatId: 'seat-0', via: { owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'spear' }, conversionId: 'serpent-spear' }, targets,
    });
    expect(actionLabel(use([]), state, registry)).toBe('Use 2 Cards as Sha');
    expect(actionLabel(use([{ kind: 'seat', seatId: 'seat-1' }]), state, registry)).toBe('Use 2 Cards as Sha Targeting Seat 1');
  });
```

(add `Target` to the `engine` import).

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/engine/src/lib/pipeline/conversion.spec.ts projects/app/src/app/labels.spec.ts`
Expected: FAIL. No conversions exist yet.

- [ ] **Step 3: Types and the action**

In `projects/engine/src/lib/registry/types.ts`, add after `AbilityModifiers`:

```ts
// Using hand cards as another card (Serpent Spear: 2 hand cards as a Sha).
export interface Conversion {
  // Unique among its owner's conversions.
  id: string;
  // The card the picked cards count as.
  as: string;
  // How many hand cards it takes. (1-card conversions come with stage 7.)
  cards: 2;
  // 'play': proactively in your Play Phase; 'respond': to answer a window.
  when: 'play' | 'respond' | 'both';
}
```

Add to `Abilities`: `conversions?: Conversion[];`.

In `projects/engine/src/lib/pipeline/actions.ts`:
- Import `AbilityOwner`.
- Add to `Action` and `ACTION_KINDS`:

```ts
  // Uses a conversion: in the Play Phase at `targets`, or (with
  // pendingResponseId) to answer that window. Opens a selection of the cards.
  | { kind: 'UseConversionAction'; seatId: string; via: { owner: AbilityOwner; conversionId: string }; targets: Target[]; pendingResponseId?: string }
```

- [ ] **Step 4: Legal actions**

In `projects/engine/src/lib/rules/legality.ts`:
- Import `AbilityOwner` and `Conversion`.
- Add:

```ts
type UseConversion = Extract<Action, { kind: 'UseConversionAction' }>;

export interface OwnedConversion {
  owner: AbilityOwner;
  // The ability's id: the worn card's definition id.
  abilityId: string;
  conversion: Conversion;
}

export function sameAbilityOwner(a: AbilityOwner, b: AbilityOwner): boolean {
  if (a.kind === 'equipment' && b.kind === 'equipment') return a.seatId === b.seatId && a.cardInstanceId === b.cardInstanceId;
  if (a.kind === 'general' && b.kind === 'general') return a.seatId === b.seatId && a.slot === b.slot;
  return false;
}

// Every conversion `seatId` has: those of the cards it wears, in zone order.
// (Generals' conversions join in stage 6.)
export function conversionsOf(state: GameState, seatId: string, registry: ContentRegistry): OwnedConversion[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || seat.eliminated) return [];
  const worn = state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards ?? [];
  return worn.flatMap((card) =>
    (registry.cards.get(card.definitionId)?.abilities?.conversions ?? []).map((conversion) => ({
      owner: { kind: 'equipment' as const, seatId, cardInstanceId: card.instanceId },
      abilityId: card.definitionId,
      conversion,
    }))
  );
}

// The conversions `seatId` may use now. In its Play Phase: one per legal target
// list of the card made. Answering a window that allows the card made: one
// each. Either way the seat must hold enough hand cards.
export function conversionActions(state: GameState, seatId: string, registry: ContentRegistry): UseConversion[] {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat || state.pendingChoice || state.pendingSelection) return [];
  const handSize = state.zones.find((z) => z.id === seat.hand.zoneId)?.cards.length ?? 0;
  const usable = conversionsOf(state, seatId, registry).filter((o) => handSize >= o.conversion.cards);
  const via = (o: OwnedConversion) => ({ owner: o.owner, conversionId: o.conversion.id });
  const pending = state.pendingResponse;
  if (pending) {
    if (pending.respondingSeatId !== seatId || !pending.allowedActionKinds.includes('RespondAction')) return [];
    return usable
      .filter((o) => o.conversion.when !== 'play' && (!pending.allowedCardIds || pending.allowedCardIds.includes(o.conversion.as)))
      .map((o) => ({ kind: 'UseConversionAction', seatId, via: via(o), targets: [], pendingResponseId: pending.id }));
  }
  if (state.phase !== 'Play' || state.turn.ownerSeatId !== seatId) return [];
  return usable
    .filter((o) => o.conversion.when !== 'respond')
    .flatMap((o) =>
      legalTargetListsFor(state, seatId, '', o.conversion.as, registry).map((targets): UseConversion => ({ kind: 'UseConversionAction', seatId, via: via(o), targets }))
    );
}
```

- In `getLegalActions`, in the `pendingResponse` block, before `return actions;`, add `if (registry) actions.push(...conversionActions(state, seatId, registry));`.
- At the end of the Play block, before `return actions;`, add the same line.

- [ ] **Step 5: Resolving a conversion**

In `projects/engine/src/lib/pipeline/resolve.ts`:
- Import `conversionActions`, `conversionsOf` and `sameAbilityOwner` from `'../rules/legality'`.
- Change the `pendingResponse` guard so an answering conversion counts as a `RespondAction`:

```ts
  const windowKind = action.kind === 'UseConversionAction' ? 'RespondAction' : action.kind;
  if (state.pendingResponse && !state.pendingSelection && !state.pendingResponse.allowedActionKinds.includes(windowKind)) {
```

- Add the case:

```ts
    case 'UseConversionAction': {
      const offered = conversionActions(state, action.seatId, ctx.registry).some(
        (a) =>
          a.via.conversionId === action.via.conversionId &&
          sameAbilityOwner(a.via.owner, action.via.owner) &&
          a.pendingResponseId === action.pendingResponseId &&
          JSON.stringify(a.targets) === JSON.stringify(action.targets)
      );
      if (!offered) throw new Error(`Seat ${action.seatId} can’t use that conversion now`);
      const owned = conversionsOf(state, action.seatId, ctx.registry).find(
        (o) => o.conversion.id === action.via.conversionId && sameAbilityOwner(o.owner, action.via.owner)
      )!;
      const seat = state.seats.find((s) => s.id === action.seatId)!;
      const hand = state.zones.find((z) => z.id === seat.hand.zoneId)?.cards ?? [];
      const selection: PendingSelection = {
        id: `convert-${owned.conversion.id}-${action.seatId}-${state.log.length}`,
        seatId: action.seatId,
        reason: { kind: 'ability', owner: owned.owner, abilityId: owned.abilityId },
        of: 'cards',
        eligibleIds: hand.map((c) => c.instanceId),
        min: owned.conversion.cards,
        max: owned.conversion.cards,
        then: {
          kind: 'use-card',
          as: owned.conversion.as,
          via: { owner: owned.owner, abilityId: owned.abilityId, conversionId: owned.conversion.id },
          targets: action.targets,
          ...(action.pendingResponseId ? { respondTo: action.pendingResponseId } : {}),
          counted: !action.pendingResponseId,
        },
        // Cancel: back where the seat was (its Play Phase, or the open window).
        onCancel: [],
      };
      return { state: { ...state, pendingSelection: selection }, events: [] };
    }
```

- [ ] **Step 6: The app's label**

In `projects/app/src/app/labels.ts`, add:

```ts
// "Use 2 Cards as Sha", with its targets for a play.
export function conversionLabel(action: Extract<Action, { kind: 'UseConversionAction' }>, state: GameState, registry: ContentRegistry): string {
  const owner = action.via.owner;
  const worn = owner.kind === 'equipment' ? findCardInstance(state, owner.cardInstanceId) : undefined;
  const conversion = worn && registry.cards.get(worn.definitionId)?.abilities?.conversions?.find((c) => c.id === action.via.conversionId);
  const base = conversion ? `Use ${conversion.cards} Cards as ${registry.cards.get(conversion.as)?.name ?? conversion.as}` : 'Use Cards';
  return action.targets.length > 0 ? `${base} Targeting ${action.targets.map((t) => targetLabel(t, state.players)).join(', ')}` : base;
}
```

and in `actionLabel`:

```ts
    case 'UseConversionAction':
      return conversionLabel(action, state, registry);
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest`
Expected: PASS, every project.

- [ ] **Step 8: Commit**

```bash
git add projects
git commit -m "feat(engine): conversions — use 2 hand cards as another card, to play or to answer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Sha on steps; Coerce's Sha and Hail of Arrows on steps

Sha behaves as before, but now through its steps. Coerce's Sha now goes through them too, so armour and weapons will apply to it.

**Files:**
- Create: `projects/content/src/lib/shared/steps.ts`, `projects/content/src/lib/cards/sha-steps.spec.ts`
- Modify:
  - Content cards: `sha.ts`, `coerce.ts`, `mass-attack.ts`.
  - Content tests: `cards.spec.ts`, `tools.spec.ts`.
  - App: `game-board/response-description.ts` (+spec).

**Interfaces:**
- Consumes: `CardStepEffect`, `onStep`, `AskUseEffect`, `PendingResponse.outcome` (Task 2).
- Produces:

```ts
// shared/steps.ts
export type CardStep = Extract<Effect, { kind: 'CardStepEffect' }>;
export function cardStep(step: string, card: UsedCard, userSeatId: string, target: Target, data?: Record<string, unknown>): CardStep;
export function hasActed(step: CardStep, owner: AbilityOwner): boolean;
export function actedOn(step: CardStep, owner: AbilityOwner): CardStep;
export function askAtStep(owner: AbilityOwner, abilityId: string, step: CardStep, effects: Effect[], targetSeatId?: string | null): Effect;
export function atStep(steps: string[], rule: StepRule): SkillTrigger; // before:CardStepEffect, once per owner per step
// cards/sha.ts
export interface ShaStepData { extra?: number; lastHandCard?: boolean; picked?: string[]; needed?: number; provided?: number; acted?: string[] }
export function shaData(step: CardStep): ShaStepData;
export function shaStep(from: CardStep, step: string, more?: ShaStepData): CardStep; // same Sha and target, keeps `extra`
export function shaAt(state: GameState, card: UsedCard, userSeatId: string, targets: Target[], extra?: number): Effect[];
// Steps: 'sha-use' → 'sha-targeted' → 'sha-armor' → 'sha-shan' → 'sha-dodged' | 'sha-hit' → 'sha-damage' → 'sha-after-damage'
// Hail of Arrows: 'hail-shan' with data { needed, provided }
```

- [ ] **Step 1: Write the failing tests**

Create `projects/content/src/lib/cards/sha-steps.spec.ts`:

```ts
import { advanceToDecision, resolve, usedCardOf } from 'engine';
import type { Action, CardDefinition, CardInstance, ContentRegistry, GameModeDefinition, GameState, SkillTrigger } from 'engine';
import { shaCard } from './sha';
import { shanCard } from './shan';
import { wineCard } from './wine';
import { coerceCard } from './coerce';
import { hailOfArrowsCard } from './mass-attack';
import { crossbowCard } from './equipment';
import { CardStep, cardStep } from '../shared/steps';

const wuxie: CardDefinition = { id: 'wuxie', name: 'Wuxie Kongjie', category: 'tool', play: () => [] };
const cards = [shaCard, shanCard, wineCard, coerceCard, hailOfArrowsCard, crossbowCard, wuxie];
const registry: ContentRegistry = { cards: new Map(cards.map((c) => [c.id, c])), generals: new Map() };
const seenSteps: string[] = [];
// Notes every step of every card, and lets it through unchanged.
const recorder: SkillTrigger = {
  point: 'before:CardStepEffect',
  condition: () => true,
  effect: (_s, step) => {
    seenSteps.push((step as CardStep).step);
    return [step];
  },
};
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [recorder] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });
const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });

// Four seats round the table at 4/4 HP; seat-a's Play phase. `cards` fills zones by id.
function table(cards: Record<string, CardInstance[]> = {}, flags?: Record<string, boolean>): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  return {
    seats: ids.map((id, index) => ({
      id, index, kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[index], eliminated: false,
      generals: { main: { generalDefinitionId: 'none', revealed: true }, deputy: { generalDefinitionId: 'none', revealed: true } },
      combinedHp: 4, maxCombinedHp: 4,
      hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
    })),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], ...(flags ? { flags } : {}) }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}
const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
const play = (s: GameState, cardInstanceId: string, ...targets: string[]) => act(s, { kind: 'PlayCardAction', seatId: s.turn.ownerSeatId, cardInstanceId, targets: targets.map(seat) });
const pass = (s: GameState) => act(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id });
const respond = (s: GameState, cardInstanceId: string) =>
  act(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId });
const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;

beforeEach(() => {
  seenSteps.length = 0;
});

describe('Sha steps', () => {
  it('a Sha that hits goes through every step, in order', () => {
    const s = pass(play(table({ 'seat-a:hand': [card('s1', 'sha')] }), 's1', 'seat-b'));
    expect(seenSteps).toEqual(['sha-use', 'sha-targeted', 'sha-armor', 'sha-shan', 'sha-hit', 'sha-damage', 'sha-after-damage']);
    expect(hp(s, 'seat-b')).toBe(3);
  });

  it('a Shan counts toward the Shan needed, then the Sha is dodged, with no damage', () => {
    const s = respond(play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:hand': [card('d1', 'shan')] }), 's1', 'seat-b'), 'd1');
    expect(seenSteps).toEqual(['sha-use', 'sha-targeted', 'sha-armor', 'sha-shan', 'sha-shan', 'sha-dodged']);
    expect(hp(s, 'seat-b')).toBe(4);
  });

  it('the Shan window names the Sha and its user, and shows the damage it would deal, Wine included', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha')] }, { wine: true }), 's1', 'seat-b');
    expect(s.pendingResponse).toMatchObject({
      respondingSeatId: 'seat-b',
      allowedCardIds: ['shan'],
      reason: { kind: 'card-effect', card: { as: 'sha' }, userSeatId: 'seat-a' },
      context: { effect: { kind: 'CardStepEffect', step: 'sha-hit' } },
      outcome: { kind: 'DamageEffect', damage: { amount: 2, target: seat('seat-b') } },
    });
    expect(hp(pass(s), 'seat-b')).toBe(2);
  });

  it('Coerce’s Sha runs on the same steps, from step 1, and isn’t counted', () => {
    // seat-b wears a Crossbow (range 1) and holds a Sha; seat-a Coerces it at seat-c.
    let s = play(table({ 'seat-a:hand': [card('co', 'coerce')], 'seat-b:equip': [card('x', 'crossbow')], 'seat-b:hand': [card('bs', 'sha')] }), 'co', 'seat-b', 'seat-c');
    s = respond(s, 'bs');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', allowedCardIds: ['shan'] });
    s = pass(s);
    expect(seenSteps).toEqual(['sha-targeted', 'sha-armor', 'sha-shan', 'sha-hit', 'sha-damage', 'sha-after-damage']);
    expect(hp(s, 'seat-c')).toBe(3);
    expect(s.turn.cardPlays?.['sha'] ?? 0).toBe(0);
  });

  it('a target gone before its steps is skipped', () => {
    const t = table();
    const gone: GameState = {
      ...t,
      seats: t.seats.map((x) => (x.id === 'seat-b' ? { ...x, eliminated: true } : x)),
      resolutionQueue: [cardStep('sha-targeted', usedCardOf(card('s1', 'sha')), 'seat-a', seat('seat-b'))],
    };
    expect(advanceToDecision(gone, ctx).state.pendingResponse).toBeNull();
  });
});

describe('Hail of Arrows on steps', () => {
  it('asks each target through a hail-shan step', () => {
    const s = play(table({ 'seat-a:hand': [card('h', 'hail-of-arrows')] }), 'h');
    expect(seenSteps).toEqual(['hail-shan']);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
  });

  it('opens no window once its Shan is provided', () => {
    const provided = cardStep('hail-shan', usedCardOf(card('h', 'hail-of-arrows')), 'seat-a', seat('seat-b'), { needed: 1, provided: 1 });
    expect(advanceToDecision({ ...table(), resolutionQueue: [provided] }, ctx).state.pendingResponse).toBeNull();
  });
});
```

Add to `describe('describeResponse', …)` in `projects/app/src/app/game-board/response-description.spec.ts` (import `usedCardOf` from `engine` if not yet):

```ts
  it('describes a Sha’s Shan window from its reason, and No Response from the damage it would deal', () => {
    const log: EngineEvent[] = [{ kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets: [seat('seat-0')] }];
    const used = usedCardOf(sha);
    const window: PendingResponse = {
      id: 'w1', respondingSeatId: 'seat-0', allowedActionKinds: ['RespondAction', 'PassAction'], allowedCardIds: ['shan'],
      reason: { kind: 'card-effect', card: used, userSeatId: 'seat-1' },
      context: { effect: { kind: 'CardStepEffect', step: 'sha-hit', card: used, userSeatId: 'seat-1', target: seat('seat-0'), data: { extra: 1 } } },
      outcome: { kind: 'DamageEffect', damage: { source: seat('seat-1'), target: seat('seat-0'), amount: 2, nature: 'normal', cause: { cardInstanceId: 'sha-1', card: used } } },
    };
    expect(describeResponse(state(log, window), 'seat-0')).toMatchObject({
      source: 'Seat 1 played Sha against Hing',
      prompt: 'Your turn to respond to Sha',
      outcome: 'You lose 2 HP (2 damage from Seat 1)',
    });
  });
```

In `projects/content/src/lib/cards/cards.spec.ts`, the Sha window's id now names the target and the Shan count. Replace each `pendingResponseId: 'sha-response-sha-1'` with `pendingResponseId: opened.state.pendingResponse!.id`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/content/src/lib/cards/sha-steps.spec.ts projects/app/src/app/game-board/response-description.spec.ts`
Expected: FAIL. `shared/steps.ts` doesn't exist, and the Sha opens its window directly.

- [ ] **Step 3: Step helpers**

Create `projects/content/src/lib/shared/steps.ts`:

```ts
import type { AbilityOwner, ContentRegistry, Effect, GameState, SkillTrigger, Target, UsedCard } from 'engine';

export type CardStep = Extract<Effect, { kind: 'CardStepEffect' }>;

export function cardStep(step: string, card: UsedCard, userSeatId: string, target: Target, data: Record<string, unknown> = {}): CardStep {
  return { kind: 'CardStepEffect', step, card, userSeatId, target, data };
}

const ownerKey = (owner: AbilityOwner) => (owner.kind === 'equipment' ? owner.cardInstanceId : `${owner.seatId}:${owner.slot}`);
const actedKeys = (step: CardStep) => (step.data?.['acted'] as string[] | undefined) ?? [];

// Whether `owner`'s ability has already had its say at this step.
export function hasActed(step: CardStep, owner: AbilityOwner): boolean {
  return actedKeys(step).includes(ownerKey(owner));
}

// The step, marked so `owner`'s ability doesn't act on it again (an ask's
// Don't sends it back through its before-triggers).
export function actedOn(step: CardStep, owner: AbilityOwner): CardStep {
  return { ...step, data: { ...step.data, acted: [...actedKeys(step), ownerKey(owner)] } };
}

// An optional ability at a step: ask its owner. Use queues `effects`; Don't
// lets the step go on. The ask names the step's target unless `targetSeatId`
// says otherwise (null: no target).
export function askAtStep(owner: AbilityOwner, abilityId: string, step: CardStep, effects: Effect[], targetSeatId: string | null = step.target.seatId): Effect {
  return { kind: 'AskUseEffect', owner, abilityId, effects, otherwise: [actedOn(step, owner)], ...(targetSeatId ? { targetSeatId } : {}) };
}

export interface StepRule {
  condition?(state: GameState, step: CardStep, owner: AbilityOwner, registry: ContentRegistry): boolean;
  effect(state: GameState, step: CardStep, owner: AbilityOwner, registry: ContentRegistry): Effect[];
}

// A worn card's (or skill's) rule at the named steps: a before-trigger on
// CardStepEffect that acts at most once per step. Its effect replaces the step:
// a rewrite (return the step changed, marked with actedOn), a stop (return
// something else, or nothing), or an ask (askAtStep).
export function atStep(steps: string[], rule: StepRule): SkillTrigger {
  return {
    point: 'before:CardStepEffect',
    condition: (state, subject, owner, registry) => {
      const step = subject as CardStep;
      return !!owner && !!registry && steps.includes(step.step) && !hasActed(step, owner) && (rule.condition?.(state, step, owner, registry) ?? true);
    },
    effect: (state, subject, owner, registry) => rule.effect(state, subject as CardStep, owner!, registry!),
  };
}
```

- [ ] **Step 4: Sha on steps**

Replace `projects/content/src/lib/cards/sha.ts` with:

```ts
import type { CardDefinition, Effect, GameState, Target, UsedCard } from 'engine';
import { livingSeatOrderFrom, usedCardKey } from 'engine';
import { attackRange, otherLivingSeatTargets, seatDistance, shaLimit } from '../shared/queries';
import { CardStep, cardStep } from '../shared/steps';
import { WINE_FLAG } from './wine';

// What a Sha's steps carry. `extra`: damage added to a hit (Wine, Ancient
// Scimitar). `lastHandCard`: played as its user's last hand card (Sky
// Scorcher). `picked`: extra targets chosen at 'sha-use'. `needed`/`provided`:
// Shan asked for and given so far. `acted`: abilities that had their say.
export interface ShaStepData {
  extra?: number;
  lastHandCard?: boolean;
  picked?: string[];
  needed?: number;
  provided?: number;
  acted?: string[];
}

export const shaData = (step: CardStep) => (step.data ?? {}) as ShaStepData;

// The next step of the same Sha at the same target, keeping its extra damage.
export function shaStep(from: CardStep, step: string, more: ShaStepData = {}): CardStep {
  return cardStep(step, from.card, from.userSeatId, from.target, { extra: shaData(from).extra ?? 0, ...more });
}

// A Sha's steps from step 1 at each target, in seat order from its user.
export function shaAt(state: GameState, card: UsedCard, userSeatId: string, targets: Target[], extra = 0): Effect[] {
  const order = livingSeatOrderFrom(state, userSeatId);
  return [...targets]
    .sort((a, b) => order.indexOf(a.seatId) - order.indexOf(b.seatId))
    .map((target) => cardStep('sha-targeted', card, userSeatId, target, { extra }));
}

function damageOf(step: CardStep): Effect {
  const first = step.card.physical[0]?.instanceId;
  return {
    kind: 'DamageEffect',
    damage: {
      source: { kind: 'seat', seatId: step.userSeatId },
      target: step.target,
      amount: 1 + (shaData(step).extra ?? 0),
      nature: 'normal',
      cause: { ...(first ? { cardInstanceId: first } : {}), card: step.card },
    },
  };
}

// Step 3: the target plays a Shan (one more provided), or the Sha hits.
function shanWindow(step: CardStep): Effect {
  const { needed = 1, provided = 0 } = shaData(step);
  return {
    kind: 'OpenResponseEffect',
    pendingResponse: {
      id: `sha-response-${usedCardKey(step.card)}-${step.target.seatId}-${provided}`,
      respondingSeatId: step.target.seatId,
      allowedActionKinds: ['RespondAction', 'PassAction'],
      allowedCardIds: ['shan'],
      reason: { kind: 'card-effect', card: step.card, userSeatId: step.userSeatId },
      context: { effect: shaStep(step, 'sha-hit') },
      onAnswer: [shaStep(step, 'sha-shan', { needed, provided: provided + 1 })],
      outcome: damageOf(step),
    },
  };
}

const isLiving = (state: GameState, seatId: string) => state.seats.some((s) => s.id === seatId && !s.eliminated);

// Sha: see the Sha-Equipment spec's steps. Played in the Play Phase it counts
// toward the limit and spends Wine at once, whatever its steps bring.
export const shaCard: CardDefinition = {
  id: 'sha',
  name: 'Sha',
  category: 'basic',
  legalPlayTargets: (state, ctx, registry) => {
    if ((state.turn.cardPlays?.['sha'] ?? 0) >= shaLimit(state, ctx.seatId, registry)) return [];
    const range = attackRange(state, ctx.seatId, registry);
    return otherLivingSeatTargets(state, ctx.seatId).filter(
      ([target]) => target.kind === 'seat' && seatDistance(state, ctx.seatId, target.seatId, registry) <= range
    );
  },
  play: (state, ctx) => {
    if (ctx.respondingTo) return []; // played as an answer (a Duel, Barbarians, Coerce): the window decides what it does
    if (ctx.targets.length === 0) return []; // no target chosen: a no-op rather than a crash
    const boosted = !ctx.free && !!state.turn.flags?.[WINE_FLAG];
    const spend: Effect[] = boosted ? [{ kind: 'SetTurnFlagEffect', flag: WINE_FLAG, value: false }] : [];
    // Still in hand while play() runs: is it all that's left there?
    const hand = state.zones.find((z) => z.kind === 'hand' && z.ownerSeatId === ctx.seatId)?.cards ?? [];
    const lastHandCard = !ctx.free && hand.length > 0 && hand.every((c) => ctx.card.physical.some((p) => p.instanceId === c.instanceId));
    return [...spend, cardStep('sha-use', ctx.card, ctx.seatId, ctx.targets[0], { extra: boosted ? 1 : 0, ...(lastHandCard ? { lastHandCard: true } : {}) })];
  },
  onStep: (state, step) => {
    const data = shaData(step);
    if (step.step === 'sha-use') {
      const extraTargets: Target[] = (data.picked ?? []).map((seatId) => ({ kind: 'seat', seatId }));
      return shaAt(state, step.card, step.userSeatId, [step.target, ...extraTargets], data.extra ?? 0);
    }
    // A target gone before its turn comes is simply skipped.
    if (!isLiving(state, step.target.seatId)) return [];
    switch (step.step) {
      case 'sha-targeted':
        return [shaStep(step, 'sha-armor')];
      case 'sha-armor':
        return [shaStep(step, 'sha-shan', { needed: 1, provided: 0 })];
      case 'sha-shan':
        return (data.provided ?? 0) >= (data.needed ?? 1) ? [shaStep(step, 'sha-dodged')] : [shanWindow(step)];
      case 'sha-dodged':
        return [];
      case 'sha-hit':
        return [shaStep(step, 'sha-damage')];
      case 'sha-damage':
        return [damageOf(step), shaStep(step, 'sha-after-damage')];
      case 'sha-after-damage':
        return [];
      default:
        throw new Error(`Sha has no step ${step.step}`);
    }
  },
};
```

In `projects/content/src/lib/cards/coerce.ts`:
- Import `shaAt` instead of `shaWindow`.
- Change `onResponse`'s last line to:

```ts
    return victim ? shaAt(state, card, seatId, [seat(victim.id)]) : [];
```

and its comment to `// The holder's Sha: a Sha at the victim, from step 1, answered like any Sha.`

In `projects/content/src/lib/cards/mass-attack.ts`, Hail of Arrows asks through a step so an ability can answer first:

```ts
import type { CardDefinition, Effect, Target, UsedCard } from 'engine';
import { usedCardKey } from 'engine';
import { otherSeatsInTurnOrder, toolOnTargets } from '../shared/tools';
import { cardStep } from '../shared/steps';

// Targets every other living seat in turn order; each must play `answerCardId`
// or take 1 damage from the user. With `step` (Hail of Arrows), the ask is a
// card step with data { needed, provided }, so an ability can provide the
// answer first (Eight Trigrams).
function massAttack(id: string, name: string, answerCardId: string, step?: string): CardDefinition {
  const window = (tool: UsedCard, userSeatId: string, target: Target): Effect => {
    const physicalId = tool.physical[0]?.instanceId;
    return {
      kind: 'OpenResponseEffect',
      pendingResponse: {
        id: `${id}-${usedCardKey(tool)}-${target.seatId}`,
        respondingSeatId: target.seatId,
        allowedActionKinds: ['RespondAction', 'PassAction'],
        allowedCardIds: [answerCardId],
        reason: { kind: 'card-effect', card: tool, userSeatId },
        context: {
          effect: {
            kind: 'DamageEffect',
            damage: {
              source: { kind: 'seat', seatId: userSeatId },
              target,
              amount: 1,
              nature: 'normal',
              ...(physicalId ? { cause: { cardInstanceId: physicalId, card: tool } } : { cause: { card: tool } }),
            },
          },
        },
      },
    };
  };
  return {
    id,
    name,
    category: 'tool',
    legalPlayTargets: (state, ctx) => (otherSeatsInTurnOrder(state, ctx.seatId).length > 0 ? [[]] : []),
    play: (state, ctx) => (ctx.respondingTo ? [] : toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, otherSeatsInTurnOrder(state, ctx.seatId))),
    onTarget: (_state, { tool, userSeatId, target }) =>
      step ? [cardStep(step, tool, userSeatId, target, { needed: 1, provided: 0 })] : [window(tool, userSeatId, target)],
    ...(step
      ? {
          onStep: (_state, s) => {
            const { needed = 1, provided = 0 } = (s.data ?? {}) as { needed?: number; provided?: number };
            return provided >= needed ? [] : [window(s.card, s.userSeatId, s.target)];
          },
        }
      : {}),
  };
}

export const barbariansCard = massAttack('barbarians', 'Barbarians', 'sha');
export const hailOfArrowsCard = massAttack('hail-of-arrows', 'Hail of Arrows', 'shan', 'hail-shan');
```

- [ ] **Step 5: The app reads the window's reason and outcome**

In `projects/app/src/app/game-board/response-description.ts`:
- Replace `causeInstanceId` with:

```ts
// The card whose effect the window holds back: the window's own source card,
// else the card its reason names, else the cause of the damage it would deal.
function causeInstanceId(state: GameState): string | undefined {
  const pending = state.pendingResponse;
  if (!pending) return undefined;
  if (pending.sourceCard) return pending.sourceCard.instanceId;
  if (pending.reason?.kind === 'card-effect') return pending.reason.card.physical[0]?.instanceId;
  const effect = pending.outcome ?? pending.context.effect;
  return effect.kind === 'DamageEffect' ? effect.damage.cause?.cardInstanceId : undefined;
}
```

- In the generic return at the end of `describeResponse`, and in the `card-effect` + `victimSeatId` branch, describe what not answering leads to: use `const shown = pending.outcome ?? pending.context.effect;`. Pass `preview(shown) ?? shown` to `outcomeOf`, and `affectedSeatOf(shown)` for the force.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest`
Expected: PASS, every project. If a content test still names a Sha window by its old id (`sha-response-<id>`), read the id from `pendingResponse!.id` instead.

- [ ] **Step 7: Commit**

```bash
git add projects
git commit -m "feat(content): Sha runs on steps; Coerce's Sha and Hail of Arrows ask through them

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Armour — Eight Trigrams, Black Shield, Wood Armor

**Files:**
- Move: `projects/content/src/lib/cards/equipment.ts` → `projects/content/src/lib/cards/equipment/index.ts`
- Create:
  - `projects/content/src/lib/cards/equipment/eight-trigrams.ts`, `black-shield.ts`, `wood-armor.ts`, `sha-equipment.spec.ts`
  - `projects/content/src/lib/shared/armor.ts`
- Modify:
  - Engine: `projects/engine/src/lib/registry/types.ts` (`untargetableBy`).
  - Content: `shared/abilities.ts`, `cards/mass-attack.ts`, `registry.ts`, `registry.spec.ts`, `modes/kingdomWar.spec.ts`.

**Interfaces:**
- Consumes: `atStep`, `askAtStep`, `actedOn`, `cardStep` (Task 5). `JudgeEffect.data`, `onlyFrom`, `AbilityUsedEffect` (Task 2).
- Produces:

```ts
// engine AbilityModifiers gains untargetableBy?: string[]
// shared/armor.ts
export function shaIgnoresArmor(state: GameState, step: CardStep, registry: ContentRegistry): boolean;
export function stopsSha(abilityId: string, applies: (step: CardStep) => boolean): SkillTrigger;
// shared/abilities.ts
export function untargetableBy(state: GameState, seatId: string, cardId: string, registry: ContentRegistry): boolean;
export function ownerCard(state: GameState, owner: AbilityOwner): CardInstance | undefined;
// cards/equipment/index.ts: makeEquipmentCard extras gain onJudged
// AbilityUsedEvent outcomes: 'no-effect' (targetSeatId = the Sha's user), 'counts-as-shan'
export const eightTrigramsCard, blackShieldCard, woodArmorCard: CardDefinition;
```

- [ ] **Step 1: Move the equipment file**

```bash
mkdir -p projects/content/src/lib/cards/equipment
git mv projects/content/src/lib/cards/equipment.ts projects/content/src/lib/cards/equipment/index.ts
```

In the moved file, fix its two relative imports: `'../../../data/cards'` becomes `'../../../../data/cards'`, and `'../shared/abilities'` becomes `'../../shared/abilities'`. Every `import … from './equipment'` (or `'./cards/equipment'`) elsewhere still resolves to the folder's `index.ts`.

Run: `npx jest projects/content`
Expected: PASS (nothing else changed).

- [ ] **Step 2: Write the failing tests**

Create `projects/content/src/lib/cards/equipment/sha-equipment.spec.ts`. Tasks 7 and 8 append to this file.

```ts
import { advanceToDecision, getLegalActions, resolve } from 'engine';
import type { Action, CardInstance, GameModeDefinition, GameState, QueueItem } from 'engine';
import { buildContentRegistry } from '../../registry';
import { cardStep } from '../../shared/steps';

// The real cards and Generals; a mode with no triggers of its own.
const registry = buildContentRegistry();
const mode: GameModeDefinition = { id: 'stub', setup: (() => { throw new Error('unused'); }) as GameModeDefinition['setup'], checkWinCondition: () => null, triggers: [] };
const ctx = { registry, mode };

const card = (instanceId: string, definitionId: string, suit: CardInstance['suit'] = 'spade', rank = 7): CardInstance => ({ instanceId, definitionId, suit, rank });
const seat = (seatId: string) => ({ kind: 'seat' as const, seatId });

interface TableOptions {
  hp?: Record<string, number>;
  // A seat's [Main, Deputy, revealed?]. Default: Cao Cao and Dong Zhuo (male,
  // no skills), revealed.
  generals?: Record<string, [string, string, boolean?]>;
  flags?: Record<string, boolean>;
}

// Four seats round the table (Wei, Shu, Wu, Qun) at 4/4 HP; seat-a's Play
// phase. `cards` fills zones by id ('drawPile': top first).
function table(cards: Record<string, CardInstance[]> = {}, o: TableOptions = {}): GameState {
  const ids = ['seat-a', 'seat-b', 'seat-c', 'seat-d'];
  return {
    seats: ids.map((id, index) => {
      const [main, deputy, revealed = true] = o.generals?.[id] ?? ['cao-cao', 'dong-zhuo'];
      return {
        id, index, kingdom: (['Wei', 'Shu', 'Wu', 'Qun'] as const)[index], eliminated: false,
        generals: { main: { generalDefinitionId: main, revealed }, deputy: { generalDefinitionId: deputy, revealed } },
        combinedHp: o.hp?.[id] ?? 4, maxCombinedHp: 4,
        hand: { zoneId: `${id}:hand` }, equipped: { zoneId: `${id}:equip` }, judgment: { zoneId: `${id}:judgment` },
      };
    }),
    players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [], ...(o.flags ? { flags: o.flags } : {}) }, phase: 'Play',
    zones: [
      { id: 'drawPile', kind: 'drawPile', cards: cards['drawPile'] ?? [] },
      { id: 'discardPile', kind: 'discardPile', cards: [] },
      { id: 'processing', kind: 'processing', cards: [] },
      ...ids.flatMap((id) => [
        { id: `${id}:hand`, kind: 'hand' as const, ownerSeatId: id, cards: cards[`${id}:hand`] ?? [] },
        { id: `${id}:equip`, kind: 'equip' as const, ownerSeatId: id, cards: cards[`${id}:equip`] ?? [] },
        { id: `${id}:judgment`, kind: 'judgment' as const, ownerSeatId: id, cards: [] },
      ]),
    ],
    pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
  };
}

const act = (s: GameState, action: Action) => resolve(s, action, ctx).state;
const play = (s: GameState, cardInstanceId: string, ...targets: string[]) => act(s, { kind: 'PlayCardAction', seatId: s.turn.ownerSeatId, cardInstanceId, targets: targets.map(seat) });
const pass = (s: GameState) => act(s, { kind: 'PassAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id });
const respond = (s: GameState, cardInstanceId: string) =>
  act(s, { kind: 'RespondAction', seatId: s.pendingResponse!.respondingSeatId, pendingResponseId: s.pendingResponse!.id, cardInstanceId });
const choose = (s: GameState, optionId: string) => act(s, { kind: 'ChooseOptionAction', seatId: s.pendingChoice!.seatId, choiceId: s.pendingChoice!.id, optionId });
const use = (s: GameState) => choose(s, 'use');
const decline = (s: GameState) => choose(s, 'decline');
const select = (s: GameState, ...ids: string[]) => act(s, { kind: 'SelectAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id, ids });
const cancel = (s: GameState) => act(s, { kind: 'CancelSelectionAction', seatId: s.pendingSelection!.seatId, selectionId: s.pendingSelection!.id });
const run = (s: GameState, queue: QueueItem[]) => advanceToDecision({ ...s, resolutionQueue: queue }, ctx).state;
const hp = (s: GameState, seatId: string) => s.seats.find((x) => x.id === seatId)!.combinedHp;
const ids = (s: GameState, zoneId: string) => s.zones.find((z) => z.id === zoneId)!.cards.map((c) => c.instanceId);
// The ability a pending ask is about, if any.
const askedAbout = (s: GameState) => (s.pendingChoice?.reason.kind === 'ability' ? s.pendingChoice.reason.abilityId : null);
const abilityLog = (s: GameState) => s.log.filter((e) => e.kind === 'AbilityUsedEvent');

describe('Black Shield', () => {
  const shield = card('bs', 'black-shield', 'club', 2);

  it('a black Sha has no effect on its wearer, but still counts and still spends Wine', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha', 'spade')], 'seat-b:equip': [shield] }, { flags: { wine: true } }), 's1', 'seat-b');
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
    expect(s.turn.cardPlays).toEqual({ sha: 1 });
    expect(s.turn.flags).toBeUndefined();
    expect(abilityLog(s)).toEqual([
      { kind: 'AbilityUsedEvent', owner: { kind: 'equipment', seatId: 'seat-b', cardInstanceId: 'bs' }, abilityId: 'black-shield', outcome: 'no-effect', targetSeatId: 'seat-a' },
    ]);
  });

  it('a red Sha still asks for a Shan', () => {
    expect(play(table({ 'seat-a:hand': [card('s1', 'sha', 'heart')], 'seat-b:equip': [shield] }), 's1', 'seat-b').pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('a Sha with no colour still affects its wearer', () => {
    const s = run(table({ 'seat-b:equip': [shield] }), [cardStep('sha-targeted', { as: 'sha', colour: 'none', physical: [] }, 'seat-a', seat('seat-b'))]);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('is turned off by the attacker’s Black Pommel', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('bp', 'black-pommel')], 'seat-b:equip': [shield] }), 's1', 'seat-b');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });
});

describe('Wood Armor', () => {
  const armor = card('wa', 'wood-armor', 'spade', 2);

  it('a Sha of any colour has no effect on its wearer', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha', 'heart')], 'seat-b:equip': [armor] }), 's1', 'seat-b');
    expect(s.pendingResponse).toBeNull();
    expect(abilityLog(s)).toMatchObject([{ abilityId: 'wood-armor', outcome: 'no-effect', targetSeatId: 'seat-a' }]);
  });

  it('is turned off by the attacker’s Black Pommel', () => {
    const s = play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('bp', 'black-pommel')], 'seat-b:equip': [armor] }), 's1', 'seat-b');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('Barbarians and Hail of Arrows skip its wearer: no window and no Wuxie check for it', () => {
    // Turn order from seat-a: b (skipped), c, d. c holds a Wuxie: it is asked about c, never b.
    const s = play(table({ 'seat-a:hand': [card('h', 'hail-of-arrows')], 'seat-b:equip': [armor], 'seat-c:hand': [card('w', 'wuxie')] }), 'h');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c', reason: { kind: 'wuxie', target: seat('seat-c') } });
    const barbarians = play(table({ 'seat-a:hand': [card('b', 'barbarians')], 'seat-b:equip': [armor] }), 'b');
    expect(barbarians.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c' });
  });
});

describe('Eight Trigrams', () => {
  const trigrams = card('et', 'eight-trigrams', 'spade', 2);
  const attack = (judged: CardInstance, more: Record<string, CardInstance[]> = {}) =>
    play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-b:equip': [trigrams], drawPile: [judged], ...more }), 's1', 'seat-b');

  it('asks its wearer when a Shan is needed', () => {
    const s = attack(card('j', 'peach', 'heart', 9));
    expect(askedAbout(s)).toBe('eight-trigrams');
    expect(s.pendingChoice!.seatId).toBe('seat-b');
  });

  it('a red judgment counts as a Shan: dodged, with no card from the hand', () => {
    const s = use(attack(card('j', 'peach', 'heart', 9), { 'seat-b:hand': [card('d1', 'shan')] }));
    expect(s.pendingResponse).toBeNull();
    expect(hp(s, 'seat-b')).toBe(4);
    expect(ids(s, 'seat-b:hand')).toEqual(['d1']);
    expect(s.log.find((e) => e.kind === 'JudgmentEvent')).toMatchObject({ seatId: 'seat-b', tool: { as: 'eight-trigrams' }, card: { instanceId: 'j' } });
    expect(abilityLog(s)).toMatchObject([{ abilityId: 'eight-trigrams', outcome: 'counts-as-shan' }]);
  });

  it('a black judgment: the Shan window opens as normal, the judged card already discarded (Review Focus 4)', () => {
    const s = use(attack(card('j', 'peach', 'club', 9)));
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
    expect(ids(s, 'discardPile')).toContain('j');
    expect(ids(s, 'processing')).toEqual([]);
    expect(hp(pass(s), 'seat-b')).toBe(3);
  });

  it('Don’t: the window opens with no judgment, and it isn’t asked again', () => {
    const s = decline(attack(card('j', 'peach', 'heart', 9)));
    expect(s.pendingChoice).toBeUndefined();
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    expect(s.log.some((e) => e.kind === 'JudgmentEvent')).toBe(false);
  });

  it('answers Hail of Arrows too', () => {
    let s = play(table({ 'seat-a:hand': [card('h', 'hail-of-arrows')], 'seat-b:equip': [trigrams], drawPile: [card('j', 'peach', 'diamond', 3)] }), 'h');
    expect(askedAbout(s)).toBe('eight-trigrams');
    s = use(s);
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-c' }); // seat-b is covered; on to seat-c
  });

  it('is turned off against a Sha by Black Pommel, so it isn’t asked', () => {
    const s = play(
      table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [card('bp', 'black-pommel')], 'seat-b:equip': [trigrams], drawPile: [card('j', 'peach', 'heart', 9)] }),
      's1',
      'seat-b'
    );
    expect(s.pendingChoice).toBeUndefined();
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });
});
```

`getLegalActions`, `cancel` and `select` are first used by Task 8's tests in this file. (The project doesn't flag unused locals.)

In `projects/content/src/lib/registry.spec.ts`, add `'eight-trigrams', 'black-shield', 'wood-armor'` to the expected card ids.

In `projects/content/src/lib/modes/kingdomWar.spec.ts`, the deck grows by 5: change `toHaveLength(106)` to `toHaveLength(111)`.

- [ ] **Step 3: Run them to verify they fail**

Run: `npx jest projects/content`
Expected: FAIL. The three cards aren't registered, and the deck is still 106.

- [ ] **Step 4: Engine modifier and content helpers**

In `projects/engine/src/lib/registry/types.ts`, add to `AbilityModifiers`:

```ts
  // Card ids that can't target the wearer (Wood Armor: Barbarians, Hail of Arrows).
  untargetableBy?: string[];
```

In `projects/content/src/lib/shared/abilities.ts`, add (importing `AbilityOwner` and `CardInstance` as types):

```ts
// Whether `cardId` can't target `seatId`: an ability of its says so (Wood Armor).
export function untargetableBy(state: GameState, seatId: string, cardId: string, registry: ContentRegistry): boolean {
  return activeAbilities(state, seatId, registry).some((a) => a.modifiers?.untargetableBy?.includes(cardId));
}

// The worn card behind an equipment owner, wherever it now lies.
export function ownerCard(state: GameState, owner: AbilityOwner): CardInstance | undefined {
  if (owner.kind !== 'equipment') return undefined;
  return state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === owner.cardInstanceId);
}
```

Create `projects/content/src/lib/shared/armor.ts`:

```ts
import type { ContentRegistry, GameState, SkillTrigger } from 'engine';
import { activeAbilities } from './abilities';
import { CardStep, atStep } from './steps';

// Whether a Sha's step has its target's armour turned off: the Sha's user has
// an ability that ignores armour (Black Pommel). Armour steps run from step 2
// to step 5.
export function shaIgnoresArmor(state: GameState, step: CardStep, registry: ContentRegistry): boolean {
  return step.card.as === 'sha' && activeAbilities(state, step.userSeatId, registry).some((a) => a.modifiers?.ignoresArmor);
}

// Armour that stops a Sha at step 2 when `applies` (Black Shield, Wood Armor):
// the step becomes a logged "no effect" (naming the Sha's user), and the Sha
// goes no further at this target.
export function stopsSha(abilityId: string, applies: (step: CardStep) => boolean): SkillTrigger {
  return atStep(['sha-armor'], {
    condition: (state, step, owner, registry) => step.target.seatId === owner.seatId && applies(step) && !shaIgnoresArmor(state, step, registry),
    effect: (_state, step, owner) => [{ kind: 'AbilityUsedEffect', owner, abilityId, outcome: 'no-effect', targetSeatId: step.userSeatId }],
  });
}
```

In `projects/content/src/lib/cards/equipment/index.ts`, let equipment carry a judgment reader:

```ts
interface EquipmentExtras {
  abilities?: Abilities;
  onUnequip?: CardDefinition['onUnequip'];
  onJudged?: CardDefinition['onJudged'];
}
```

and add `...(extras.onJudged ? { onJudged: extras.onJudged } : {}),` beside the other extras in `makeEquipmentCard`.

- [ ] **Step 5: The three cards**

Create `projects/content/src/lib/cards/equipment/black-shield.ts`:

```ts
import { makeEquipmentCard } from './index';
import { stopsSha } from '../../shared/armor';

// Black Shield: a black Sha has no effect on its wearer. A Sha with no colour
// still does.
export const blackShieldCard = makeEquipmentCard('black-shield', 'Black Shield', 'armor', undefined, {
  abilities: { triggers: [stopsSha('black-shield', (step) => step.card.colour === 'black')] },
});
```

Create `projects/content/src/lib/cards/equipment/wood-armor.ts`:

```ts
import { makeEquipmentCard } from './index';
import { stopsSha } from '../../shared/armor';

// Wood Armor: a Sha has no effect on its wearer, and Barbarians and Hail of
// Arrows skip it as a target. (Its fire weakness can't come up: no fire damage.)
export const woodArmorCard = makeEquipmentCard('wood-armor', 'Wood Armor', 'armor', undefined, {
  abilities: {
    triggers: [stopsSha('wood-armor', () => true)],
    modifiers: { untargetableBy: ['barbarians', 'hail-of-arrows'] },
  },
});
```

Create `projects/content/src/lib/cards/equipment/eight-trigrams.ts`:

```ts
import type { Effect } from 'engine';
import { colourOf, requireZoneOfKind, usedCardOf } from 'engine';
import { makeEquipmentCard } from './index';
import { CardStep, actedOn, askAtStep, atStep } from '../../shared/steps';
import { shaIgnoresArmor } from '../../shared/armor';
import { ownerCard } from '../../shared/abilities';

interface ShanData {
  needed?: number;
  provided?: number;
}

// Eight Trigrams: whenever its wearer needs a Shan ('sha-shan' or
// 'hail-shan'), it may judge first. Red counts as one Shan; on black the Shan
// is asked for as normal. It provides at most one Shan per step. Black Pommel
// turns it off against a Sha.
export const eightTrigramsCard = makeEquipmentCard('eight-trigrams', 'Eight Trigrams', 'armor', undefined, {
  abilities: {
    triggers: [
      atStep(['sha-shan', 'hail-shan'], {
        condition: (state, step, owner, registry) => {
          const { needed = 1, provided = 0 } = (step.data ?? {}) as ShanData;
          return step.target.seatId === owner.seatId && provided < needed && !(step.step === 'sha-shan' && shaIgnoresArmor(state, step, registry));
        },
        effect: (state, step, owner) => {
          const worn = ownerCard(state, owner);
          if (!worn) return [actedOn(step, owner)];
          const judge: Effect = { kind: 'JudgeEffect', seatId: owner.seatId, tool: usedCardOf(worn), data: { step: actedOn(step, owner) } };
          return [askAtStep(owner, 'eight-trigrams', step, [judge])];
        },
      }),
    ],
  },
  // The judged card goes to the discard pile first, so it doesn't lie in
  // processing while the Shan window waits. Then the step goes on: with one
  // more Shan provided on red.
  onJudged: (state, { judged, data, seatId, tool }) => {
    const step = data?.['step'] as CardStep;
    const done: Effect = {
      kind: 'MoveCardEffect',
      cardInstanceId: judged.instanceId,
      toZoneId: requireZoneOfKind(state.zones, 'discardPile').id,
      onlyFrom: requireZoneOfKind(state.zones, 'processing').id,
    };
    if (colourOf(judged) === 'black') return [done, step];
    const { provided = 0 } = (step.data ?? {}) as ShanData;
    const owner = { kind: 'equipment' as const, seatId, cardInstanceId: tool.physical[0].instanceId };
    return [
      done,
      { kind: 'AbilityUsedEffect', owner, abilityId: 'eight-trigrams', outcome: 'counts-as-shan' },
      { ...step, data: { ...step.data, provided: provided + 1 } },
    ];
  },
});
```

- [ ] **Step 6: Barbarians and Hail skip the untargetable; register the cards**

In `projects/content/src/lib/cards/mass-attack.ts`:
- Import `untargetableBy` from `'../shared/abilities'` and `ContentRegistry`/`GameState` as types.
- Inside `massAttack`, add:

```ts
  // Every other living seat in turn order that this card may target.
  const targetsOf = (state: GameState, seatId: string, registry: ContentRegistry) =>
    otherSeatsInTurnOrder(state, seatId).filter((t) => !untargetableBy(state, t.seatId, id, registry));
```

- Change `legalPlayTargets` to `(state, ctx, registry) => (targetsOf(state, ctx.seatId, registry).length > 0 ? [[]] : [])`.
- Change `play` to `(state, ctx, registry) => (ctx.respondingTo ? [] : toolOnTargets(state, ctx.seatId, ctx.cardInstanceId, targetsOf(state, ctx.seatId, registry)))`.

In `projects/content/src/lib/registry.ts`, import the three cards from `'./cards/equipment/eight-trigrams'`, `'./cards/equipment/black-shield'` and `'./cards/equipment/wood-armor'`, and add them to `cards`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx jest`
Expected: PASS, every project. The sim's seeded games now meet Eight Trigrams asks. The rule-based bot answers Use (the first option); the random bot picks at random.

- [ ] **Step 8: Commit**

```bash
git add projects
git commit -m "feat(content): Eight Trigrams, Black Shield and Wood Armor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Gender; Gender Swords, Ancient Scimitar, Ice Sword, Longbow

**Files:**
- Data: `projects/content/data/generals/*/*.json` (57 files), `projects/content/data/generals/index.ts`, `scripts/restructure-content-data.py`
- Create:
  - `projects/content/src/lib/shared/gender.ts` (+`gender.spec.ts`)
  - `projects/content/src/lib/cards/equipment/gender-swords.ts`, `ancient-scimitar.ts`, `ice-sword.ts`, `longbow.ts`
- Modify:
  - Engine: `projects/engine/src/lib/registry/types.ts` (`GeneralDefinition.gender`).
  - Content: `shared/queries.ts` (`handOf`), `registry.ts`, `registry.spec.ts`, `modes/kingdomWar.spec.ts`, `cards/equipment/sha-equipment.spec.ts`.

**Interfaces:**
- Consumes: `shaData`, `shaStep` (Task 5). `ownerCard` (Task 6). `holdsAnyCard`, `seatCardOptions` (`shared/choices.ts`). `equipSlotOf` (`cards/equipment/index.ts`).
- Produces:

```ts
// engine GeneralDefinition gains gender?: 'male' | 'female'
export function seatGender(state: GameState, seatId: string, registry: ContentRegistry): 'male' | 'female' | null;
export function handOf(state: GameState, seatId: string): CardInstance[];
export const genderSwordsCard, ancientScimitarCard, iceSwordCard, longbowCard: CardDefinition;
// Gender Swords' target choice: options = each hand card (verb 'discard') + { id: 'decline' } (the user draws 1).
// Ice Sword's and Longbow's picks: PendingChoice with reason { kind: 'choice', card: <the weapon>, userSeatId, targetSeatId }.
```

- [ ] **Step 1: Gender data**

Run:

```bash
python3 - <<'EOF'
import glob, json
FEMALE = {'diao-chan', 'huang-yueying', 'zhen-ji', 'da-qiao', 'sun-shangxiang', 'xiao-qiao', 'zhu-rong', 'cai-wenji'}
for path in sorted(glob.glob('projects/content/data/generals/*/*.json')):
    general_id = path.rsplit('/', 1)[1][:-5]
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    data['gender'] = 'female' if general_id in FEMALE else 'male'
    data['source']['genderFrom'] = 'manual (standard character list)'
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2, sort_keys=True)
        f.write('\n')
EOF
git diff --stat projects/content/data/generals | tail -1
```

Expected: 57 files changed. Spot-check one file with `git diff`: it should add exactly the `"gender"` line and the `"genderFrom"` line. If the diff shows reformatting, match the files' existing formatting (key order, trailing newline) before going on.

In `projects/content/data/generals/index.ts`, add to `GeneralFileData`:

```ts
  gender: 'male' | 'female';
```

and add `genderFrom?: string` to its `source` type. Make the same two additions to the lines that write this interface in `scripts/restructure-content-data.py`, so a regeneration keeps them.

In `projects/engine/src/lib/registry/types.ts`, add to `GeneralDefinition`:

```ts
  // From the data; read through content's seatGender (Gender Swords).
  gender?: 'male' | 'female';
```

In `projects/content/src/lib/registry.ts`, `buildGenerals` pushes `gender: data.gender` with the other fields.

- [ ] **Step 2: Write the failing tests**

Create `projects/content/src/lib/shared/gender.spec.ts`:

```ts
import type { GameState } from 'engine';
import { buildContentRegistry } from '../registry';
import { seatGender } from './gender';

const registry = buildContentRegistry();
const withGenerals = (main: [string, boolean], deputy: [string, boolean]): GameState => ({
  seats: [{
    id: 'seat-a', index: 0, kingdom: 'Shu', eliminated: false, combinedHp: 3, maxCombinedHp: 3,
    generals: { main: { generalDefinitionId: main[0], revealed: main[1] }, deputy: { generalDefinitionId: deputy[0], revealed: deputy[1] } },
    hand: { zoneId: 'h' }, equipped: { zoneId: 'e' }, judgment: { zoneId: 'j' },
  }],
  players: [], turn: { turnNumber: 1, ownerSeatId: 'seat-a', extraTurnStack: [] }, phase: 'Play', zones: [],
  pendingResponse: null, log: [], rng: { seed: 1, counter: 0 }, result: null, generalSelection: null,
});

describe('seatGender', () => {
  it('is the Main General’s while the Main is revealed', () => {
    expect(seatGender(withGenerals(['huang-yueying', true], ['cao-cao', true]), 'seat-a', registry)).toBe('female');
  });

  it('else the Deputy’s while that is revealed', () => {
    expect(seatGender(withGenerals(['huang-yueying', false], ['cao-cao', true]), 'seat-a', registry)).toBe('male');
  });

  it('is none with both hidden', () => {
    expect(seatGender(withGenerals(['huang-yueying', false], ['cao-cao', false]), 'seat-a', registry)).toBeNull();
  });
});
```

Add to `projects/content/src/lib/registry.spec.ts`:

```ts
  it('gives every General a gender; eight are female', () => {
    const generals = [...buildContentRegistry().generals.values()];
    expect(generals.every((g) => g.gender === 'male' || g.gender === 'female')).toBe(true);
    expect(generals.filter((g) => g.gender === 'female').map((g) => g.id).sort()).toEqual(
      ['cai-wenji', 'da-qiao', 'diao-chan', 'huang-yueying', 'sun-shangxiang', 'xiao-qiao', 'zhen-ji', 'zhu-rong']
    );
  });
```

Add `'gender-swords', 'ancient-scimitar', 'ice-sword', 'longbow'` to the registry spec's expected card ids. In `kingdomWar.spec.ts`, change `toHaveLength(111)` to `toHaveLength(115)`.

Append to `projects/content/src/lib/cards/equipment/sha-equipment.spec.ts`:

```ts
describe('Gender Swords', () => {
  const swords = card('gs', 'gender-swords', 'spade', 2);
  const female: TableOptions['generals'] = { 'seat-b': ['huang-yueying', 'dong-zhuo'] };
  const attack = (more: Record<string, CardInstance[]> = {}, generals: TableOptions['generals'] = female) =>
    play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [swords], drawPile: [card('d1', 'peach')], ...more }, { generals }), 's1', 'seat-b');

  it('asks when the target’s gender differs', () => {
    expect(askedAbout(attack())).toBe('gender-swords');
  });

  it('doesn’t when it doesn’t, or when the target has no gender (both Generals hidden)', () => {
    expect(attack({}, {}).pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    const hidden = attack({}, { 'seat-b': ['huang-yueying', 'dong-zhuo', false] });
    expect(hidden.pendingChoice).toBeUndefined();
    expect(hidden.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('Use: the target discards a hand card of its choice, then the Sha goes on', () => {
    const s = use(attack({ 'seat-b:hand': [card('b1', 'peach')] }));
    expect(s.pendingChoice).toMatchObject({
      seatId: 'seat-b', verb: 'discard',
      reason: { kind: 'choice', card: { as: 'gender-swords' }, userSeatId: 'seat-a', targetSeatId: 'seat-b' },
      options: [{ id: 'b1' }, { id: 'decline', shows: { kind: 'decline' } }],
    });
    const after = choose(s, 'b1');
    expect(ids(after, 'discardPile')).toContain('b1');
    expect(after.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('…or lets the user draw 1', () => {
    const after = choose(use(attack({ 'seat-b:hand': [card('b1', 'peach')] })), 'decline');
    expect(ids(after, 'seat-a:hand')).toEqual(['d1']);
    expect(ids(after, 'seat-b:hand')).toEqual(['b1']);
    expect(after.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });

  it('a target with no hand cards must let the user draw', () => {
    const after = use(attack());
    expect(ids(after, 'seat-a:hand')).toEqual(['d1']);
    expect(after.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
  });
});

describe('Ancient Scimitar', () => {
  const scimitar = card('as', 'ancient-scimitar', 'spade', 1);
  const hit = (more: Record<string, CardInstance[]> = {}, o: TableOptions = {}) =>
    pass(play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [scimitar], ...more }, o), 's1', 'seat-b'));

  it('deals 1 extra damage to a target with no hand cards', () => {
    expect(hp(hit(), 'seat-b')).toBe(2);
  });

  it('none to a target holding a card', () => {
    expect(hp(hit({ 'seat-b:hand': [card('b1', 'peach')] }), 'seat-b')).toBe(3);
  });

  it('adds to Wine’s +1', () => {
    expect(hp(hit({}, { flags: { wine: true } }), 'seat-b')).toBe(1);
  });

  it('comes before Silver Lion’s cap, which brings it back to 1', () => {
    expect(hp(hit({ 'seat-b:equip': [card('sl', 'silver-lion', 'club', 1)] }), 'seat-b')).toBe(3);
  });
});

describe('Ice Sword', () => {
  const sword = card('is', 'ice-sword', 'spade', 2);
  const hitWith = (more: Record<string, CardInstance[]> = {}) => pass(play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [sword], ...more }), 's1', 'seat-b'));

  it('asks before the damage, when the target holds a card', () => {
    expect(askedAbout(hitWith({ 'seat-b:hand': [card('b1', 'peach')] }))).toBe('ice-sword');
  });

  it('isn’t asked when the target holds nothing', () => {
    expect(hp(hitWith(), 'seat-b')).toBe(3);
  });

  it('Use: no damage; the user discards 2 of the target’s cards, one pick at a time', () => {
    let s = use(hitWith({ 'seat-b:hand': [card('b1', 'peach')], 'seat-b:equip': [card('h1', 'di-lu', 'club', 5)] }));
    expect(s.pendingChoice).toMatchObject({ seatId: 'seat-a', verb: 'discard', reason: { kind: 'choice', card: { as: 'ice-sword' }, targetSeatId: 'seat-b' } });
    s = choose(s, 'h1');
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['hand']);
    s = choose(s, 'hand');
    expect(ids(s, 'discardPile')).toEqual(expect.arrayContaining(['h1', 'b1']));
    expect(hp(s, 'seat-b')).toBe(4);
    expect(s.log.some((e) => e.kind === 'DamageDealtEvent')).toBe(false);
  });

  it('a target with only 1 card loses just that one', () => {
    const s = choose(use(hitWith({ 'seat-b:hand': [card('b1', 'peach')] })), 'hand');
    expect(s.pendingChoice).toBeUndefined();
    expect(ids(s, 'seat-b:hand')).toEqual([]);
  });

  it('Don’t: the damage is dealt', () => {
    expect(hp(decline(hitWith({ 'seat-b:hand': [card('b1', 'peach')] })), 'seat-b')).toBe(3);
  });
});

describe('Longbow', () => {
  const bow = card('lb', 'longbow', 'heart', 5);
  const hitWith = (more: Record<string, CardInstance[]> = {}) => pass(play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [bow], ...more }), 's1', 'seat-b'));

  it('after damage, may discard the target’s only Mount', () => {
    const s = hitWith({ 'seat-b:equip': [card('h1', 'di-lu', 'club', 5)] });
    expect(hp(s, 'seat-b')).toBe(3);
    expect(askedAbout(s)).toBe('longbow');
    expect(ids(use(s), 'seat-b:equip')).toEqual([]);
  });

  it('the user picks which, of two Mounts', () => {
    let s = use(hitWith({ 'seat-b:equip': [card('h1', 'di-lu', 'club', 5), card('h2', 'red-hare', 'heart', 5)] }));
    expect(s.pendingChoice!.options.map((o) => o.id)).toEqual(['h1', 'h2']);
    s = choose(s, 'h2');
    expect(ids(s, 'seat-b:equip')).toEqual(['h1']);
  });

  it('isn’t asked without a Mount, or when the Sha is dodged', () => {
    expect(hitWith().pendingChoice).toBeUndefined();
    const dodged = respond(
      play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [bow], 'seat-b:hand': [card('d', 'shan')], 'seat-b:equip': [card('h1', 'di-lu')] }), 's1', 'seat-b'),
      'd'
    );
    expect(dodged.pendingChoice).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx jest projects/content`
Expected: FAIL. `seatGender` and the four cards don't exist.

- [ ] **Step 4: Queries**

Create `projects/content/src/lib/shared/gender.ts`:

```ts
import type { ContentRegistry, GameState } from 'engine';

// A seat's gender: its Main General's while the Main is revealed, else its
// Deputy's while that is revealed, else none (both hidden).
export function seatGender(state: GameState, seatId: string, registry: ContentRegistry): 'male' | 'female' | null {
  const generals = state.seats.find((s) => s.id === seatId)?.generals;
  if (!generals) return null;
  const shown = generals.main.revealed ? generals.main : generals.deputy.revealed ? generals.deputy : null;
  return (shown && registry.generals.get(shown.generalDefinitionId)?.gender) ?? null;
}
```

In `projects/content/src/lib/shared/queries.ts`, add (importing `CardInstance` as a type):

```ts
// The cards in `seatId`'s hand.
export function handOf(state: GameState, seatId: string): CardInstance[] {
  const seat = state.seats.find((s) => s.id === seatId);
  return (seat && state.zones.find((z) => z.id === seat.hand.zoneId)?.cards) ?? [];
}
```

- [ ] **Step 5: The four weapons**

Create `projects/content/src/lib/cards/equipment/gender-swords.ts`:

```ts
import type { AbilityOwner, Effect, GameState } from 'engine';
import { requireZoneOfKind, usedCardOf } from 'engine';
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { CardStep, actedOn, askAtStep, atStep } from '../../shared/steps';
import { seatGender } from '../../shared/gender';
import { handOf } from '../../shared/queries';
import { ownerCard } from '../../shared/abilities';

// The target's choice: discard one of its hand cards, or let the user draw 1.
// With no hand cards it must let the user draw.
function targetChooses(state: GameState, step: CardStep, owner: AbilityOwner): Effect[] {
  const draw: Effect = { kind: 'DrawCardsEffect', seatId: owner.seatId, count: 1 };
  const hand = handOf(state, step.target.seatId);
  const swords = ownerCard(state, owner);
  if (hand.length === 0 || !swords) return [draw];
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  return [
    {
      kind: 'OpenChoiceEffect',
      choice: {
        id: `gender-swords-${step.target.seatId}-${state.log.length}`,
        seatId: step.target.seatId,
        reason: { kind: 'choice', card: usedCardOf(swords), userSeatId: owner.seatId, targetSeatId: step.target.seatId },
        verb: 'discard',
        options: [
          ...hand.map((c) => ({
            id: c.instanceId,
            shows: { kind: 'card' as const, card: c },
            effects: [{ kind: 'MoveCardEffect' as const, cardInstanceId: c.instanceId, toZoneId: discardPileId }],
          })),
          { id: 'decline', shows: { kind: 'decline' as const }, effects: [draw] },
        ],
      },
    },
  ];
}

// Gender Swords: at step 1, when the target's gender differs from its user's,
// the user may make the target choose: discard a hand card, or let the user
// draw 1. A seat with no gender never differs.
export const genderSwordsCard = makeEquipmentCard('gender-swords', 'Gender Swords', 'weapon', cardsData['gender-swords'].range, {
  abilities: {
    triggers: [
      atStep(['sha-targeted'], {
        condition: (state, step, owner, registry) => {
          if (step.userSeatId !== owner.seatId) return false;
          const mine = seatGender(state, owner.seatId, registry);
          const theirs = seatGender(state, step.target.seatId, registry);
          return !!mine && !!theirs && mine !== theirs;
        },
        effect: (state, step, owner) => [askAtStep(owner, 'gender-swords', step, [...targetChooses(state, step, owner), actedOn(step, owner)])],
      }),
    ],
  },
});
```

Create `projects/content/src/lib/cards/equipment/ancient-scimitar.ts`:

```ts
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { actedOn, atStep } from '../../shared/steps';
import { handOf } from '../../shared/queries';
import { shaData } from '../sha';

// Ancient Scimitar: at step 5, its user's Sha deals 1 extra damage to a target
// with no hand cards. Added to the step, so Silver Lion's cap comes after it.
export const ancientScimitarCard = makeEquipmentCard('ancient-scimitar', 'Ancient Scimitar', 'weapon', cardsData['ancient-scimitar'].range, {
  abilities: {
    triggers: [
      atStep(['sha-damage'], {
        condition: (state, step, owner) => step.userSeatId === owner.seatId && handOf(state, step.target.seatId).length === 0,
        effect: (_state, step, owner) => [actedOn({ ...step, data: { ...step.data, extra: (shaData(step).extra ?? 0) + 1 } }, owner)],
      }),
    ],
  },
});
```

Create `projects/content/src/lib/cards/equipment/ice-sword.ts`:

```ts
import type { ChoiceOption, Effect, GameState, UsedCard } from 'engine';
import { requireZoneOfKind, usedCardOf } from 'engine';
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { actedOn, askAtStep, atStep } from '../../shared/steps';
import { holdsAnyCard, seatCardOptions } from '../../shared/choices';
import { ownerCard } from '../../shared/abilities';

// The options left once `taken` is picked: one card fewer in the hand, or that card gone.
function remainingAfter(options: ChoiceOption[], taken: ChoiceOption): ChoiceOption[] {
  return options.flatMap((o) => {
    if (o.id !== taken.id) return [o];
    if (o.shows.kind === 'hidden-hand' && o.shows.count > 1) return [{ ...o, shows: { ...o.shows, count: o.shows.count - 1 } }];
    return [];
  });
}

// Two discards from `targetSeatId`, one pick at a time, as Break picks (the
// hand face down, worn and judgment cards face up). One, if it has only one.
function discardTwo(state: GameState, userSeatId: string, targetSeatId: string, sword: UsedCard): Effect[] {
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  const first = seatCardOptions(state, targetSeatId, discardPileId);
  const choice = (id: string, options: ChoiceOption[]): Effect => ({
    kind: 'OpenChoiceEffect',
    choice: { id, seatId: userSeatId, reason: { kind: 'choice', card: sword, userSeatId, targetSeatId }, verb: 'discard', options },
  });
  const base = `ice-sword-${targetSeatId}-${state.log.length}`;
  const withSecond = first.map((option) => {
    const rest = remainingAfter(first, option);
    return { ...option, effects: [...option.effects, ...(rest.length > 0 ? [choice(`${base}-2-${option.id}`, rest)] : [])] };
  });
  return withSecond.length > 0 ? [choice(`${base}-1`, withSecond)] : [];
}

// Ice Sword: at step 5, its user may prevent the damage and instead discard 2
// of the target's cards. Only if the target holds a card.
export const iceSwordCard = makeEquipmentCard('ice-sword', 'Ice Sword', 'weapon', cardsData['ice-sword'].range, {
  abilities: {
    triggers: [
      atStep(['sha-damage'], {
        condition: (state, step, owner) => step.userSeatId === owner.seatId && holdsAnyCard(state, step.target.seatId),
        effect: (state, step, owner) => {
          const worn = ownerCard(state, owner);
          return worn ? [askAtStep(owner, 'ice-sword', step, discardTwo(state, owner.seatId, step.target.seatId, usedCardOf(worn)))] : [actedOn(step, owner)];
        },
      }),
    ],
  },
});
```

Create `projects/content/src/lib/cards/equipment/longbow.ts`:

```ts
import type { AbilityOwner, Effect, GameState } from 'engine';
import { requireZoneOfKind, usedCardOf } from 'engine';
import { cardsData } from '../../../../data/cards';
import { equipSlotOf, makeEquipmentCard } from './index';
import { CardStep, actedOn, askAtStep, atStep } from '../../shared/steps';
import { ownerCard } from '../../shared/abilities';

const mountsOf = (state: GameState, seatId: string) => {
  const seat = state.seats.find((s) => s.id === seatId);
  const worn = (seat && state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards) ?? [];
  return worn.filter((c) => equipSlotOf(c.definitionId) === 'defensiveMount' || equipSlotOf(c.definitionId) === 'offensiveMount');
};

// Discard one of the target's Mounts: the only one, or the user's pick of two.
function discardAMount(state: GameState, step: CardStep, owner: AbilityOwner): Effect[] {
  const discardPileId = requireZoneOfKind(state.zones, 'discardPile').id;
  const mounts = mountsOf(state, step.target.seatId);
  const bow = ownerCard(state, owner);
  if (mounts.length === 1 || !bow) return [{ kind: 'MoveCardEffect', cardInstanceId: mounts[0].instanceId, toZoneId: discardPileId }];
  return [
    {
      kind: 'OpenChoiceEffect',
      choice: {
        id: `longbow-${step.target.seatId}-${state.log.length}`,
        seatId: owner.seatId,
        reason: { kind: 'choice', card: usedCardOf(bow), userSeatId: owner.seatId, targetSeatId: step.target.seatId },
        verb: 'discard',
        options: mounts.map((m) => ({
          id: m.instanceId,
          shows: { kind: 'card' as const, card: m },
          effects: [{ kind: 'MoveCardEffect' as const, cardInstanceId: m.instanceId, toZoneId: discardPileId }],
        })),
      },
    },
  ];
}

// Longbow: at step 6, after its user's Sha damages a seat, the user may
// discard one of that seat's Mounts.
export const longbowCard = makeEquipmentCard('longbow', 'Longbow', 'weapon', cardsData['longbow'].range, {
  abilities: {
    triggers: [
      atStep(['sha-after-damage'], {
        condition: (state, step, owner) => step.userSeatId === owner.seatId && mountsOf(state, step.target.seatId).length > 0,
        effect: (state, step, owner) => [askAtStep(owner, 'longbow', step, [...discardAMount(state, step, owner), actedOn(step, owner)])],
      }),
    ],
  },
});
```

In `projects/content/src/lib/registry.ts`, import the four cards from their files and add them to `cards`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest`
Expected: PASS, every project.

- [ ] **Step 7: Commit**

```bash
git add projects scripts
git commit -m "feat(content): Generals' gender; Gender Swords, Ancient Scimitar, Ice Sword and Longbow

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Axe, Green Dragon Blade, Sky Scorcher, Serpent Spear

**Files:**
- Create: `projects/content/src/lib/cards/equipment/axe.ts`, `green-dragon-blade.ts`, `sky-scorcher.ts`, `serpent-spear.ts`
- Modify:
  - Content: `cards/equipment/index.ts` (Green Dragon Blade moves out), `cards/equipment/sha-equipment.spec.ts`, `registry.ts`, `registry.spec.ts`, `modes/kingdomWar.spec.ts`.
  - Content specs that import `greenDragonBladeCard` from `'./equipment'` (`equipment-abilities.spec.ts`, `tools.spec.ts`): change the import path to `'./equipment/green-dragon-blade'`.

**Interfaces:**
- Consumes: `OpenSelectionEffect` with `discard`, `use-card` and `card-step` continuations (Task 3). `Conversion` (Task 4). `shaStep`, `shaData` (Task 5). `actedOn`, `askAtStep`, `atStep`. `attackRange`, `seatDistance`, `handOf`.
- Produces: `axeCard`, `greenDragonBladeCard`, `skyScorcherCard`, `serpentSpearCard`. The selections' reasons are `{ kind: 'ability', owner, abilityId, targetSeatId? }`.

- [ ] **Step 1: Write the failing tests**

Append to `projects/content/src/lib/cards/equipment/sha-equipment.spec.ts`:

```ts
describe('Axe', () => {
  const axe = card('ax', 'axe', 'diamond', 5);
  const dodgedWith = (more: Record<string, CardInstance[]> = {}, o: TableOptions = {}) =>
    respond(
      play(table({ 'seat-a:hand': [card('s1', 'sha'), card('k1', 'peach'), card('k2', 'duel')], 'seat-a:equip': [axe], 'seat-b:hand': [card('d', 'shan')], ...more }, o), 's1', 'seat-b'),
      'd'
    );

  it('asks when the Sha is dodged and 2 other cards can be paid', () => {
    expect(askedAbout(dodgedWith())).toBe('axe');
  });

  it('Use: discard 2 cards from hand or equipment (never the Axe), and the Sha hits', () => {
    let s = use(dodgedWith({ 'seat-a:equip': [axe, card('h1', 'red-hare', 'heart', 5)] }));
    expect(s.pendingSelection).toMatchObject({ seatId: 'seat-a', of: 'cards', min: 2, max: 2, eligibleIds: ['k1', 'k2', 'h1'], reason: { abilityId: 'axe', targetSeatId: 'seat-b' } });
    s = select(s, 'k1', 'h1');
    expect(ids(s, 'discardPile')).toEqual(expect.arrayContaining(['k1', 'h1']));
    expect(hp(s, 'seat-b')).toBe(3);
  });

  it('isn’t asked with fewer than 2 other cards', () => {
    const s = respond(play(table({ 'seat-a:hand': [card('s1', 'sha'), card('k1', 'peach')], 'seat-a:equip': [axe], 'seat-b:hand': [card('d', 'shan')] }), 's1', 'seat-b'), 'd');
    expect(s.pendingChoice).toBeUndefined();
  });

  it('Don’t, or cancelling the discard, leaves the Sha dodged', () => {
    expect(hp(decline(dodgedWith()), 'seat-b')).toBe(4);
    const cancelled = cancel(use(dodgedWith()));
    expect(cancelled.pendingSelection).toBeUndefined();
    expect(cancelled.pendingChoice).toBeUndefined();
    expect(hp(cancelled, 'seat-b')).toBe(4);
  });

  it('discarding its wearer’s own Silver Lion heals the wearer', () => {
    const s = select(use(dodgedWith({ 'seat-a:equip': [axe, card('sl', 'silver-lion', 'club', 1)] }, { hp: { 'seat-a': 3 } })), 'k1', 'sl');
    expect(hp(s, 'seat-a')).toBe(4);
    expect(hp(s, 'seat-b')).toBe(3);
  });
});

describe('Green Dragon Blade', () => {
  const blade = card('gdb', 'green-dragon-blade', 'spade', 5);
  const dodgedWith = (more: Record<string, CardInstance[]> = {}, o: TableOptions = {}) =>
    respond(
      play(table({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha', 'heart')], 'seat-a:equip': [blade], 'seat-b:hand': [card('d', 'shan'), card('d2', 'shan')], ...more }, o), 's1', 'seat-b'),
      'd'
    );

  it('asks when the Sha is dodged and its user holds another Sha', () => {
    expect(askedAbout(dodgedWith())).toBe('green-dragon-blade');
  });

  it('Use: another Sha at the same target, uncounted, with Wine already spent', () => {
    let s = use(dodgedWith({}, { flags: { wine: true } }));
    expect(s.pendingSelection).toMatchObject({ of: 'cards', eligibleIds: ['s2'], min: 1, max: 1 });
    s = select(s, 's2');
    expect(s.turn.cardPlays).toEqual({ sha: 1 });
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    expect(hp(pass(s), 'seat-b')).toBe(3);
  });

  it('dodged again, it asks again (while a Sha is left)', () => {
    let s = select(use(dodgedWith({ 'seat-a:hand': [card('s1', 'sha'), card('s2', 'sha', 'heart'), card('s3', 'sha')] })), 's2');
    s = respond(s, 'd2');
    expect(askedAbout(s)).toBe('green-dragon-blade');
  });

  it('the follow-up gets its own armour check', () => {
    // The first Sha is red, so Black Shield lets it through to be dodged; the black follow-up is stopped.
    let s = respond(
      play(table({ 'seat-a:hand': [card('s1', 'sha', 'heart'), card('s2', 'sha', 'spade')], 'seat-a:equip': [blade], 'seat-b:hand': [card('d', 'shan')], 'seat-b:equip': [card('bs', 'black-shield', 'club', 2)] }), 's1', 'seat-b'),
      'd'
    );
    s = select(use(s), 's2');
    expect(abilityLog(s)).toMatchObject([{ abilityId: 'black-shield' }]);
  });

  it('isn’t asked without another Sha', () => {
    expect(respond(play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [blade], 'seat-b:hand': [card('d', 'shan')] }), 's1', 'seat-b'), 'd').pendingChoice).toBeUndefined();
  });
});

describe('Sky Scorcher', () => {
  const scorcher = card('sk', 'sky-scorcher', 'diamond', 12);
  const lastSha = () => play(table({ 'seat-a:hand': [card('s1', 'sha')], 'seat-a:equip': [scorcher] }), 's1', 'seat-d');

  it('asks when the Sha is its user’s last hand card', () => {
    expect(askedAbout(lastSha())).toBe('sky-scorcher');
  });

  it('isn’t asked when it isn’t', () => {
    expect(play(table({ 'seat-a:hand': [card('s1', 'sha'), card('k', 'peach')], 'seat-a:equip': [scorcher] }), 's1', 'seat-d').pendingChoice).toBeUndefined();
  });

  it('Use: up to 2 more targets in range; each is asked in seat order from the user', () => {
    let s = use(lastSha());
    expect(s.pendingSelection).toMatchObject({ of: 'seats', eligibleIds: ['seat-b', 'seat-c'], min: 1, max: 2 });
    s = select(s, 'seat-c', 'seat-b');
    expect(s.pendingResponse!.respondingSeatId).toBe('seat-b');
    s = pass(s);
    expect(s.pendingResponse!.respondingSeatId).toBe('seat-c');
    s = pass(s);
    expect(s.pendingResponse!.respondingSeatId).toBe('seat-d');
    s = pass(s);
    expect([hp(s, 'seat-b'), hp(s, 'seat-c'), hp(s, 'seat-d')]).toEqual([3, 3, 3]);
  });

  it('a target gone before its turn in the steps is skipped (Review Focus 2)', () => {
    let s = select(use(lastSha()), 'seat-b', 'seat-c');
    s = { ...s, seats: s.seats.map((x) => (x.id === 'seat-c' ? { ...x, eliminated: true } : x)) };
    s = pass(s); // seat-b
    expect(s.pendingResponse!.respondingSeatId).toBe('seat-d');
  });
});

describe('Serpent Spear', () => {
  const spear = card('sp', 'serpent-spear', 'spade', 12);
  const hand = [card('h1', 'peach', 'heart', 3), card('c1', 'duel', 'club', 4)];
  const conversions = (s: GameState, seatId = s.turn.ownerSeatId) => getLegalActions(s, seatId, registry).filter((a) => a.kind === 'UseConversionAction');
  const ownTurn = (s: GameState, seatId: string): GameState => ({ ...s, turn: { ...s.turn, ownerSeatId: seatId } });

  it('in the Play Phase: 2 hand cards as one Sha at a target in range; it has no colour, and it counts', () => {
    const t = table({ 'seat-a:hand': hand, 'seat-a:equip': [spear] });
    expect(conversions(t).map((a) => (a.kind === 'UseConversionAction' ? a.targets : []))).toEqual([[seat('seat-b')], [seat('seat-c')], [seat('seat-d')]]);
    let s = select(act(t, conversions(t)[0]), 'h1', 'c1');
    expect(s.log.find((e) => e.kind === 'CardPlayedEvent')).toMatchObject({ card: { as: 'sha', colour: 'none', physical: [{ instanceId: 'h1' }, { instanceId: 'c1' }] } });
    expect(s.turn.cardPlays).toEqual({ sha: 1 });
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['shan'] });
    s = pass(s);
    expect(hp(s, 'seat-b')).toBe(3);
  });

  it('a Sha with no colour still hits a Black Shield wearer (Review Focus 1)', () => {
    const t = table({ 'seat-a:hand': hand, 'seat-a:equip': [spear], 'seat-b:equip': [card('bs', 'black-shield', 'club', 2)] });
    const s = select(act(t, conversions(t)[0]), 'h1', 'c1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b' });
    expect(abilityLog(s)).toEqual([]);
  });

  it('answers a Duel with 2 hand cards: the Duel turns back', () => {
    let s = play(ownTurn(table({ 'seat-a:hand': hand, 'seat-a:equip': [spear], 'seat-b:hand': [card('du', 'duel')] }), 'seat-b'), 'du', 'seat-a');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-a', allowedCardIds: ['sha'] });
    s = select(act(s, conversions(s, 'seat-a')[0]), 'h1', 'c1');
    expect(s.pendingResponse).toMatchObject({ respondingSeatId: 'seat-b', allowedCardIds: ['sha'] });
  });

  it('answers Barbarians', () => {
    let s = play(ownTurn(table({ 'seat-a:hand': hand, 'seat-a:equip': [spear], 'seat-d:hand': [card('ba', 'barbarians')] }), 'seat-d'), 'ba');
    expect(s.pendingResponse!.respondingSeatId).toBe('seat-a');
    s = select(act(s, conversions(s, 'seat-a')[0]), 'h1', 'c1');
    expect(hp(s, 'seat-a')).toBe(4);
    expect(s.pendingResponse!.respondingSeatId).toBe('seat-b');
  });
});

describe('pausing on the new decisions (Review Focus 5)', () => {
  it('a game paused on an ask, or on a selection, survives a JSON round trip and resumes identically', () => {
    const asking = respond(
      play(table({ 'seat-a:hand': [card('s1', 'sha'), card('k1', 'peach'), card('k2', 'duel')], 'seat-a:equip': [card('ax', 'axe', 'diamond', 5)], 'seat-b:hand': [card('d', 'shan')] }), 's1', 'seat-b'),
      'd'
    );
    const roundTrip = (s: GameState) => JSON.parse(JSON.stringify(s)) as GameState;
    expect(use(roundTrip(asking))).toEqual(use(asking));
    const selecting = use(asking);
    expect(select(roundTrip(selecting), 'k1', 'k2')).toEqual(select(selecting, 'k1', 'k2'));
  });
});
```

In `projects/content/src/lib/registry.spec.ts`, add `'axe', 'sky-scorcher', 'serpent-spear'` to the expected ids. In `kingdomWar.spec.ts`, change `toHaveLength(115)` to `toHaveLength(118)`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/content`
Expected: FAIL. The four abilities don't exist yet; Green Dragon Blade has none.

- [ ] **Step 3: The four weapons**

In `projects/content/src/lib/cards/equipment/index.ts`, delete `greenDragonBladeCard` (it moves to its own file).

Create `projects/content/src/lib/cards/equipment/axe.ts`:

```ts
import type { AbilityOwner, GameState } from 'engine';
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { actedOn, askAtStep, atStep } from '../../shared/steps';
import { handOf } from '../../shared/queries';
import { shaStep } from '../sha';

// The cards Axe may discard: its wearer's hand and its other worn cards.
function axeCosts(state: GameState, owner: AbilityOwner): string[] {
  const seat = state.seats.find((s) => s.id === owner.seatId);
  const worn = (seat && state.zones.find((z) => z.id === seat.equipped.zoneId)?.cards) ?? [];
  const axeId = owner.kind === 'equipment' ? owner.cardInstanceId : '';
  return [...handOf(state, owner.seatId), ...worn].filter((c) => c.instanceId !== axeId).map((c) => c.instanceId);
}

// Axe: at step 4, when its user's Sha is dodged, the user may discard 2 other
// cards (hand or equipment) to make it hit anyway.
export const axeCard = makeEquipmentCard('axe', 'Axe', 'weapon', cardsData['axe'].range, {
  abilities: {
    triggers: [
      atStep(['sha-dodged'], {
        condition: (state, step, owner) => step.userSeatId === owner.seatId && axeCosts(state, owner).length >= 2,
        effect: (state, step, owner) => [
          askAtStep(owner, 'axe', step, [
            {
              kind: 'OpenSelectionEffect',
              selection: {
                id: `axe-${owner.seatId}-${state.log.length}`,
                seatId: owner.seatId,
                reason: { kind: 'ability', owner, abilityId: 'axe', targetSeatId: step.target.seatId },
                of: 'cards',
                eligibleIds: axeCosts(state, owner),
                min: 2,
                max: 2,
                then: { kind: 'discard', then: [shaStep(step, 'sha-hit')] },
                onCancel: [actedOn(step, owner)],
              },
            },
          ]),
        ],
      }),
    ],
  },
});
```

Create `projects/content/src/lib/cards/equipment/green-dragon-blade.ts`:

```ts
import type { GameState } from 'engine';
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { actedOn, askAtStep, atStep } from '../../shared/steps';
import { handOf } from '../../shared/queries';

const shasIn = (state: GameState, seatId: string) => handOf(state, seatId).filter((c) => c.definitionId === 'sha').map((c) => c.instanceId);

// Green Dragon Blade: at step 4, when its user's Sha is dodged, the user may
// play another Sha at the same target. It ignores range, doesn't count toward
// the limit, and starts at step 1 (so this can repeat).
export const greenDragonBladeCard = makeEquipmentCard('green-dragon-blade', 'Green Dragon Blade', 'weapon', cardsData['green-dragon-blade'].range, {
  abilities: {
    triggers: [
      atStep(['sha-dodged'], {
        condition: (state, step, owner) =>
          step.userSeatId === owner.seatId && shasIn(state, owner.seatId).length > 0 && state.seats.some((s) => s.id === step.target.seatId && !s.eliminated),
        effect: (state, step, owner) => [
          askAtStep(owner, 'green-dragon-blade', step, [
            {
              kind: 'OpenSelectionEffect',
              selection: {
                id: `green-dragon-blade-${owner.seatId}-${state.log.length}`,
                seatId: owner.seatId,
                reason: { kind: 'ability', owner, abilityId: 'green-dragon-blade', targetSeatId: step.target.seatId },
                of: 'cards',
                eligibleIds: shasIn(state, owner.seatId),
                min: 1,
                max: 1,
                then: { kind: 'use-card', targets: [step.target], counted: false, free: true },
                onCancel: [actedOn(step, owner)],
              },
            },
          ]),
        ],
      }),
    ],
  },
});
```

Create `projects/content/src/lib/cards/equipment/sky-scorcher.ts`:

```ts
import type { ContentRegistry, GameState } from 'engine';
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';
import { CardStep, actedOn, askAtStep, atStep } from '../../shared/steps';
import { attackRange, seatDistance } from '../../shared/queries';
import { shaData } from '../sha';

// Living seats other than the user and the Sha's target, within the user's attack range, in seat order.
function extraTargets(state: GameState, step: CardStep, registry: ContentRegistry): string[] {
  const range = attackRange(state, step.userSeatId, registry);
  return [...state.seats]
    .sort((a, b) => a.index - b.index)
    .filter((s) => !s.eliminated && s.id !== step.userSeatId && s.id !== step.target.seatId && seatDistance(state, step.userSeatId, s.id, registry) <= range)
    .map((s) => s.id);
}

// Sky Scorcher: when its user plays their last hand card as a Sha in their
// Play Phase, they may add up to 2 more targets within attack range. Each
// target then goes through the steps on its own, in seat order from the user.
export const skyScorcherCard = makeEquipmentCard('sky-scorcher', 'Sky Scorcher', 'weapon', cardsData['sky-scorcher'].range, {
  abilities: {
    triggers: [
      atStep(['sha-use'], {
        condition: (state, step, owner, registry) =>
          step.userSeatId === owner.seatId && shaData(step).lastHandCard === true && extraTargets(state, step, registry).length > 0,
        effect: (state, step, owner, registry) => [
          askAtStep(
            owner,
            'sky-scorcher',
            step,
            [
              {
                kind: 'OpenSelectionEffect',
                selection: {
                  id: `sky-scorcher-${owner.seatId}-${state.log.length}`,
                  seatId: owner.seatId,
                  reason: { kind: 'ability', owner, abilityId: 'sky-scorcher' },
                  of: 'seats',
                  eligibleIds: extraTargets(state, step, registry),
                  min: 1,
                  max: 2,
                  then: { kind: 'card-step', step: actedOn(step, owner) },
                  onCancel: [actedOn(step, owner)],
                },
              },
            ],
            null
          ),
        ],
      }),
    ],
  },
});
```

Create `projects/content/src/lib/cards/equipment/serpent-spear.ts`:

```ts
import { cardsData } from '../../../../data/cards';
import { makeEquipmentCard } from './index';

// Serpent Spear: whenever its wearer could play or use a Sha, 2 hand cards may
// be used as one Sha (Play Phase, Duel, Barbarians, Coerce). Its colour comes
// from the two cards; in the Play Phase it counts toward the limit.
export const serpentSpearCard = makeEquipmentCard('serpent-spear', 'Serpent Spear', 'weapon', cardsData['serpent-spear'].range, {
  abilities: { conversions: [{ id: 'serpent-spear', as: 'sha', cards: 2, when: 'both' }] },
});
```

In `projects/content/src/lib/registry.ts`:
- Import `greenDragonBladeCard` from `'./cards/equipment/green-dragon-blade'` instead of `'./cards/equipment'`.
- Import and add `axeCard`, `skyScorcherCard` and `serpentSpearCard`.

Fix the specs that import `greenDragonBladeCard` from `'./equipment'` to import it from `'./equipment/green-dragon-blade'`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest`
Expected: PASS, every project, the sim's seeded games included.

- [ ] **Step 5: Commit**

```bash
git add projects
git commit -m "feat(content): Axe, Green Dragon Blade, Sky Scorcher and Serpent Spear

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Bots — the spec's rules for asks, selections and Serpent Spear

**Files:**
- Modify: `projects/bots/src/lib/rule-based.ts` (+spec)

**Interfaces:**
- Consumes:
  - Asks: `PendingChoice` with `reason.kind === 'ability'` and options `use`/`decline`.
  - Gender Swords' choice: `reason.kind === 'choice'` with the chooser as `targetSeatId`, plus a `decline` option.
  - `PendingSelection`; `UseConversionAction`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing tests**

Add to `projects/bots/src/lib/rule-based.spec.ts`:
- Import `PendingChoice` and `PendingSelection` if not yet.
- Add `card('gender-swords', 'equipment', 'weapon')` to the registry's cards.
- Add:

```ts
describe('optional abilities', () => {
  const ask = (abilityId: string, targetSeatId?: string): PendingChoice => ({
    id: 'ask', seatId: 'seat-0', verb: 'use',
    reason: { kind: 'ability', owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'eq-0' }, abilityId, ...(targetSeatId ? { targetSeatId } : {}) },
    options: [{ id: 'use', shows: { kind: 'use' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
  });
  const asked: Action[] = ['use', 'decline'].map((optionId) => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId }));
  // seat-1 is an ally (Wei, revealed); seat-2 is not.
  const seats = [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'Wei', 6), seat('seat-2', 2, 'hidden', 3)];
  const answer = (choice: PendingChoice, zones: CardZone[] = []) => {
    const action = ruleBasedPolicy.decide(view({ seats, pendingChoice: choice, zones }), 'seat-0', asked, registry, null).action;
    return action.kind === 'ChooseOptionAction' ? action.optionId : action.kind;
  };

  it('always uses Eight Trigrams, Longbow, Gender Swords, Sky Scorcher and Green Dragon Blade', () => {
    for (const id of ['eight-trigrams', 'longbow', 'gender-swords', 'sky-scorcher', 'green-dragon-blade']) {
      expect(answer(ask(id, 'seat-1'))).toBe('use');
    }
  });

  it('uses Axe only against a non-ally', () => {
    expect(answer(ask('axe', 'seat-2'))).toBe('use');
    expect(answer(ask('axe', 'seat-1'))).toBe('decline');
  });

  it('uses Ice Sword only on a non-ally above 1 HP who wears equipment', () => {
    const worn = (seatId: string): CardZone => ({ id: `${seatId}:equip`, kind: 'equip', ownerSeatId: seatId, cards: [{ instanceId: 'w', definitionId: 'blade', suit: 'club', rank: 2 }] });
    expect(answer(ask('ice-sword', 'seat-2'), [worn('seat-2')])).toBe('use');
    expect(answer(ask('ice-sword', 'seat-2'))).toBe('decline'); // wears nothing
    expect(answer(ask('ice-sword', 'seat-1'), [worn('seat-1')])).toBe('decline'); // an ally
    const lowSeats = [seats[0], seats[1], seat('seat-2', 2, 'hidden', 1)];
    const low = ruleBasedPolicy.decide(view({ seats: lowSeats, pendingChoice: ask('ice-sword', 'seat-2'), zones: [worn('seat-2')] }), 'seat-0', asked, registry, null).action;
    expect(low).toMatchObject({ optionId: 'decline' }); // at 1 HP the damage would do more
  });

  it('declines an ability it has no rule for', () => {
    expect(answer(ask('something-new', 'seat-2'))).toBe('decline');
  });

  it('as Gender Swords’ target: discards its least useful card when holding more than 2, else lets them draw', () => {
    const choiceFor = (hand: string[]): PendingChoice => ({
      id: 'gs', seatId: 'seat-0', verb: 'discard',
      reason: { kind: 'choice', card: { as: 'gender-swords', colour: 'black', physical: [] }, userSeatId: 'seat-2', targetSeatId: 'seat-0' },
      options: [
        ...hand.map((id) => ({ id, shows: { kind: 'card' as const, card: { instanceId: id, definitionId: id.split('-')[0], suit: 'spade' as const, rank: 1 } }, effects: [] })),
        { id: 'decline', shows: { kind: 'decline' }, effects: [] },
      ],
    });
    const pick = (hand: string[]) => {
      const legal: Action[] = [...hand, 'decline'].map((optionId) => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'gs', optionId }));
      const cards = hand.map((id) => ({ instanceId: id, definitionId: id.split('-')[0] }));
      return ruleBasedPolicy.decide(view({ hand: cards, pendingChoice: choiceFor(hand) }), 'seat-0', legal, registry, null).action;
    };
    expect(pick(['peach-1', 'duel-1', 'sha-1'])).toMatchObject({ optionId: 'duel-1' });
    expect(pick(['peach-1', 'duel-1'])).toMatchObject({ optionId: 'decline' });
  });
});

describe('ability selections', () => {
  const template: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's1', ids: [] };
  const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's1' };
  const sel = (abilityId: string, over: Partial<PendingSelection> = {}): PendingSelection => ({
    id: 's1', seatId: 'seat-0', reason: { kind: 'ability', owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'eq-0' }, abilityId },
    of: 'cards', eligibleIds: [], min: 2, max: 2, then: { kind: 'discard' }, onCancel: [], ...over,
  });

  it('Axe: discards the 2 least useful cards', () => {
    const hand = [{ instanceId: 'p1', definitionId: 'peach' }, { instanceId: 's1', definitionId: 'sha' }, { instanceId: 'x1', definitionId: 'duel' }];
    const { action } = ruleBasedPolicy.decide(view({ hand, pendingSelection: sel('axe', { eligibleIds: ['p1', 's1', 'x1'] }) }), 'seat-0', [template, cancel], registry, null);
    expect(action).toEqual({ ...template, ids: ['x1', 's1'] });
  });

  it('Sky Scorcher: only non-allies as extra targets; with none, cancels', () => {
    const seats = [seat('seat-0', 0, 'Wei', 8), seat('seat-1', 1, 'Wei', 6), seat('seat-2', 2, 'hidden', 3)];
    const seatSel = (eligibleIds: string[]) => sel('sky-scorcher', { of: 'seats', eligibleIds, min: 1, max: 2, then: { kind: 'card-step', step: { kind: 'CardStepEffect', step: 'sha-use', card: { as: 'sha', colour: 'black', physical: [] }, userSeatId: 'seat-0', target: { kind: 'seat', seatId: 'seat-2' } } } });
    expect(ruleBasedPolicy.decide(view({ seats, pendingSelection: seatSel(['seat-1', 'seat-2']) }), 'seat-0', [template, cancel], registry, null).action).toEqual({ ...template, ids: ['seat-2'] });
    expect(ruleBasedPolicy.decide(view({ seats, pendingSelection: seatSel(['seat-1']) }), 'seat-0', [template, cancel], registry, null).action).toEqual(cancel);
  });
});

describe('Serpent Spear', () => {
  const via = { owner: { kind: 'equipment' as const, seatId: 'seat-0', cardInstanceId: 'eq-0' }, conversionId: 'serpent-spear' };
  const pass: Action = { kind: 'PassAction', seatId: 'seat-0', pendingResponseId: 'r1' };
  const convertAnswer: Action = { kind: 'UseConversionAction', seatId: 'seat-0', via, targets: [], pendingResponseId: 'r1' };
  const barbarians: DecisionReason = { kind: 'card-effect', card: { as: 'barbarians', colour: 'black', physical: [] }, userSeatId: 'seat-2' };

  it('answers with 2 cards only with no real answer, and not when a Peach would go', () => {
    const cheap = [{ instanceId: 'x1', definitionId: 'duel' }, { instanceId: 'x2', definitionId: 'draw-two' }];
    expect(ruleBasedPolicy.decide(view({ hand: cheap, pendingFor: 'seat-0', pendingReason: barbarians }), 'seat-0', [pass, convertAnswer], registry, null).action).toEqual(convertAnswer);
    const dear = [{ instanceId: 'p1', definitionId: 'peach' }, { instanceId: 'x1', definitionId: 'duel' }];
    expect(ruleBasedPolicy.decide(view({ hand: dear, pendingFor: 'seat-0', pendingReason: barbarians }), 'seat-0', [pass, convertAnswer], registry, null).action).toEqual(pass);
    const realSha: Action = { kind: 'RespondAction', seatId: 'seat-0', pendingResponseId: 'r1', cardInstanceId: 's1' };
    const withSha = [...cheap, { instanceId: 's1', definitionId: 'sha' }];
    expect(ruleBasedPolicy.decide(view({ hand: withSha, pendingFor: 'seat-0', pendingReason: barbarians }), 'seat-0', [pass, realSha, convertAnswer], registry, null).action).toEqual(realSha);
  });

  it('in the Play Phase, converts only with no real Sha, at the weakest non-ally', () => {
    const cheap = [{ instanceId: 'x1', definitionId: 'duel' }, { instanceId: 'x2', definitionId: 'wuxie' }];
    const at = (seatId: string): Action => ({ kind: 'UseConversionAction', seatId: 'seat-0', via, targets: [{ kind: 'seat', seatId }] });
    expect(ruleBasedPolicy.decide(view({ hand: cheap }), 'seat-0', [end, at('seat-1'), at('seat-2')], registry, null).action).toEqual(at('seat-2'));
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/bots`
Expected: FAIL. The bot answers every ask with its first option and ignores conversions.

- [ ] **Step 3: Implement**

In `projects/bots/src/lib/rule-based.ts`:
- Add `type UseConversion = Extract<Action, { kind: 'UseConversionAction' }>;`.
- Add above `decide`:

```ts
// Instance ids, least useful first (then lowest rank).
function leastUseful(view: GameState, registry: ContentRegistry, ids: readonly string[]): string[] {
  return [...ids].sort((a, b) => keepRank(view, registry, a) - keepRank(view, registry, b));
}

// Whether to use an optional ability (the Sha-Equipment spec's bot rules).
function wantsToUse(view: GameState, self: Seat, abilityId: string, targetSeatId: string | undefined): boolean {
  const target = view.seats.find((s) => s.id === targetSeatId);
  const hostile = !!target && !isAlly(self, target);
  switch (abilityId) {
    case 'eight-trigrams':
    case 'longbow':
    case 'gender-swords':
    case 'sky-scorcher':
    case 'green-dragon-blade':
      return true;
    case 'axe':
      return hostile;
    case 'ice-sword': {
      const wears = !!target && (view.zones.find((z) => z.id === target.equipped.zoneId)?.cards.length ?? 0) > 0;
      return hostile && !!target && target.combinedHp > 1 && wears;
    }
    default:
      return false;
  }
}

// Abilities whose card selections the bot fills rather than cancels.
const SELECTS_FOR = new Set(['axe', 'green-dragon-blade', 'serpent-spear']);

// Serpent Spear is worth it when the 2 least useful hand cards hold no Peach.
function spareForConversion(view: GameState, self: Seat, registry: ContentRegistry): boolean {
  const hand = (view.zones.find((z) => z.id === self.hand.zoneId)?.cards ?? []).map((c) => c.instanceId);
  return hand.length >= 2 && !leastUseful(view, registry, hand).slice(0, 2).some((id) => definitionIdOf(view, id) === 'peach');
}
```

- In `decide`, add `const me = view.seats.find((s) => s.id === seatId);` after `take`.
- Replace step 1a (Task 3's generic selection) with:

```ts
  // 1a. A selection. Sky Scorcher's seats: non-allies only, else cancel. Cards
  // for Axe, Green Dragon Blade, Serpent Spear: the least useful. Anything
  // else: cancel when allowed.
  const selectTemplate = legal.find((a): a is Select => a.kind === 'SelectAction');
  if (selectTemplate && view.pendingSelection && me) {
    const selection = view.pendingSelection;
    const cancel = legal.find((a) => a.kind === 'CancelSelectionAction');
    if (selection.of === 'seats') {
      const ids = selection.eligibleIds
        .filter((id) => {
          const other = view.seats.find((s) => s.id === id);
          return !!other && !isAlly(me, other);
        })
        .slice(0, selection.max);
      if (ids.length >= selection.min) return take({ ...selectTemplate, ids });
      if (cancel) return take(cancel);
    }
    const known = selection.reason.kind === 'ability' && SELECTS_FOR.has(selection.reason.abilityId);
    if (cancel && !known) return take(cancel);
    return take({ ...selectTemplate, ids: leastUseful(view, registry, selection.eligibleIds).slice(0, selection.min) });
  }
```

- Before step 1b (the picks branch), add:

```ts
  // 1a'. An ability's ask; Gender Swords' choice for its target.
  const choiceNow = view.pendingChoice;
  const choiceActions = legal.filter((a): a is ChooseOption => a.kind === 'ChooseOptionAction');
  if (choiceNow && me && choiceActions.length > 0) {
    if (choiceNow.reason.kind === 'ability') {
      const optionId = wantsToUse(view, me, choiceNow.reason.abilityId, choiceNow.reason.targetSeatId) ? 'use' : 'decline';
      const pick = choiceActions.find((a) => a.optionId === optionId);
      if (pick) return take(pick);
    }
    const decline = choiceActions.find((a) => a.optionId === 'decline');
    if (decline && choiceNow.reason.kind === 'choice' && choiceNow.reason.targetSeatId === seatId) {
      const handSize = view.zones.find((z) => z.id === me.hand.zoneId)?.cards.length ?? 0;
      const discards = choiceActions.filter((a) => a !== decline);
      if (handSize <= 2 || discards.length === 0) return take(decline);
      return take(discards.reduce((best, a) => (keepRank(view, registry, a.optionId) < keepRank(view, registry, best.optionId) ? a : best)));
    }
  }
```

- In step 2 (responding), replace the two lines that pick `best` and `answer` with:

```ts
    // A Peach before anything else (a dying bot drinks Wine only without one).
    const best = answers.find((a) => definitionIdOf(view, a.cardInstanceId) === 'peach') ?? answers[0];
    // Serpent Spear: only with no real answer, and no Peach among the 2 cards it would take.
    const converted = legal.find((a): a is UseConversion => a.kind === 'UseConversionAction');
    const chosen = best ?? (converted && self && spareForConversion(view, self, registry) ? converted : undefined);
    const answer = (worthAnswering ? chosen : undefined) ?? legal.find((a) => a.kind === 'PassAction');
```

- In step 5, right after `if (sha) return take(sha, 1);`, add:

```ts
    // Serpent Spear: with no real Sha, 2 cards as one at the weakest non-ally.
    const [conversion] = legal
      .filter((a): a is UseConversion => a.kind === 'UseConversionAction' && a.targets.length === 1)
      .map((a) => ({ a, target: view.seats.find((s) => s.id === a.targets[0].seatId) }))
      .filter((t): t is { a: UseConversion; target: Seat } => !!t.target && !t.target.eliminated && !isAlly(self, t.target))
      .sort((x, y) => x.target.combinedHp - y.target.combinedHp || x.target.index - y.target.index)
      .map((t) => t.a);
    if (conversion && spareForConversion(view, self, registry)) return take(conversion, 1);
```

Move step 1b's `const picks = …` line below the new block if its name clashes. The new block uses `choiceActions`, so it shouldn't.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest projects/bots projects/sim`
Expected: PASS. The sim's rule-based games now use every new card by these rules.

- [ ] **Step 5: Commit**

```bash
git add projects/bots
git commit -m "feat(bots): asks, selections and Serpent Spear by the Sha-Equipment rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: App — the Ask and Selection windows

**Files:**
- Create in `projects/app/src/app/game-board/`: `ability-description.ts`, `ask-dialog.ts`, `selection-dialog.ts`, each with a spec.
- Modify:
  - Content: `projects/content/src/lib/display.ts` (+spec): `abilityHint`.
  - App: `game-board/game-board.ts`, `game-board/response-description.ts` (`waitingLine`, +spec).

**Interfaces:**
- Consumes: `PendingChoice` asks (verb `use`, reason `ability`), `PendingSelection`, `SelectAction`/`CancelSelectionAction`.
- Produces:

```ts
// content display.ts
export function abilityHint(abilityId: string): string | null; // '{target}' stands for the aimed-at seat
// ability-description.ts
export interface AskDescription { title: string; prompt: string; hint: string | null; card: CardInstance | null; use: Action; decline: Action }
export function describeAsk(state: GameState, viewerSeatId: string, legal: readonly Action[]): AskDescription | null;
export interface SelectionItem { id: string; card?: CardInstance; label: string }
export interface SelectionDescription {
  title: string; prompt: string; confirmLabel: string; min: number; max: number;
  items: SelectionItem[]; template: Extract<Action, { kind: 'SelectAction' }>; cancel: Action | null;
}
export function describeSelection(state: GameState, viewerSeatId: string, legal: readonly Action[]): SelectionDescription | null;
// ask-dialog.ts: AskDialog, data { description: AskDescription }, closes with the chosen action
// selection-dialog.ts: SelectionDialog, data { description: SelectionDescription; pickedChanged?(action) }, closes with SelectAction (ids filled) or the cancel action
```

- [ ] **Step 1: Write the failing tests**

Add to `projects/content/src/lib/display.spec.ts`:

```ts
describe('abilityHint', () => {
  it('says what an ability does, in the game’s own words', () => {
    expect(abilityHint('axe')).toBe('Discard 2 cards to make your Sha hit {target}');
    expect(abilityHint('eight-trigrams')).toBe('Judge: on red, it counts as a Shan');
    expect(abilityHint('sha')).toBeNull();
  });
});
```

Create `projects/app/src/app/game-board/ability-description.spec.ts`:

```ts
import { Action, CardInstance, GameState, PendingChoice, PendingSelection } from 'engine';
import { describeAsk, describeSelection } from './ability-description';

const axe: CardInstance = { instanceId: 'ax', definitionId: 'axe', suit: 'diamond', rank: 5 };
const peach: CardInstance = { instanceId: 'p1', definitionId: 'peach', suit: 'heart', rank: 3 };
const sha: CardInstance = { instanceId: 's2', definitionId: 'sha', suit: 'spade', rank: 7 };
const owner = { kind: 'equipment' as const, seatId: 'seat-0', cardInstanceId: 'ax' };

function state(o: { pendingChoice?: PendingChoice; pendingSelection?: PendingSelection } = {}): GameState {
  return {
    seats: [], log: [], pendingResponse: null, result: null, generalSelection: null, phase: 'Play',
    players: [
      { id: 'p0', seatId: 'seat-0', kind: 'human', name: 'Hing' },
      { id: 'p1', seatId: 'seat-1', kind: 'bot', name: 'Seat 1' },
      { id: 'p2', seatId: 'seat-2', kind: 'bot', name: 'Seat 2' },
    ],
    zones: [
      { id: 'seat-0:hand', kind: 'hand', ownerSeatId: 'seat-0', cards: [peach, sha] },
      { id: 'seat-0:equip', kind: 'equip', ownerSeatId: 'seat-0', cards: [axe] },
    ],
    turn: { turnNumber: 1, ownerSeatId: 'seat-0', extraTurnStack: [] }, rng: { seed: 1, counter: 0 },
    ...o,
  };
}
const ask = (abilityId: string, targetSeatId?: string): PendingChoice => ({
  id: 'ask', seatId: 'seat-0', verb: 'use',
  reason: { kind: 'ability', owner, abilityId, ...(targetSeatId ? { targetSeatId } : {}) },
  options: [{ id: 'use', shows: { kind: 'use' }, effects: [] }, { id: 'decline', shows: { kind: 'decline' }, effects: [] }],
});
const asked: Action[] = ['use', 'decline'].map((optionId) => ({ kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId }));

describe('describeAsk', () => {
  it('names the ability and its target, says what it does, and shows the worn card', () => {
    expect(describeAsk(state({ pendingChoice: ask('axe', 'seat-1') }), 'seat-0', asked)).toEqual({
      title: 'Axe',
      prompt: 'Use Axe on Seat 1?',
      hint: 'Discard 2 cards to make your Sha hit Seat 1',
      card: axe,
      use: asked[0],
      decline: asked[1],
    });
  });

  it('leaves out a target that is the viewer', () => {
    expect(describeAsk(state({ pendingChoice: ask('eight-trigrams', 'seat-0') }), 'seat-0', asked)).toMatchObject({ prompt: 'Use Eight Trigrams?' });
  });

  it('is null for another seat’s ask, or for a choice that isn’t an ask', () => {
    expect(describeAsk(state({ pendingChoice: ask('axe') }), 'seat-1', asked)).toBeNull();
    expect(describeAsk(state({ pendingChoice: { ...ask('axe'), verb: 'discard', reason: { kind: 'choice', card: { as: 'break', colour: 'black', physical: [] }, userSeatId: 'seat-0' } } }), 'seat-0', asked)).toBeNull();
  });
});

describe('describeSelection', () => {
  const template: Action = { kind: 'SelectAction', seatId: 'seat-0', selectionId: 's1', ids: [] };
  const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's1' };
  const selection = (abilityId: string, over: Partial<PendingSelection>): PendingSelection => ({
    id: 's1', seatId: 'seat-0', reason: { kind: 'ability', owner, abilityId }, of: 'cards', eligibleIds: [], min: 2, max: 2, then: { kind: 'discard' }, ...over,
  });
  const describe2 = (sel: PendingSelection, legal: Action[] = [template, cancel]) => describeSelection(state({ pendingSelection: sel }), 'seat-0', legal);

  it('Axe: choose 2 cards to discard, shown face up, with Cancel', () => {
    expect(describe2(selection('axe', { eligibleIds: ['p1', 's2'] }))).toEqual({
      title: 'Axe', prompt: 'Choose 2 cards to discard', confirmLabel: 'Discard', min: 2, max: 2,
      items: [{ id: 'p1', card: peach, label: 'Peach (3 ♥)' }, { id: 's2', card: sha, label: 'Sha (7 ♠)' }],
      template, cancel,
    });
  });

  it('Serpent Spear: 2 hand cards to use as Sha', () => {
    const sel = selection('serpent-spear', { eligibleIds: ['p1', 's2'], then: { kind: 'use-card', as: 'sha', targets: [], counted: true } });
    expect(describe2(sel)).toMatchObject({ title: 'Serpent Spear', prompt: 'Choose 2 hand cards to use as Sha', confirmLabel: 'Use' });
  });

  it('Green Dragon Blade: a Sha to play at its target', () => {
    const sel = selection('green-dragon-blade', { eligibleIds: ['s2'], min: 1, max: 1, then: { kind: 'use-card', targets: [{ kind: 'seat', seatId: 'seat-1' }], counted: false, free: true } });
    expect(describe2(sel)).toMatchObject({ prompt: 'Choose a Sha to play at Seat 1', confirmLabel: 'Use' });
  });

  it('Sky Scorcher: up to 2 more targets, by name', () => {
    const step = { kind: 'CardStepEffect' as const, step: 'sha-use', card: { as: 'sha', colour: 'black' as const, physical: [] }, userSeatId: 'seat-0', target: { kind: 'seat' as const, seatId: 'seat-1' } };
    const sel = selection('sky-scorcher', { of: 'seats', eligibleIds: ['seat-2'], min: 1, max: 2, then: { kind: 'card-step', step } });
    expect(describe2(sel)).toMatchObject({ prompt: 'Choose up to 2 more targets', confirmLabel: 'Add Targets', items: [{ id: 'seat-2', label: 'Seat 2' }] });
  });

  it('has no Cancel when the engine offers none, and is null for another seat', () => {
    expect(describe2(selection('axe', { eligibleIds: ['p1', 's2'] }), [template])?.cancel).toBeNull();
    expect(describeSelection(state({ pendingSelection: selection('axe', {}) }), 'seat-1', [])).toBeNull();
  });
});
```

Create `projects/app/src/app/game-board/ask-dialog.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Action } from 'engine';
import { AskDialog, AskDialogData } from './ask-dialog';

const use: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId: 'use' };
const decline: Action = { kind: 'ChooseOptionAction', seatId: 'seat-0', choiceId: 'ask', optionId: 'decline' };

function render() {
  const close = jest.fn();
  TestBed.configureTestingModule({
    providers: [
      {
        provide: MAT_DIALOG_DATA,
        useValue: {
          description: { title: 'Axe', prompt: 'Use Axe on Seat 1?', hint: 'Discard 2 cards to make your Sha hit Seat 1', card: { instanceId: 'ax', definitionId: 'axe', suit: 'diamond', rank: 5 }, use, decline },
        } satisfies AskDialogData,
      },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(AskDialog);
  fixture.detectChanges();
  return { el: fixture.nativeElement as HTMLElement, close };
}

describe('AskDialog', () => {
  it('shows the ability, the question, what it does, and the worn card', () => {
    const { el } = render();
    expect(el.querySelector('h2')!.textContent).toContain('Axe');
    expect(el.querySelector('.prompt')!.textContent).toContain('Use Axe on Seat 1?');
    expect(el.querySelector('.hint')!.textContent).toContain('Discard 2 cards to make your Sha hit Seat 1');
    expect(el.querySelector('app-playing-card')).not.toBeNull();
  });

  it('closes with Use or Don’t', () => {
    const { el, close } = render();
    (el.querySelector('button.use') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledWith(use);
    expect(el.querySelector('button.decline')!.textContent!.trim()).toBe("Don't");
    (el.querySelector('button.decline') as HTMLButtonElement).click();
    expect(close).toHaveBeenCalledWith(decline);
  });
});
```

Create `projects/app/src/app/game-board/selection-dialog.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Action, CardInstance } from 'engine';
import { SelectionDialog, SelectionDialogData } from './selection-dialog';
import { SelectionDescription } from './ability-description';

const template = { kind: 'SelectAction' as const, seatId: 'seat-0', selectionId: 's1', ids: [] };
const cancel: Action = { kind: 'CancelSelectionAction', seatId: 'seat-0', selectionId: 's1' };
const c = (instanceId: string): CardInstance => ({ instanceId, definitionId: 'sha', suit: 'spade', rank: 7 });

function render(over: Partial<SelectionDescription> = {}) {
  const close = jest.fn();
  const description: SelectionDescription = {
    title: 'Axe', prompt: 'Choose 2 cards to discard', confirmLabel: 'Discard', min: 2, max: 2,
    items: [{ id: 'a', card: c('a'), label: 'Sha (7 ♠)' }, { id: 'b', card: c('b'), label: 'Sha (7 ♠)' }, { id: 'x', card: c('x'), label: 'Sha (7 ♠)' }],
    template, cancel, ...over,
  };
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: { description } satisfies SelectionDialogData },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(SelectionDialog);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const click = (selector: string) => {
    (el.querySelector(selector) as HTMLButtonElement).click();
    fixture.detectChanges();
  };
  return { el, click, close };
}

describe('SelectionDialog', () => {
  it('confirms only once between min and max are picked, with the picked ids', () => {
    const { el, click, close } = render();
    const confirm = () => el.querySelector('button.confirm') as HTMLButtonElement;
    expect(confirm().textContent!.trim()).toBe('Discard');
    expect(confirm().disabled).toBe(true);
    click('[data-item-id="a"]');
    expect(confirm().disabled).toBe(true);
    click('[data-item-id="x"]');
    expect(confirm().disabled).toBe(false);
    click('[data-item-id="b"]'); // a third is ignored at max
    expect(el.querySelectorAll('.item.picked')).toHaveLength(2);
    click('button.confirm');
    expect(close).toHaveBeenCalledWith({ ...template, ids: ['a', 'x'] });
  });

  it('a picked item can be unpicked', () => {
    const { el, click } = render();
    click('[data-item-id="a"]');
    click('[data-item-id="a"]');
    expect(el.querySelectorAll('.item.picked')).toHaveLength(0);
  });

  it('offers Cancel only when it may be cancelled', () => {
    const { click, close } = render();
    click('button.cancel');
    expect(close).toHaveBeenCalledWith(cancel);
    TestBed.resetTestingModule();
    expect(render({ cancel: null }).el.querySelector('button.cancel')).toBeNull();
  });

  it('shows seats by name', () => {
    const { el } = render({ items: [{ id: 'seat-2', label: 'Seat 2' }], min: 1, max: 2 });
    expect(el.querySelector('[data-item-id="seat-2"]')!.textContent).toContain('Seat 2');
  });
});
```

Add to `describe('waitingLine', …)` in `projects/app/src/app/game-board/response-description.spec.ts`. If there's no such describe yet, add it, using the file's `state` helper:

```ts
  it('says who is choosing for an ability, and who is being asked about one', () => {
    const owner = { kind: 'equipment' as const, seatId: 'seat-1', cardInstanceId: 'ax' };
    const selecting = {
      ...state([], null),
      pendingSelection: { id: 's1', seatId: 'seat-1', reason: { kind: 'ability' as const, owner, abilityId: 'axe' }, of: 'cards' as const, eligibleIds: [], min: 2, max: 2, then: { kind: 'discard' as const } },
    };
    expect(waitingLine(selecting)).toBe('Waiting on Seat 1 to choose');
    const asking = {
      ...state([], null),
      pendingChoice: { id: 'ask', seatId: 'seat-1', verb: 'use' as const, reason: { kind: 'ability' as const, owner, abilityId: 'axe' }, options: [] },
    };
    expect(waitingLine(asking)).toBe('Waiting on Seat 1: Axe?');
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/app projects/content/src/lib/display.spec.ts`
Expected: FAIL. The new files and `abilityHint` don't exist.

- [ ] **Step 3: Content's hints**

In `projects/content/src/lib/display.ts`, add:

```ts
// What an optional ability does, for its ask, in the game's own terms.
// '{target}' stands for the seat it is aimed at.
const ABILITY_HINTS: Record<string, string> = {
  'eight-trigrams': 'Judge: on red, it counts as a Shan',
  'gender-swords': "{target} discards a hand card or lets you draw 1 card",
  axe: 'Discard 2 cards to make your Sha hit {target}',
  'green-dragon-blade': 'Play another Sha at {target}',
  'ice-sword': "Prevent the damage and discard 2 of {target}'s cards instead",
  longbow: "Discard one of {target}'s Mounts",
  'sky-scorcher': 'Add up to 2 more targets to your Sha',
};

export function abilityHint(abilityId: string): string | null {
  return ABILITY_HINTS[abilityId] ?? null;
}
```

- [ ] **Step 4: Descriptions and dialogs**

Create `projects/app/src/app/game-board/ability-description.ts`:

```ts
import { Action, CardInstance, GameState, PendingSelection } from 'engine';
import { abilityHint, cardDisplayData } from 'content';
import { cardFaceLabel, cardIdDisplayName, seatName } from '../labels';

type SelectAction = Extract<Action, { kind: 'SelectAction' }>;

const cardName = (definitionId: string) => cardDisplayData(definitionId)?.name ?? cardIdDisplayName(definitionId);
const findCard = (state: GameState, instanceId: string) => state.zones.flatMap((z) => z.cards).find((c) => c.instanceId === instanceId);

export interface AskDescription {
  // The ability's name, e.g. "Axe".
  title: string;
  // The question, e.g. "Use Axe on Seat 1?".
  prompt: string;
  // What it does here, e.g. "Discard 2 cards to make your Sha hit Seat 1".
  hint: string | null;
  // The worn card the ability comes from, shown as its art.
  card: CardInstance | null;
  use: Action;
  decline: Action;
}

// What the Ask window says, read off a pending ask the viewer owes. Null otherwise.
export function describeAsk(state: GameState, viewerSeatId: string, legal: readonly Action[]): AskDescription | null {
  const choice = state.pendingChoice;
  if (!choice || choice.seatId !== viewerSeatId || choice.verb !== 'use' || choice.reason.kind !== 'ability') return null;
  const use = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === 'use');
  const decline = legal.find((a) => a.kind === 'ChooseOptionAction' && a.optionId === 'decline');
  if (!use || !decline) return null;
  const { abilityId, owner, targetSeatId } = choice.reason;
  const name = cardName(abilityId);
  const target = targetSeatId && targetSeatId !== viewerSeatId ? seatName(state.players, targetSeatId) : null;
  const hint = abilityHint(abilityId);
  return {
    title: name,
    prompt: `Use ${name}${target ? ` on ${target}` : ''}?`,
    hint: hint ? hint.replace('{target}', target ?? 'the target') : null,
    card: owner.kind === 'equipment' ? (findCard(state, owner.cardInstanceId) ?? null) : null,
    use,
    decline,
  };
}

export interface SelectionItem {
  id: string;
  // A card, face up (the selector's own); absent for a seat.
  card?: CardInstance;
  label: string;
}

export interface SelectionDescription {
  title: string;
  prompt: string;
  // The primary button: Discard, Use or Add Targets.
  confirmLabel: string;
  min: number;
  max: number;
  items: SelectionItem[];
  // The engine's SelectAction, to be filled with the picked ids.
  template: SelectAction;
  cancel: Action | null;
}

function selectionPrompt(state: GameState, selection: PendingSelection, items: SelectionItem[]): string {
  const count = selection.min === selection.max ? `${selection.min}` : `up to ${selection.max}`;
  const then = selection.then;
  switch (then.kind) {
    case 'discard':
      return `Choose ${count} ${selection.max === 1 ? 'card' : 'cards'} to discard`;
    case 'use-card': {
      if (then.as) return `Choose ${count} hand cards to use as ${cardName(then.as)}`;
      const kinds = new Set(items.map((i) => i.card?.definitionId));
      const [only] = [...kinds];
      const what = kinds.size === 1 && only ? cardName(only) : 'card';
      const target = then.targets[0];
      return `Choose a ${what} to play${target ? ` at ${seatName(state.players, target.seatId)}` : ''}`;
    }
    case 'card-step':
      return `Choose ${count} more ${selection.max === 1 ? 'target' : 'targets'}`;
  }
}

const CONFIRM_LABELS: Record<PendingSelection['then']['kind'], string> = { discard: 'Discard', 'use-card': 'Use', 'card-step': 'Add Targets' };

// What the Selection window says, read off a pending selection the viewer owes. Null otherwise.
export function describeSelection(state: GameState, viewerSeatId: string, legal: readonly Action[]): SelectionDescription | null {
  const selection = state.pendingSelection;
  if (!selection || selection.seatId !== viewerSeatId) return null;
  const template = legal.find((a): a is SelectAction => a.kind === 'SelectAction');
  if (!template) return null;
  const items = selection.eligibleIds.map((id): SelectionItem => {
    if (selection.of === 'seats') return { id, label: seatName(state.players, id) };
    const card = findCard(state, id);
    return card ? { id, card, label: `${cardName(card.definitionId)} (${cardFaceLabel(card)})` } : { id, label: 'Card' };
  });
  return {
    title: selection.reason.kind === 'ability' ? cardName(selection.reason.abilityId) : 'Choose',
    prompt: selectionPrompt(state, selection, items),
    confirmLabel: CONFIRM_LABELS[selection.then.kind],
    min: selection.min,
    max: selection.max,
    items,
    template,
    cancel: legal.find((a) => a.kind === 'CancelSelectionAction') ?? null,
  };
}
```

Create `projects/app/src/app/game-board/ask-dialog.ts`:

```ts
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Action } from 'engine';
import { PlayingCard } from './playing-card';
import { DecisionCountdown } from './decision-countdown';
import { AskDescription } from './ability-description';

export interface AskDialogData {
  description: AskDescription;
}

// "May" asks: use an optional ability or not. Closes only through its two
// buttons, with the engine's own ChooseOptionAction.
@Component({
  selector: 'app-ask-dialog',
  imports: [MatDialogModule, MatButtonModule, PlayingCard, DecisionCountdown],
  template: `
    <h2 mat-dialog-title>{{ data.description.title }}</h2>
    <mat-dialog-content class="body">
      @if (data.description.card; as card) {
        <app-playing-card [card]="card" />
      }
      <div class="words">
        <p class="prompt">{{ data.description.prompt }}</p>
        @if (data.description.hint; as hint) {
          <p class="hint">{{ hint }}</p>
        }
      </div>
    </mat-dialog-content>
    <!-- At zero: Don't. -->
    <app-decision-countdown class="timer" />
    <mat-dialog-actions align="end">
      <button mat-button type="button" class="decline" (click)="close(data.description.decline)">Don't</button>
      <button mat-flat-button type="button" class="use" (click)="close(data.description.use)">Use</button>
    </mat-dialog-actions>
  `,
  styles: `
    .body { display: flex; gap: 16px; align-items: flex-start; }
    .prompt { margin: 0 0 8px; font: var(--mat-sys-title-medium); }
    .hint { margin: 0; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .timer { display: block; padding: 8px 24px 0; }
  `,
})
export class AskDialog {
  protected readonly data = inject<AskDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<AskDialog, Action>>(MatDialogRef);

  protected close(action: Action): void {
    this.dialogRef.close(action);
  }
}
```

Create `projects/app/src/app/game-board/selection-dialog.ts`:

```ts
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Action } from 'engine';
import { PlayingCard } from './playing-card';
import { DecisionCountdown } from './decision-countdown';
import { SelectionDescription } from './ability-description';

export interface SelectionDialogData {
  description: SelectionDescription;
  // Told the filled SelectAction whenever enough are picked, so a timeout can use it.
  pickedChanged?: (action: Action) => void;
}

// Picking cards or seats for an ability (Axe's 2 cards, Sky Scorcher's
// targets). Confirms between min and max picks; Cancel when it may be.
@Component({
  selector: 'app-selection-dialog',
  imports: [MatDialogModule, MatButtonModule, PlayingCard, DecisionCountdown],
  template: `
    <h2 mat-dialog-title>{{ d.title }}</h2>
    <mat-dialog-content>
      <p class="prompt">{{ d.prompt }}</p>
      <ul class="items">
        @for (item of d.items; track item.id) {
          <li>
            <button
              type="button"
              class="item"
              [class.picked]="isPicked(item.id)"
              [attr.aria-pressed]="isPicked(item.id)"
              [attr.aria-label]="item.label"
              [attr.data-item-id]="item.id"
              (click)="toggle(item.id)"
            >
              @if (item.card; as card) {
                <app-playing-card [card]="card" />
              } @else {
                <span class="seat">{{ item.label }}</span>
              }
            </button>
          </li>
        }
      </ul>
    </mat-dialog-content>
    <app-decision-countdown class="timer" />
    <mat-dialog-actions align="end">
      @if (d.cancel; as cancel) {
        <button mat-button type="button" class="cancel" (click)="dialogRef.close(cancel)">Cancel</button>
      }
      <button mat-flat-button type="button" class="confirm" [disabled]="!ready()" (click)="confirm()">{{ d.confirmLabel }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .prompt { margin: 0 0 12px; font: var(--mat-sys-body-medium); color: var(--mat-sys-on-surface-variant); }
    .items { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 12px; }
    .item {
      display: flex; flex-direction: column; align-items: center; width: 100%; padding: 6px 4px;
      border: 2px solid transparent; border-radius: 10px; background: none; color: inherit; cursor: pointer;
    }
    .item:focus-visible { outline: 3px solid var(--mat-sys-primary); outline-offset: 2px; }
    .item.picked { border-color: var(--mat-sys-primary); background: var(--mat-sys-primary-container); }
    .seat { padding: 16px 8px; font: var(--mat-sys-title-small); }
    .timer { display: block; padding: 8px 24px 0; }
  `,
})
export class SelectionDialog {
  private readonly data = inject<SelectionDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject<MatDialogRef<SelectionDialog, Action>>(MatDialogRef);
  protected readonly d = this.data.description;
  protected readonly picked = signal<string[]>([]);
  protected readonly ready = computed(() => this.picked().length >= this.d.min && this.picked().length <= this.d.max);

  protected isPicked(id: string): boolean {
    return this.picked().includes(id);
  }

  // Pick or unpick; at max, a further pick is ignored (or, picking one,
  // replaces the pick).
  protected toggle(id: string): void {
    const now = this.picked();
    if (now.includes(id)) this.picked.set(now.filter((x) => x !== id));
    else if (now.length < this.d.max) this.picked.set([...now, id]);
    else if (this.d.max === 1) this.picked.set([id]);
    if (this.ready()) this.data.pickedChanged?.({ ...this.d.template, ids: this.picked() });
  }

  protected confirm(): void {
    if (this.ready()) this.dialogRef.close({ ...this.d.template, ids: this.picked() });
  }
}
```

- [ ] **Step 5: Wire them into the board; waiting lines**

In `projects/app/src/app/game-board/game-board.ts`:
- Import `AskDialog`, `AskDialogData`, `SelectionDialog`, `SelectionDialogData`, `describeAsk`, `describeSelection`.
- Change `private choiceDialog: MatDialogRef<ChoiceDialog, Action> | null` to `MatDialogRef<unknown, Action> | null`.
- In `openChoiceDialog`, right after the guard line, add (before `describeChoice`):

```ts
    // A "may": the Ask window instead.
    const ask = describeAsk(visible, seatId, this.gameService.legalActions());
    if (ask) {
      this.choiceDialogFor = choiceId;
      const ref = this.dialog.open<AskDialog, AskDialogData, Action>(AskDialog, { data: { description: ask }, width: 'min(92vw, 480px)', disableClose: true });
      this.choiceDialog = ref;
      ref.beforeClosed().subscribe((action) => {
        this.choiceDialogFor = null;
        this.choiceDialog = null;
        if (action) this.submit(action);
      });
      return;
    }
```

- Add the selection's state, beside the choice's:

```ts
  private selectionDialog: MatDialogRef<SelectionDialog, Action> | null = null;
  // The selection whose dialog is showing, so each opens only once.
  private selectionDialogFor: string | null = null;
  // The selection the viewer owes, while the board is on screen and the engine offers it.
  protected readonly selectionDue = computed(() => {
    const selection = this.visibleState()?.pendingSelection;
    if (!selection || selection.seatId !== this.viewerSeatId()) return null;
    return this.gameService.legalActions().some((a) => a.kind === 'SelectAction') ? selection.id : null;
  });
```

- In the constructor, add the same effect pattern as the choice's:

```ts
    effect(() => {
      const selectionId = this.selectionDue();
      untracked(() => {
        if (this.selectionDialogFor && this.selectionDialogFor !== selectionId) this.closeDialog(this.selectionDialog);
        if (selectionId) this.openSelectionDialog(selectionId);
      });
    });
```

- Add:

```ts
  // Opens the Selection dialog for one pending selection; it closes with the
  // engine's SelectAction (ids filled) or its CancelSelectionAction.
  private openSelectionDialog(selectionId: string): void {
    const visible = this.visibleState();
    const seatId = this.viewerSeatId();
    if (this.selectionDialogFor === selectionId || !visible || !seatId) return;
    const description = describeSelection(visible, seatId, this.gameService.legalActions());
    if (!description) return;
    this.selectionDialogFor = selectionId;
    const ref = this.dialog.open<SelectionDialog, SelectionDialogData, Action>(SelectionDialog, {
      data: { description, pickedChanged: (action) => this.timer.setTimeoutChoice([action]) },
      width: 'min(92vw, 640px)',
      disableClose: true,
    });
    this.selectionDialog = ref;
    ref.beforeClosed().subscribe((action) => {
      this.selectionDialogFor = null;
      this.selectionDialog = null;
      if (action) this.submit(action);
    });
  }
```

In `projects/app/src/app/game-board/response-description.ts`, at the top of `waitingLine`:

```ts
  const selection = state.pendingSelection;
  if (selection) return `Waiting on ${seatName(state.players, selection.seatId)} to choose`;
  const asking = state.pendingChoice;
  if (asking?.reason.kind === 'ability') {
    return `Waiting on ${seatName(state.players, asking.seatId)}: ${cardName({ definitionId: asking.reason.abilityId })}?`;
  }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest`
Expected: PASS, every project.

- [ ] **Step 7: Commit**

```bash
git add projects
git commit -m "feat(app): the Ask and Selection windows for equipment abilities

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: App — conversions, the new history lines, Gender Swords' choice, the Eight Trigrams judgment

**Files:**
- Modify in `projects/app/src/app/game-board/`:
  - `action-list.ts`, `response-dialog.ts`, `game-board.ts`
  - `action-history.ts`, `choice-description.ts`, `response-description.ts`
  - Specs: `action-list.spec.ts`, `response-dialog.spec.ts`, `action-history.spec.ts`, `choice-description.spec.ts`, `response-description.spec.ts`

**Interfaces:**
- Consumes:
  - `conversionLabel` (Task 4).
  - `UsedCard.via`.
  - `AbilityUsedEvent` outcomes `no-effect` and `counts-as-shan` (Task 6).
  - `SelectionMadeEvent`.
  - `ChoiceMadeEvent` with `shows` of kind `use` or `decline`.
- Produces: `ChoiceDescription` gains `declineLabel?: string`. `choiceDialogOptions(options, legal, players, declineLabel?)`.

- [ ] **Step 1: Write the failing tests**

Add to `projects/app/src/app/game-board/action-history.spec.ts` (import `usedCardFrom`, `usedCardOf` from `engine`):

```ts
describe('equipment abilities in the history', () => {
  const owner = (seatId: string, cardInstanceId: string) => ({ kind: 'equipment' as const, seatId, cardInstanceId });
  const h1: CardInstance = { instanceId: 'h1', definitionId: 'peach', suit: 'heart', rank: 3 };
  const c1: CardInstance = { instanceId: 'c1', definitionId: 'duel', suit: 'club', rank: 4 };

  it('names a Sha made from 2 cards, and where it came from', () => {
    const used = usedCardFrom([h1, c1], 'sha', { owner: owner('seat-0', 'sp'), abilityId: 'serpent-spear', conversionId: 'serpent-spear' });
    expect(texts([{ kind: 'CardPlayedEvent', seatId: 'seat-0', card: used, targets: [seat('seat-1')] }])).toContain('Seat 0 used 2 cards as Sha (Serpent Spear) on Seat 1');
  });

  it('says when an armour stops a Sha', () => {
    expect(texts([{ kind: 'AbilityUsedEvent', owner: owner('seat-1', 'bs'), abilityId: 'black-shield', outcome: 'no-effect', targetSeatId: 'seat-0' }])).toContain(
      "Seat 1's Black Shield: Seat 0's Sha has no effect"
    );
  });

  it('adds "counts as Shan" to an Eight Trigrams judgment', () => {
    const judged: CardInstance = { instanceId: 'j', definitionId: 'peach', suit: 'heart', rank: 9 };
    const log: EngineEvent[] = [
      { kind: 'JudgmentEvent', seatId: 'seat-1', tool: usedCardOf({ instanceId: 'et', definitionId: 'eight-trigrams', suit: 'spade', rank: 2 }), card: judged },
      { kind: 'AbilityUsedEvent', owner: owner('seat-1', 'et'), abilityId: 'eight-trigrams', outcome: 'counts-as-shan' },
    ];
    expect(texts(log)).toEqual(["Seat 1's Eight Trigrams judgment: 9 ♥, counts as Shan"]);
  });

  it('says who used an ability, on whom; a Don’t says nothing', () => {
    const made = (shows: { kind: 'use' } | { kind: 'decline' }): EngineEvent => ({
      kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'use', shows,
      reason: { kind: 'ability', owner: owner('seat-0', 'ax'), abilityId: 'axe', targetSeatId: 'seat-1' },
    });
    expect(texts([made({ kind: 'use' })])).toEqual(['Seat 0 used Axe on Seat 1']);
    expect(texts([made({ kind: 'decline' })])).toEqual([]);
  });

  it('Gender Swords’ target: letting the user draw, or discarding its own card', () => {
    const reason = { kind: 'choice' as const, card: usedCardOf({ instanceId: 'gs', definitionId: 'gender-swords', suit: 'spade', rank: 2 }), userSeatId: 'seat-1', targetSeatId: 'seat-0' };
    expect(texts([{ kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'discard', reason, shows: { kind: 'decline' } }])).toEqual(['Seat 0 let Seat 1 draw a card (Gender Swords)']);
    const discard: EngineEvent[] = [
      { kind: 'ChoiceMadeEvent', seatId: 'seat-0', verb: 'discard', reason, shows: { kind: 'card', card: h1 } },
      move(h1, 'seat-0:hand', 'discardPile'),
    ];
    expect(texts(discard)).toEqual(['Seat 0 discarded Peach (3 ♥) with Gender Swords']);
  });

  it('names the seats picked as extra targets', () => {
    const picked: EngineEvent = {
      kind: 'SelectionMadeEvent', seatId: 'seat-0', of: 'seats', ids: ['seat-1', 'seat-2'],
      reason: { kind: 'ability', owner: owner('seat-0', 'sk'), abilityId: 'sky-scorcher' },
    };
    expect(texts([picked])).toEqual(['Seat 0 picked Seat 1 and Seat 2 with Sky Scorcher']);
  });
});
```

Add to `describe('describeChoice', …)` in `projects/app/src/app/game-board/choice-description.spec.ts`:

```ts
  it('Gender Swords’ target: discard a hand card, or let the user draw', () => {
    const gs: PendingChoice = {
      id: 'gs', seatId: 'seat-0', verb: 'discard',
      reason: { kind: 'choice', card: { as: 'gender-swords', colour: 'black', physical: [] }, userSeatId: 'seat-1', targetSeatId: 'seat-0' },
      options: [{ id: 'decline', shows: { kind: 'decline' }, effects: [] }],
    };
    expect(describeChoice(state(gs), 'seat-0')).toEqual({
      title: 'Gender Swords',
      prompt: 'Discard a hand card, or let Seat 1 draw 1 card',
      confirmLabel: 'Discard',
      declineLabel: 'Let Seat 1 Draw',
    });
    expect(choiceOptionLabel({ kind: 'decline' }, players, 'Let Seat 1 Draw')).toBe('Let Seat 1 Draw');
  });
```

Add to `projects/app/src/app/game-board/response-description.spec.ts`:

```ts
  it('shows an Eight Trigrams judgment just before the window as the latest', () => {
    const et = usedCardOf({ instanceId: 'et', definitionId: 'eight-trigrams', suit: 'spade', rank: 2 });
    const judged: CardInstance = { instanceId: 'j', definitionId: 'peach', suit: 'club', rank: 3 };
    const log: EngineEvent[] = [
      { kind: 'CardPlayedEvent', seatId: 'seat-1', card: usedCardOf(sha), targets: [seat('seat-0')] },
      { kind: 'JudgmentEvent', seatId: 'seat-0', tool: et, card: judged },
      { kind: 'CardMovedEvent', cardInstanceId: 'j', fromZoneId: 'processing', toZoneId: 'discardPile', card: judged },
    ];
    expect(describeResponse(state(log, damageWindow('w1', 'seat-0', 'seat-1', 'sha-1')), 'seat-0')?.latest).toBe('Your Eight Trigrams judgment: 3 ♣');
  });
```

Add to `projects/app/src/app/game-board/response-dialog.spec.ts`:

```ts
  it('a skill answer (a conversion) confirms with its own label', () => {
    const convert: Action = { kind: 'UseConversionAction', seatId: 'seat-0', via: { owner: { kind: 'equipment', seatId: 'seat-0', cardInstanceId: 'sp' }, conversionId: 'serpent-spear' }, targets: [], pendingResponseId: 'w1' };
    const { el, confirm, close } = render([], [{ id: 'convert-0', action: convert, label: 'Use 2 Cards as Sha' }]);
    expect(el.textContent).toContain('Use 2 Cards as Sha');
    expect(confirm().textContent!.trim()).toBe('Use 2 Cards as Sha');
    confirm().click();
    expect(close).toHaveBeenCalledWith(convert);
  });
```

Add to `describe('ActionList', …)` in `projects/app/src/app/game-board/action-list.spec.ts`:

```ts
  it('groups a conversion’s plays under one button, with a menu of targets', () => {
    const state: GameState = {
      ...emptyState(),
      zones: [{ id: 'equip-0', kind: 'equip', ownerSeatId: 'seat-0', cards: [{ instanceId: 'sp', definitionId: 'serpent-spear', suit: 'spade', rank: 12 }] }],
    };
    const registry: ContentRegistry = {
      cards: new Map([
        ['sha', { id: 'sha', name: 'Sha', category: 'basic', play: () => [] }],
        ['serpent-spear', {
          id: 'serpent-spear', name: 'Serpent Spear', category: 'equipment', equipSlot: 'weapon', play: () => [],
          abilities: { conversions: [{ id: 'serpent-spear', as: 'sha', cards: 2, when: 'both' }] },
        }],
      ]),
      generals: new Map(),
    };
    const via = { owner: { kind: 'equipment' as const, seatId: 'seat-0', cardInstanceId: 'sp' }, conversionId: 'serpent-spear' };
    const at = (seatId: string): Action => ({ kind: 'UseConversionAction', seatId: 'seat-0', via, targets: [{ kind: 'seat', seatId }] });
    const fixture = TestBed.createComponent(ActionList);
    fixture.componentRef.setInput('actions', [{ kind: 'EndPhaseAction', seatId: 'seat-0' }, at('seat-1'), at('seat-2')]);
    fixture.componentRef.setInput('state', state);
    fixture.componentRef.setInput('registry', registry);
    fixture.detectChanges();
    const chosen = jest.fn();
    fixture.componentInstance.actionChosen.subscribe(chosen);

    const el = fixture.nativeElement as HTMLElement;
    expect([...el.querySelectorAll('button')].map((b) => b.textContent!.trim())).toEqual(['End Phase', 'Use 2 Cards as Sha']);
    (el.querySelector('button.conversion') as HTMLButtonElement).click();
    fixture.detectChanges();
    const items = [...document.querySelectorAll('.mat-mdc-menu-item')] as HTMLButtonElement[];
    expect(items.map((b) => b.textContent!.trim())).toEqual(['Targeting Seat 1', 'Targeting Seat 2']);
    items[1].click();
    expect(chosen).toHaveBeenCalledWith(at('seat-2'));
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx jest projects/app`
Expected: FAIL. The new lines, labels and grouping don't exist yet.

- [ ] **Step 3: Action history**

In `projects/app/src/app/game-board/action-history.ts`:
- Change `usedLabel` to name a conversion:

```ts
const usedLabel = (used: UsedCard) => {
  if (used.via) return `${used.physical.length} cards as ${cardName(used.as)} (${cardName(used.via.abilityId)})`;
  return used.physical.length === 1 && used.physical[0].definitionId === used.as ? named(used.physical[0]) : cardName(used.as);
};
```

- In `pickLine`, a seat discarding its own card names it plainly. Change the last two lines to:

```ts
    const what = face ? named(face) : 'a card';
    const whose = ownerSeatId && ownerSeatId !== made.seatId ? `${name(ownerSeatId)}'s ${what}` : what;
    return `${chooser} ${made.verb === 'take' ? 'took' : 'discarded'} ${whose}${tool}`;
```

- Replace `case 'ChoiceMadeEvent'` with:

```ts
      case 'ChoiceMadeEvent': {
        const { reason, shows } = event;
        if (shows.kind === 'card' || shows.kind === 'hidden-hand') {
          picked = event;
        } else if (shows.kind === 'use' && reason.kind === 'ability') {
          const on = reason.targetSeatId && reason.targetSeatId !== event.seatId ? ` on ${name(reason.targetSeatId)}` : '';
          action(`${name(event.seatId)} used ${cardName(reason.abilityId)}${on}`);
        } else if (shows.kind === 'decline' && reason.kind === 'choice') {
          action(`${name(event.seatId)} let ${name(reason.userSeatId)} draw a card (${cardName(reason.card.as)})`);
        }
        break;
      }
```

- Add cases:

```ts
      case 'AbilityUsedEvent': {
        const owner = name(event.owner.seatId);
        const ability = cardName(event.abilityId);
        if (event.outcome === 'no-effect' && event.targetSeatId) {
          action(`${owner}'s ${ability}: ${name(event.targetSeatId)}'s Sha has no effect`);
        } else if (event.outcome === 'counts-as-shan') {
          // Said on its judgment's line, which comes just before.
          const last = entries[entries.length - 1];
          if (last?.kind === 'action' && last.text.startsWith(`${owner}'s ${ability} judgment:`)) last.text += ', counts as Shan';
          else action(`${owner}'s ${ability} counts as Shan`);
        }
        break;
      }
      case 'SelectionMadeEvent':
        if (event.of === 'seats' && event.reason.kind === 'ability') {
          const seats = event.ids.map(name);
          const list = seats.length > 1 ? `${seats.slice(0, -1).join(', ')} and ${seats.at(-1)}` : seats[0];
          action(`${name(event.seatId)} picked ${list} with ${cardName(event.reason.abilityId)}`);
        }
        break;
```

- [ ] **Step 4: Gender Swords' choice, Eight Trigrams' judgment, the response dialog**

In `projects/app/src/app/game-board/choice-description.ts`:
- Add to `ChoiceDescription`:

```ts
  // The label of a "decline" option, when the choice has one (Gender Swords: "Let Seat 1 Draw").
  declineLabel?: string;
```

- In `describeChoice`, before the usual return, add:

```ts
  // Choosing among your own cards (Gender Swords): discard one, or let the user draw.
  if (targetSeatId === viewerSeatId && choice.options.some((o) => o.shows.kind === 'decline')) {
    const user = seatName(state.players, choice.reason.userSeatId);
    return { title: cardName(card.as), prompt: `Discard a hand card, or let ${user} draw 1 card`, confirmLabel: 'Discard', declineLabel: `Let ${user} Draw` };
  }
```

- Give `choiceOptionLabel` a third parameter `declineLabel?: string`, and change its `decline` line to `if (shows.kind === 'decline') return declineLabel ?? "Don't";`.
- Give `choiceDialogOptions` a fourth parameter `declineLabel?: string`, passed to `choiceOptionLabel` for the text options.

In `projects/app/src/app/game-board/game-board.ts`:
- In `openChoiceDialog`, pass `description.declineLabel` as the fourth argument of `choiceDialogOptions`.
- In `openResponseDialog`, offer conversion answers as skills:

```ts
    const skills: ResponseOption[] = legal.flatMap((action, i) =>
      action.kind === 'UseConversionAction' ? [{ id: `convert-${i}`, action, label: conversionLabel(action, visible, this.gameService.registry) }] : []
    );
```

and pass `skills` instead of `skills: []` (import `conversionLabel` from `'../labels'`).

In `projects/app/src/app/game-board/response-dialog.ts`, a skill answer confirms with its own label:

```ts
  protected readonly confirmLabel = computed(() => {
    const option = this.pickedOption();
    if (!option) return 'No Response';
    return option.card ? `Respond with ${this.name(option.card)}` : option.label;
  });
```

In `projects/app/src/app/game-board/response-description.ts`, in the generic path, after the `latest` loop, add:

```ts
  // An armour's judgment for the responder just before the window (Eight Trigrams on black).
  if (!latest) {
    for (let i = state.log.length - 1; i >= 0; i--) {
      const event = state.log[i];
      if (event.kind === 'CardMovedEvent') continue;
      if (event.kind === 'JudgmentEvent' && event.seatId === pending.respondingSeatId) {
        const whose = event.seatId === viewerSeatId ? 'Your' : `${name(event.seatId)}'s`;
        latest = `${whose} ${cardName({ definitionId: event.tool.as })} judgment: ${cardFaceLabel(event.card)}`;
      }
      break;
    }
  }
```

(import `cardFaceLabel` from `'../labels'`).

- [ ] **Step 5: The action list groups conversions**

In `projects/app/src/app/game-board/action-list.ts`:
- Import `MatMenuModule`, plus `conversionLabel` and `targetLabel` from `'../labels'`.
- In `isCardAction`, add `|| action.kind === 'UseConversionAction'` (answers go to the Response dialog; plays are grouped below).
- Add:

```ts
interface ConversionGroup {
  label: string;
  uses: LabeledAction[];
}
```

and in the component:

```ts
  // A conversion's plays, one button each ("Use 2 Cards as Sha"), with a menu of targets.
  readonly conversionGroups = computed<ConversionGroup[]>(() => {
    const groups = new Map<string, ConversionGroup>();
    for (const action of this.actions()) {
      if (action.kind !== 'UseConversionAction' || action.pendingResponseId) continue;
      const label = conversionLabel({ ...action, targets: [] }, this.state(), this.registry());
      const group = groups.get(label) ?? { label, uses: [] };
      group.uses.push({ action, label: `Targeting ${action.targets.map((t) => targetLabel(t, this.state().players)).join(', ')}` });
      groups.set(label, group);
    }
    return [...groups.values()];
  });
```

- Add `MatMenuModule` to `imports`, and to the template, inside `.action-list`, after the `@for`:

```html
      @for (group of conversionGroups(); track group.label) {
        <button mat-stroked-button type="button" class="conversion" [matMenuTriggerFor]="targets">{{ group.label }}</button>
        <mat-menu #targets="matMenu">
          @for (use of group.uses; track use.label) {
            <button mat-menu-item type="button" (click)="actionChosen.emit(use.action)">{{ use.label }}</button>
          }
        </mat-menu>
      }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx jest`
Expected: PASS, every project.

- [ ] **Step 7: Commit**

```bash
git add projects/app
git commit -m "feat(app): conversions in the action list and Response window; history lines for equipment abilities

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: The event chain doc, and the full check

**Files:**
- Modify: `docs/architecture/event-chain.md`

- [ ] **Step 1: Update the prime example for Sha's steps**

In "Prime example: a lethal Sha", replace step 4 of Call 1 with:

```markdown
4. `sha.play()` returned one effect, the Sha's first step:
   `CardStepEffect('sha-use')`. Each step's `onStep` queues the next:
   `sha-use` → `sha-targeted` (one per target) → `sha-armor` → `sha-shan`.
   `sha-shan` opens the window: B must play a Shan, otherwise the
   `sha-hit` step goes ahead (the window's `outcome` shows the damage it would
   lead to). Steps log no events of their own.
```

Replace step 1 of Call 2 with:

```markdown
1. `resolveAction` clears the pending response and queues the effect it was
   holding back: the `sha-hit` step, which leads to `sha-damage`, which
   queues the `DamageEffect` and then `sha-after-damage`.
```

The log listing stays the same: steps log nothing.

- [ ] **Step 2: Add a section on steps, asks, selections and conversions**

Insert before `## Plugging into the chain`:

```markdown
## Card steps, asks, selections and conversions

**Steps.** A card that resolves in stages (Sha; Hail of Arrows' Shan) queues
`CardStepEffect { step, card, userSeatId, target, data }`. Applying one calls
the card's `onStep`, whose effects go to the front of the queue. Step names
belong to content: Sha's are `sha-use`, `sha-targeted`, `sha-armor`,
`sha-shan`, `sha-dodged`, `sha-hit`, `sha-damage` and `sha-after-damage`.

**Abilities at a step** are `before:CardStepEffect` triggers (content's
`atStep`). One may:
- rewrite the step (Ancient Scimitar adds to `data.extra`);
- replace it with something else (Black Shield's logged `AbilityUsedEffect`,
  and the Sha goes no further at that target);
- or replace it with an ask.

Each marks the step (`actedOn`) so it has its say once. `previewEffect`
re-checks each later trigger against the step as rewritten, and stops when
the step becomes another kind of effect: the rest get their say when it comes
back.

**Asks.** `AskUseEffect { owner, abilityId, effects, otherwise }` opens a
pending choice with two options: Use (`effects`) and Don't (`otherwise`,
usually the marked step).

**Selections.** `pendingSelection` asks a seat for `min`–`max` cards or
seats. It pauses the queue like a choice, and may sit over an open response
window. Its continuation is plain data:
- `discard` (then more effects);
- `use-card` (the picked cards as one card: to play at targets, or to answer
  a window);
- `card-step` (a step with the picks as `data.picked`).

`getLegalActions` offers a `SelectAction` template; `validateSelection`
checks a filled one.

**Conversions.** A worn card's `abilities.conversions` give
`UseConversionAction`s:
- in the Play Phase, one per legal target list of the card made;
- in a window that allows the card made, one each.

Each opens a selection of the cards to use. The result is one `UsedCard`
(`via` names the conversion), which counts toward limits like the real card.

A card in use is always a `UsedCard`: what it counts as, its colour (two cards
of different colours: none), and its physical cards.
```

Add rows to the "Plugging into the chain" table:

```markdown
| A card that resolves in stages | `CardStepEffect`s and `CardDefinition.onStep` | Sha's eight steps |
| An ability at a stage | An `atStep` trigger returning the step changed, replaced, or an `askAtStep` | Axe at `sha-dodged` |
| A "may" | `AskUseEffect` (`askAtStep` in content) | Eight Trigrams before a Shan |
| Picking cards or seats | `OpenSelectionEffect` with a continuation | Axe's 2 cards, Sky Scorcher's targets |
| Using cards as another card | `abilities.conversions` | Serpent Spear |
```

- [ ] **Step 3: Run everything**

Run: `npx jest`
Expected: PASS, every project. This includes the sim's seeded batches at every seat count from 2 to 10, with every equipment card in the deck.

Run: `npm run build && npx ng build app`
Expected: both builds succeed.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/event-chain.md
git commit -m "docs: card steps, asks, selections and conversions in the event chain

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
