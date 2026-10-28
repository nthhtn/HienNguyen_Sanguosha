# General Skills — Skill Engine and the 25 Base Generals — Design Spec

Status: Draft for review
Date: 2026-10-05

## Purpose

Stages 6 and 7 of the
[roadmap](2026-10-05-all-cards-and-skills-roadmap-design.md).

- **Stage 6** builds the skill engine: hidden Generals' reveal-to-use,
  active Play-Phase skills, usage counters, gender, and the decisions skills
  need.
- **Stage 7** gives the 25 base Generals their real skills. It replaces
  today's five placeholder skills, which are partly invented.

The engine here extends the
[Sha-Equipment spec](2026-10-05-sha-equipment-design.md): abilities,
`AbilityOwner`, `UsedCard`, `CardStepEffect`, `AskUseEffect`,
`pendingSelection` and conversions. A General's skill is an ability owner
like a worn equipment card.

Wind, Fire, Forest and Mountain Generals keep their data and wiki text. Their
skills are later sub-projects. Until then they have no skills in play, as
today.

## Common rules

- **Source.** The rules follow the crawled data's standard-edition skills,
  applied to Guozhan. "You" is the seat holding the General. "Your Play
  Phase" means the Play Phase of your own turn.
- **Hidden Generals.** A hidden General's skills are off:
  - **Optional triggers** and **active skills** are still offered, as
    "Reveal X to use Y". Saying yes reveals that General first, with every
    usual Guozhan consequence, then uses the skill.
  - **Conversions** of a hidden General are offered the same way. Using one
    reveals the General.
  - **Compulsory** triggers and **modifiers** of a hidden General don't
    apply.
- **Gender.** A seat's gender is its Main General's while the Main is
  revealed, otherwise its Deputy's while that is revealed. A seat with both
  Generals hidden has **no gender**: it is neither male nor female.
- **Lord skills** (Escort, Fierce General, Rescued) are inactive in Guozhan
  . The wiki shows them with the note "Not used in Guozhan".
- **Losing HP** is not damage. It has no source, and nothing that reacts to
  damage applies. A seat at 0 HP or below after losing HP is dying, as after
  damage.

## Rule text: the 25 base Generals

### Wei

- **Cao Cao: Evil Hero** (may). After you take damage caused by a card, you
  may take that card into your hand. For a Serpent Spear Sha that means both
  of its cards. Nothing happens if the card has already left the discard
  pile and processing.
- **Cao Cao: Escort**. A Lord skill, so it is inactive.
- **Guo Jia: Heaven's Envy** (may). After a judgment of yours takes effect,
  you may take the judgment card into your hand instead of discarding it.
  - The crawled text says "before it takes effect". This spec uses the
    standard ruling, *after*: Lightning still strikes first.
- **Guo Jia: Bestowed Rouse** (may). For each 1 damage you take, you may
  draw 2 cards. You may then give any of those 2 cards to other living
  seats, in any split. A 2-damage hit asks twice.
- **Sima Yi: Feedback** (may). After a seat damages you, you may take 1 of
  its cards. Its hand counts as one face-down option, as with Steal.
  Nothing happens if it has no cards.
- **Sima Yi: Devil** (may). When any seat's judgment card is turned up,
  before it takes effect, you may play a hand card to replace it. The old
  judgment card is discarded.
  - Seats with a judgment-changing skill are asked in seat order, starting
    with the judged seat.
  - After a replacement, the seats are asked again, starting after the seat
    that replaced the card.
- **Xiahou Dun: Unyielding** (may). After another seat damages you, you may
  judge. If the card isn't a heart, that seat chooses one of two outcomes:
  - discard 2 hand cards;
  - take 1 damage from you.

  A seat with fewer than 2 hand cards must take the damage.
- **Xu Chu: Bare the Chest** (may). In your Draw Phase you may draw 1 fewer
  card. If you do, damage from your Sha and Duel this turn is 1 greater.
- **Zhang Liao: Raid** (may). In your Draw Phase, instead of drawing, you may
  choose 1 or 2 other seats that hold hand cards. You take 1 random hand card
  from each, in seat order.
