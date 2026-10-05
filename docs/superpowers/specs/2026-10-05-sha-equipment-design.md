# Sha Steps, Abilities and the Remaining Equipment — Design Spec

Status: Draft for review
Date: 2026-10-05

## Purpose

Stage 5 of the [roadmap](2026-10-05-all-cards-and-skills-roadmap-design.md).
Give Sha explicit steps, give equipment real abilities on those steps, and
let cards be used as other cards. This makes playable the last eleven
equipment cards: Eight Trigrams, Black Shield, Wood Armor, Ancient Scimitar,
Ice Sword, Axe, Longbow, Gender Swords, Green Dragon Blade, Sky Scorcher and
Serpent Spear.

The engine pieces here (abilities, steps, `UsedCard`, asking, selections,
conversions) are general on purpose. Stage 6, the skill engine, reuses all of
them.

It builds on stages 1–4: the resolution queue, Wuxie checks and choices
([Tools spec](2026-10-05-tools-design.md)), judgments, and equipment
triggers, turn flags and the Sha limit query
([Cards A spec](2026-10-05-cards-a-equipment-and-simple-cards-design.md)).

## Rule text

"Your Sha" means a Sha you play or use. "Its colour" is red or black. A Sha
made from two cards (Serpent Spear) is red if both are red, black if both are
black, and has **no colour** otherwise. Such a Sha has no suit and no rank.

### Steps of a Sha

Each target in turn goes through:

1. **Targeted.** The targets are chosen.
2. **Armour check.**
3. **Shan asked.** The target is asked for a Shan. Some rules ask for more
   than one (Matchless, stage 7).
4. **Dodged or hit.**
5. **Damage.** The amount is worked out and dealt.
6. **After damage.**

A Sha played in your Play Phase counts toward the Sha limit, and spends a
Wine boost, when it is played, whatever happens at the later steps. All "may"
abilities ask their owner first.

### Weapons

Range comes from the data file. Crossbow and Black Pommel are as in the
Cards A spec. Black Pommel turns off the target's armour from step 2 to
step 5. That includes Eight Trigrams, Black Shield, Wood Armor and Silver
Lion.

- **Gender Swords** (range 2), may. At step 1, if the target's gender
  differs from yours, you may make the target choose: discard 1 hand card,
  or let you draw 1 card. A target with no hand cards must let you draw. A
  seat with no gender (both Generals hidden) never differs. Gender is
  defined in the General Skills spec.
- **Sky Scorcher** (range 4), may. When you play your **last hand card** as
  a Sha in your Play Phase, you may add up to 2 more targets within your
  attack range. Each target goes through steps 2–6 on its own, in seat
  order from you.
- **Serpent Spear** (range 3), conversion. Whenever you could play or use a
  Sha, you may use 2 hand cards as one Sha instead. That covers your Play
  Phase, Duel, Barbarians and Coerce. In your Play Phase it counts toward
  the Sha limit as usual.
- **Axe** (range 3), may. At step 4, if your Sha is dodged, you may discard
  2 other cards from your hand or equipment. The Axe itself can't be one of
  them. The Sha then hits anyway and goes on to step 5.
- **Green Dragon Blade** (range 3), may. At step 4, if your Sha is dodged,
  you may play another Sha at the same target. That Sha doesn't count toward
  the limit, ignores range, and starts at step 1. This can repeat.
- **Ice Sword** (range 2), may. At step 5, before your Sha deals damage, you
  may prevent that damage. Instead you discard 2 of the target's cards, one
  at a time, each chosen as Break chooses. If the target has only 1, you
  discard it. You may use this only if the target has at least 1 card.
- **Ancient Scimitar** (range 2), compulsory. At step 5, if the target has
  no hand cards, your Sha deals 1 extra damage.
- **Longbow** (range 5), may. At step 6, after your Sha damages a seat, you
  may discard one of that seat's mounts. You choose which if it wears both.

### Armour

The wearer's armour, all turned off by the attacker's Black Pommel.

- **Eight Trigrams**, may. Whenever you need a Shan, from a Sha or Hail of
  Arrows, you may judge first. On red, you count as having played a Shan,
  though no card leaves your hand. On black, you may still play a Shan as
  normal. When more than one Shan is needed, Eight Trigrams provides at
  most one of them.