- **Zhen Ji: Overturned Country** (conversion, respond). You may use any
  black hand card as a Shan.
- **Zhen Ji: River Goddess** (may). In your Start Phase you may judge
  repeatedly:
  - Each black card goes into your hand, and you may judge again.
  - The first red card is discarded, and that ends it.

### Shu

- **Guan Yu: Fighting Saint** (conversion, play and respond). You may use
  any red card from your hand or equipment as a Sha.
- **Huang Yueying: Gathering Wisdom** (may). When you play a non-delayed
  Tool, you may draw 1 card. This happens before the Tool takes effect.
- **Huang Yueying: Wondrous Talent** (compulsory modifier). Your Tools ignore
  distance. That covers Steal and Starvation.
- **Liu Bei: Kindness** (active, any number of times). In your Play Phase,
  you may give any of your hand cards to another seat. Once per turn, when
  the total you've given this turn first reaches 2 or more, you recover
  1 HP.
- **Liu Bei: Fierce General**. A Lord skill, so it is inactive.
- **Ma Chao: Horsemanship** (compulsory modifier). Your distance to every
  other seat is 1 smaller, never below 1.
- **Ma Chao: Iron Cavalry** (may). After you target a seat with a Sha, you
  may judge. On red, that seat can't play a Shan against this Sha. That
  includes Eight Trigrams.
- **Zhang Fei: Roar** (compulsory modifier). There is no limit on how many
  Sha you play.
- **Zhao Yun: Dragon Courage** (conversion, play and respond). You may use a
  Sha as a Shan, and a Shan as a Sha.
- **Zhuge Liang: Astrology** (may). In your Start Phase you may look at the
  top X cards of the draw pile, where X is the number of living seats, at
  most 5. You put each one back on top or on the bottom, in any order you
  like.
- **Zhuge Liang: Empty City** (compulsory modifier). While you have no hand
  cards, you can't be targeted by Sha or Duel.

### Wu

- **Da Qiao: Country Scene** (conversion, play). You may use any diamond
  card from your hand or equipment as a Capture.
- **Da Qiao: Displace** (may). When a Sha targets you, you may discard 1 card
  to move the Sha onto another living seat.
  - The new target must be within your attack range, worked out after the
    discard. It can't be the Sha's user.
  - The Sha then goes on against the new target from its armour check.
- **Gan Ning: Surprise** (conversion, play). You may use any black card from
  your hand or equipment as a Break.
- **Huang Gai: Battered Body** (active, any number of times). In your Play
  Phase you may lose 1 HP, then draw 2 cards. If losing the HP leaves you
  dying, the dying round happens first, and you draw only if you survive.
- **Lu Meng: Self-Restraint** (may). If you played or used no Sha this turn,
  responses included, you may skip your Discard Phase.
- **Lu Xun: Humility** (compulsory modifier). You can't be targeted by Steal
  or Capture.
- **Lu Xun: Linked Camps** (compulsory). Whenever you lose your last hand
  card, however it happens, you draw 1.
- **Sun Quan: Reconsider** (active, once per turn). In your Play Phase you
  may discard any number of cards (at least 1) from your hand or equipment,
  then draw that many.
- **Sun Quan: Rescued**. A Lord skill, so it is inactive.
- **Sun Shangxiang: Marriage** (active, once per turn). In your Play Phase
  you may discard 2 hand cards and choose a male seat below its max HP. You
  and that seat each recover 1 HP.
- **Sun Shangxiang: Armed Consorts** (compulsory). Each time a card leaves
  your equipment, you draw 2. That includes cards you replace, cards taken by
  Steal or Break, and cards you use through a conversion.
- **Zhou Yu: Brave Gesture** (may). In your Draw Phase you may draw 1 extra
  card.
- **Zhou Yu: Sow Revolt** (active, once per turn, needs at least 1 hand
  card). In your Play Phase, you choose another seat.
  1. That seat names a suit.
  2. It then takes 1 of your hand cards at random. The card is shown to
     everyone and goes into its hand.
  3. If the card's suit isn't the one it named, it takes 1 damage from you.

### Qun