- **Black Shield**, compulsory. At step 2, a black Sha has no effect on you.
  A Sha with no colour still affects you.
- **Wood Armor**, compulsory. At step 2, a Sha has no effect on you.
  Barbarians and Hail of Arrows also skip you as a target, so there is no
  Wuxie check for you. Its fire weakness can't come up, because there is no
  fire damage yet.
- **Silver Lion**: as in the Cards A spec.

### How they combine

- Ancient Scimitar's +1 is added before Silver Lion's cap. The cap brings it
  back to 1, unless the attacker wears Black Pommel.
- Wine's +1 and Ancient Scimitar's +1 add together.
- If Ice Sword prevents the damage, no damage is dealt, so Longbow and
  Ancient Scimitar don't apply.
- A Sha that has no effect at step 2 still counts toward the Sha limit and
  still spends Wine.
- Green Dragon Blade's follow-up Sha is a new Sha. Wine has already been
  spent, and the follow-up gets its own steps and armour check.

## Engine design

### Abilities

An **ability** is a rule carried by a worn equipment card, or (from stage 6)
by a revealed General's skill. The engine gathers abilities from both. It
never names a card or skill.

```ts
// registry/types.ts
export interface Abilities {
  triggers?: SkillTrigger[];           // SkillTrigger gains `optional?: true`
  modifiers?: AbilityModifiers;
  conversions?: Conversion[];
  // `active` is added in stage 6 (General Skills spec).
}

export interface AbilityModifiers {
  shaLimit?: number;                   // highest wins; Infinity = no limit
  distanceToOthers?: number;           // added to your distance to others (−1 offensive)
  distanceFromOthers?: number;         // added to others' distance to you (+1 defensive)
  ignoresArmor?: boolean;              // Black Pommel
  untargetableBy?: string[];           // card ids that can't target you (stage 7)
}

export interface Conversion {
  id: string;                          // unique within its owner
  as: string;                          // definition id produced, e.g. 'sha'
  cards: 1 | 2;
  from: 'hand' | 'handOrEquip';
  filter?(card: CardInstance): boolean; // e.g. red only
  when: 'play' | 'respond' | 'both';   // 'play' = proactive in your Play Phase
  outsideOwnTurnOnly?: boolean;         // First Aid (stage 7)
}

export type AbilityOwner =
  | { kind: 'general'; seatId: string; slot: 'main' | 'deputy'; skillId: string }
  | { kind: 'equipment'; seatId: string; cardInstanceId: string };
```

- `CardDefinition` gains `abilities?: Abilities`. The Cards A spec's
  `triggers` and `EquipmentAbility` map fold into this field. `onUnequip`
  stays.
- `TriggerOwner` becomes `AbilityOwner`.
- `gatherTriggeredSkills` becomes `gatherAbilities(point)`. It gathers mode
  triggers, then General skills, then worn equipment, in seat order and then
  zone order (as in Cards A).
- The content-side queries (`shaLimit`, `seatDistance`, `attackRange`,
  `armorIgnored`) read `modifiers` from every active ability of a seat
  through one helper, `activeAbilities(state, seatId, registry)`. The
  separate map keyed by definition id goes.

### Used cards

A card in resolution is a `UsedCard`, not a bare `CardInstance`:

```ts
export interface UsedCard {
  as: string;                          // the definition it counts as
  colour: 'red' | 'black' | 'none';
  suit?: Suit; rank?: number;          // present only for a single physical card
  physical: CardInstance[];            // 0 (skill-made), 1 (normal), or 2 (Serpent Spear)
  via?: AbilityOwner & { conversionId: string };
}
```

- A normal play wraps its one card. A conversion wraps 1–2 cards with the
  derived colour.
- `CardPlayedEvent` carries the `UsedCard`. Action History says, for
  example, "Hing used 2 cards as Sha (Serpent Spear) on Seat 1".
- The physical cards go to the discard pile as they do today, after
  `CardPlayedEvent`.
- Evil Hero (stage 7) and other "take the card" rules take `physical`.

### Sha steps

Sha's `play()` (and its response use) queues one generic engine effect per
step per target:

```ts
| { kind: 'CardStepEffect'; step: string; card: UsedCard; userSeatId: string; target: Target; data?: Record<string, unknown> }
```

- **Content-owned names.** Step names belong to content: `'sha-targeted'`,
  `'sha-armor'`, `'sha-shan'`, `'sha-dodged'`, `'sha-hit'`, `'sha-damage'`,
  `'sha-after-damage'`. Applying a `CardStepEffect` calls the card's new
  hook and puts its results at the queue front:

  ```ts
  // CardDefinition
  onStep?(state: GameState, step: Extract<Effect, { kind: 'CardStepEffect' }>): unknown[];
  ```

- **What each step does.** Sha's `onStep` does the work of each step:
  - `sha-shan` opens the Shan window, with `data.needed` defaulting to 1.
  - On answer, it queues the next `sha-shan` while more are still needed,
    else `sha-dodged`. On pass, it queues `sha-hit`.
  - `sha-hit` queues `sha-damage`.
  - `sha-damage` queues the `DamageEffect` (base 1, plus Wine), then
    `sha-after-damage`.
- **How abilities hook in.** Abilities listen with `before:CardStepEffect`
  or `after:CardStepEffect` and filter on `step`. A before-trigger may
  return `[]`, which cancels the step: Black Shield and Wood Armor at
  `sha-armor`. Or it may return a rewritten step: Ancient Scimitar raises
  `data.extra`, and Ice Sword swaps `sha-damage` for the discard choice.
- Axe and Green Dragon Blade listen `after:` `sha-dodged`. Axe's effects
  queue `sha-hit`.
- Eight Trigrams listens `before:` `sha-shan` and the matching Hail of
  Arrows step. It queues a judgment. A red judgment queues the step's
  "answered" continuation, reduced by one Shan.
- Hail of Arrows gets the same `'hail-shan'` step, so Eight Trigrams covers
  both.

### Asking to use ("may")

- **Asking.** When an `optional` trigger's condition holds, the engine does
  not run its effects. It queues
  `AskUseEffect { owner: AbilityOwner, abilityId, effects }`, which opens a
  pending choice (Tools stage 2):
  - **Use:** queue `effects` at the front.
  - **Don't:** nothing.
- **Reason.** The choice's reason is
  `{ kind: 'ask-use'; owner; abilityId; context }`. The UI renders it, for
  example as "Use Axe? Discard 2 cards to make your Sha hit Seat 1".