- **Diao Chan: Sow Discord** (active, once per turn). In your Play Phase you
  may discard 1 card and choose two other male seats, in order.
  - The **second** seat uses a Duel on the **first**, as if it had played
    one. The Duel has no physical card (a `UsedCard` with `physical: []`).
  - The Duel goes through the usual Wuxie check, and Duel's rules apply as
    normal.
- **Diao Chan: Eclipse the Moon** (compulsory). At the start of your End
  Phase, you draw 1.
- **Hua Tuo: First Aid** (conversion, respond, only outside your turn). You
  may use any red card from your hand or equipment as a Peach.
- **Hua Tuo: Green Vesicle** (active, once per turn). In your Play Phase you
  may discard 1 hand card. A seat of your choice below its max HP, you
  included, then recovers 1 HP.
- **Lu Bu: Matchless** (compulsory).
  - Your Sha needs **two** Shan to dodge. An Eight Trigrams red judgment
    counts as one. If only one is given, the Sha hits.
  - In a Duel with you, the other seat must play **two** Sha each time it is
    its turn to play.

## Engine design (stage 6)

### Skills as abilities

```ts
export interface SkillDefinition extends Abilities {
  id: string;
  compulsory?: boolean;        // modifiers and non-optional triggers of a hidden General stay off
  lord?: boolean;              // inactive in modes without a Lord
  active?: ActiveSkill;
}

export interface ActiveSkill {
  usesPerTurn?: number;        // absent = unlimited
  canUse(state: GameState, ctx: ActiveContext, registry: ContentRegistry): boolean;
  start(state: GameState, ctx: ActiveContext): unknown[]; // queues decisions/effects
}

| { kind: 'UseSkillAction'; seatId: string; owner: AbilityOwner } // owner.kind === 'general'
```

- **Gathering.** `gatherAbilities` takes General abilities from revealed
  Generals. It also takes them from hidden ones, but only optional triggers,
  conversions and actives, and marks those `needsReveal`.
  - `AskUseEffect` with `needsReveal` labels its Use option "Reveal X to use
    Y" and queues `RevealGeneralEffect` first.
  - Legal `UseSkillAction`s and conversion actions from a hidden General
    queue the reveal before anything else.
- **Lord skills.** `lord` skills are never gathered in Guozhan. A mode
  declares `hasLord: false`.
- **Active skills.** An active skill is listed as one `UseSkillAction` while
  `canUse` holds and its turn count is below `usesPerTurn`. `start` returns
  effects that open the decisions it needs (selection, choice). The first
  decision is cancellable, which undoes the use: the count is spent only once
  the first decision is answered.

### Counters and marks

- `Turn.abilityUses?: Record<string, number>`, keyed `seatId/slot/skillId`.
  It resets with the turn, like `cardPlays`.
- `Turn.shaUsed?: boolean` is set whenever the turn owner plays or uses a
  Sha, responses included. Self-Restraint reads it.
- `Seat.marks?: Record<string, number>`, for game-long marks. No base
  General needs one yet; the expansions do.
- `IncrementEffect { scope: 'turn' | 'seat'; key; by }` changes them. It logs
  no event.

### New engine effects

- `LoseHpEffect { seatId, amount }`. It lowers HP, logs `HpLostEvent`, and
  starts the dying round when the seat is at 0 or below. It is the same path
  as damage's dying check, but without damage triggers.
- **Draw Phase becomes a step.** `DrawPhaseEffect { seatId, count }` replaces
  the hard-coded draw of 2.
  - Before-triggers can rewrite `count` (Bare the Chest −1, Brave Gesture +1)
    or replace the draw (Raid).
  - Guozhan queues it when the Draw Phase starts.
  - A `skipDraw` flag (Starvation) skips the phase, and with it this step.