- **Costs.** Costs that need a selection (Axe's 2 cards) open the selection
  after Use. A Use whose cost can't be paid isn't offered: the trigger's
  condition checks the cost first.

### Selecting cards

```ts
// GameState
pendingSelection: PendingSelection | null;

interface PendingSelection {
  id: string;
  seatId: string;
  reason: DecisionReason;
  eligibleCardIds: string[];           // instance ids
  min: number; max: number;
  then: SelectionContinuation;         // plain data: what to queue for the picked ids
  cancellable?: boolean;               // true when the ability was optional
}

| { kind: 'SelectCardsAction'; seatId: string; selectionId: string; cardInstanceIds: string[] }
| { kind: 'CancelSelectionAction'; seatId: string; selectionId: string }
```

- **Continuations.** `SelectionContinuation` is a small, closed set of plain
  data continuations: `discard`, `discard-then`, `convert-and-play`,
  `give-to`, and so on. Each says what to queue for the picked ids, so the
  state stays serialisable. A continuation names effects. It never holds a
  function.
- **Pausing.** A pending selection pauses the queue like a response window
  or choice. Active seat and redaction treat it the same way.
- **Legal actions.** `getLegalActions` returns one `SelectCardsAction`
  *template* with empty `cardInstanceIds`, plus `CancelSelectionAction` when
  cancellable.
- **Validation.** `validateSelection(state, action)` checks the ids against
  `eligibleCardIds` and `min`/`max`. Bots and the UI use the same check.

### Conversions as actions

- **Action fields.** `PlayCardAction` and `RespondAction` gain
  `via?: { owner: AbilityOwner; conversionId: string }` and
  `cardInstanceIds?: string[]`. These are used in place of `cardInstanceId`
  for converted plays.
- **1-card conversions** are listed card by card, like normal plays. For
  example, each red card is offered as a Sha through Fighting Saint, with the
  targets the produced card's `legalPlayTargets` gives.
- **2-card conversions** are listed once per conversion as
  `UseConversionAction { via, mode: 'play' | 'respond' }`. It opens a
  selection of exactly 2 eligible cards (cancellable). Then, for `play`, it
  offers the usual targets of the produced card as a follow-up choice. For
  `respond`, it answers the open window.
- **Legality.** A conversion produces a card whose own legality applies,
  including the Sha limit. A response window's `allowedCardIds` is matched
  against the produced card's `as`.
- **Who gets asked.** "Asked only if holding X" (Wuxie checks, dying
  rescues) becomes "asked only if some legal response exists", using the
  same legal-actions code, so conversions count.

## Content

- **Weapons and armour.** The eleven cards are built with
  `makeEquipmentCard` and `abilities`, in `cards/equipment/`. There is one
  file per card with abilities. Plain cards stay in the shared file.
- **`sha.ts`** is rewritten onto steps. Response uses of Sha (Duel,
  Barbarians, Coerce) are unchanged apart from carrying a `UsedCard`.
- **Gender** comes from the General Skills spec's data addition. Gender
  Swords reads it through `seatGender(state, seatId)`.

## Bots (rule-based)

- **Free abilities:** always Use. That covers Eight Trigrams, Longbow,
  Gender Swords, and Sky Scorcher's extra targets (at non-allies only).
- **Axe:** Use only against a non-ally. Discard the lowest-ranked 2 cards.
- **Ice Sword:** Use when the target is a non-ally at more than 1 HP who
  wears equipment.
- **Green Dragon Blade:** Use whenever the bot holds another Sha.
- **Serpent Spear:** convert only when the bot has no real Sha (or Shan to
  answer with) and the 2 lowest-ranked cards aren't Peach.
- **Gender Swords target's choice:** discard a hand card when holding more
  than 2, else let them draw.

## UI

- **Ask window.** It shows the ability's name and art (equipment card or
  General), what it does here, and two buttons: Use and Don't. It can't be
  dismissed. It is used for every "may".
- **Selection window.** Discard-window style. It shows the eligible cards,
  "Choose 2" style guidance from `min`/`max`, and a primary button named by
  the reason (Discard, Use, Give). It has a Cancel button when cancellable.
- **Conversions.** Each eligible hand card gets a small "As Sha" chip that
  names its source on hover ("As Sha · Serpent Spear"). A 2-card conversion
  adds one "Use 2 Cards as Sha" button in the action list.
- **Response window:**
  - The list includes conversion answers ("Use 2 Cards as Sha").
  - It shows "Shan needed: 2" when more than one is needed.
  - It shows an Eight Trigrams judgment as an earlier answer.
- **Action History:**
  - "Hing's Black Shield: Seat 1's Sha has no effect"
  - "Seat 2 used Axe: the Sha hits"
  - "Hing's Eight Trigrams judgment: 9 ♥, counts as Shan"
  - "Seat 2 used Ice Sword: discarded 2 of Hing's cards"

## Testing

- **Engine:**
  - Ability gathering: from both owner kinds, the order, only while worn.
  - `AskUseEffect`: Use and Don't.
  - `pendingSelection`: validation, cancel, serialisation.
  - `UsedCard` colour derivation.
  - `CardStepEffect` before-cancel and rewrite.
  - Conversion legal actions, both the 1-card and the 2-card flow.
  - "Asked only if some legal response exists".
- **Content:**
  - One test per rule bullet, per card.
  - Every bullet under "How they combine".
  - Serpent Spear in a Duel and against Barbarians.
  - Eight Trigrams against Hail of Arrows.
  - Black Shield against a red, a black and a no-colour Sha.
- **Bots:** each bot rule above.
- **App:** Ask window, Selection window, the conversion chip and button,
  "Shan needed: 2", and the new Action History lines.
- **Simulator:**
  - Seeded batches at 2, 5 and 10 seats with every equipment card in the
    deck.
  - Invariants: cards are conserved, and no decision is left pending with an
    empty queue.