- **Judgment becomes steps.** `JudgeEffect` from the Tools spec splits in
  three:
  1. `JudgmentShownEffect`: the card is turned up into `processing`.
     Judgment changers are asked here, in seat order from the judged seat.
  2. `JudgmentResolveEffect`: the delayed Tool's or skill's `onJudged` runs
     with the final card.
  3. `JudgmentDoneEffect`: the card goes to the discard pile unless a
     trigger took it (Heaven's Envy listens `before:` here).

  Skill judgments (Unyielding, Iron Cavalry, River Goddess, Eight Trigrams)
  use the same three steps, with an `onJudged` continuation given as plain
  data: `{ abilityOwner, abilityId, step }`.
- `ReplaceJudgmentEffect { withCardInstanceId }` moves the old card to the
  discard pile and the new card into `processing`.
- `RetargetStepEffect { newTarget }`, for Displace. It rewrites the pending
  Sha's remaining steps to the new target.
- `SkipPhaseFlag 'skipDiscard'` (Self-Restraint) works like `skipPlay` and
  `skipDraw`.
- **Moves.** Linked Camps and Armed Consorts listen `after:CardMovedEvent`
  using `fromZoneId` (Cards A spec). The draws come after the move finishes.

### New decisions

The choice from Tools stage 2 gains option kinds:

```ts
shows:
  | { kind: 'card'; card: CardInstance }
  | { kind: 'hidden-hand'; seatId: string; count: number }
  | { kind: 'seat'; seatId: string }
  | { kind: 'suit'; suit: Suit }
  | { kind: 'label'; text: string }   // Use / Don't / Done / "Discard 2 hand cards"
```

- **Choosing seats.** A multi-seat pick (Raid's 1–2, Sow Discord's two in
  order) is a series of seat choices. From the second pick on, the series
  offers Done when the rule allows fewer.
- **Arranging cards** (Astrology):

  ```ts
  pendingArrangement: { id; seatId; cardInstanceIds: string[] } | null;
  | { kind: 'ArrangeCardsAction'; seatId; arrangementId; top: string[]; bottom: string[] }
  ```

  `top` and `bottom` together must be exactly the given cards. `top[0]`
  becomes the top of the draw pile, and `bottom` goes under the pile in the
  order given. The cards are visible only to the arranging seat (redaction).
  `getLegalActions` returns an `ArrangeCardsAction` template, validated like
  a selection.
- **Giving cards** (Kindness, Bestowed Rouse) is a selection (`give-to`
  continuation) followed by a seat choice. Bestowed Rouse repeats until both
  drawn cards are given or the seat picks Done.

### Gender data

- **Data.** Each of the 57 General data files gains `gender: 'male' |
  'female'` and `source.genderFrom: "manual (standard character list)"`.
  Base females: Diao Chan, Huang Yueying, Zhen Ji, Da Qiao, Sun Shangxiang.
  The expansion files are set from the same list.
- **Model.** `GeneralDefinition` gains `gender`.
- **Query.** Content queries gain `seatGender(state, seatId, registry):
  'male' | 'female' | null`, by the common rule above.

### Placeholders

The placeholder skills in `generals/setOne.ts` and `setTwo.ts` are removed.
Skills move to one file per force (`generals/wei.ts`, `shu.ts`, `wu.ts`,
`qun.ts`), each exporting its Generals' skill sets. `generals/index.ts`
keeps the registry shape.

## Bots (rule-based)

- **Reveal to use:** reveal for a skill only when the use passes the rule
  below, and the bot's kingdom is already revealed or the bot holds at least
  4 HP.
- **Free may-skills:** always Use. That covers Evil Hero, Feedback, Heaven's
  Envy, Bestowed Rouse (keep both cards), Gathering Wisdom, Brave Gesture,
  Self-Restraint, River Goddess, Iron Cavalry, and Unyielding when the source
  is a non-ally.
- **Draw Phase:**
  - Raid when two non-allies hold hand cards.
  - Bare the Chest when holding 2 or more Sha.
- **Devil:** replace a judgment only when it saves the bot or an ally (from
  Lightning, Capture or Starvation) or hurts a non-ally. Use the
  lowest-ranked card that flips the outcome.
- **Astrology:** keep Peach, Shan and Sha on top. Everything else goes to the
  bottom.
- **Displace:** when holding a card to spare and a non-ally is in range.
- **Kindness:** give surplus cards (above 3 kept) to a revealed ally. Prefer
  reaching 2 given when hurt.
- **Battered Body:** while above 2 HP and holding a Peach, or above 3 HP.
- **Reconsider:** discard everything ranked below Shan. Never Peach.
- **Marriage, Green Vesicle:** when hurt, or when an ally is hurt.
- **Sow Revolt:** at the non-ally with the lowest HP.
- **Sow Discord:** pick a non-ally first, with the second male seat more
  likely to win (more HP). Never pick an ally first.
- **Name a suit:** the suit Zhou Yu showed least this game, otherwise ♥.
- **Gender Swords' target choice:** as in the Sha-Equipment spec.
- **Unyielding target's choice:** discard 2 when holding more than 3 hand
  cards, else take the damage when above 1 HP.

## UI

- **Avatar skill buttons.** Under each half of your split-portrait avatar
  (roadmap, stage 0b), one small button per active skill names it ("Kindness",
  "Reconsider"). It is enabled exactly when the engine lists its
  `UseSkillAction`. A hidden General's button reads "Reveal: Kindness". Other
  seats' halves show skill names only in the info popup.
- **Choice window** gains seat options (shown as seat names with force
  colour), suit options (♠ ♥ ♣ ♦) and labels.
- **Arrange window.** For Astrology: the cards in a row, each with Top and
  Bottom toggles and drag to reorder, and a Confirm button.
- **Ask window** (Sha-Equipment spec) shows the General's art for skill asks,
  with "Reveal X to use Y" wording when needed.
- **Conversions** reuse the Sha-Equipment chips: "As Sha · Fighting Saint".
- **Action History:**
  - "Hing revealed Guan Yu to use Fighting Saint"
  - "Seat 1 used Reconsider: discarded 3, drew 3"
  - "Seat 2's Devil changed the judgment to 3 ♠"
  - "Hing lost 1 HP (Battered Body)"
  - "Seat 1 named ♥ and took 7 ♠: 1 damage"
- **Wiki:** each General shows its gender. Lord skills show "Not used in
  Guozhan".

## Testing

- **Engine (stage 6):**
  - Gathering: revealed Generals; hidden Generals' optional skills only, with
    `needsReveal`; reveal before use; compulsory skills off while hidden;
    Lord skills never gathered.
  - `UseSkillAction`: offered while `canUse` and under `usesPerTurn`;
    cancelling the first decision leaves the count unspent.
  - `LoseHpEffect` and dying.
  - `DrawPhaseEffect` rewrite and replace.
  - The three judgment steps, replacement, and taking the judgment card.
  - `pendingArrangement` validation and redaction.
  - The new choice option kinds.
  - Serialisation of every new pending decision.
- **Content (stage 7):** one test per rule bullet per skill, including:
  - Matchless needing two Shan, with Eight Trigrams as one.
  - Matchless in a Duel.
  - Displace range after discarding a horse.
  - Kindness's heal only once per turn.
  - Armed Consorts on replace, on Steal and on a converted equipment card.
  - Linked Camps on playing, discarding and losing the last card to Steal.
  - Heaven's Envy after Lightning's damage.
  - Gender: Main, then Deputy, then none.
- **Bots:** each rule above.
- **App:** avatar skill buttons, seat and suit options, the Arrange window,
  the Ask window with reveal wording, and the new Action History lines.
- **Simulator:**
  - Seeded batches at 2, 5 and 10 seats, drawing only base Generals.
  - The batch includes a forced pairing per skill so each one fires at least
    once.
  - Invariants: cards are conserved, and a hidden General never fires a
    compulsory skill.

## Stage 7 rulings

Settled while building stage 7 (see its plan for the reasons):

- Self-Restraint is asked as the Discard Phase begins, only when there is something to discard.
- Matchless is a modifier; under it, Eight Trigrams may judge once for each Shan still owed.
- Lightning is discarded before its damage, so Evil Hero can take it.
- Feedback takes from the hand or the equipment, not the Judgment slot.
- A card used through a conversion as a delayed Tool lies in the Judgment slot as that Tool.
- Lord skills have definitions marked `lord: true` and nothing else.
- Base-only simulations run at 2 and 5 seats; 10 seats use the whole registry.
- Bots use Devil to save themselves or an ally only from Lightning, Capture or Starvation (as the Bots section says); Sima Yi with Zhen Ji could otherwise re-judge River Goddess without end.
