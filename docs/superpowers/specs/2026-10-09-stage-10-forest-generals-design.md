# Stage 10: The Forest Generals — Design Spec

Status: Built
Date: 2026-10-09

## Purpose

Give the 8 Forest Generals their real skills: Xu Huang, Cao Pi, Meng Huo,
Zhu Rong, Sun Jian, Lu Su, Dong Zhuo and Jia Xu. It is the third of four
expansion stages (roadmap stages 8–11), built on the stage 6 skill engine and
the stage 7–9 helpers. (The brainstorm said "10 Generals" in error; the crawled
data holds 8 Forest Generals with 17 skills, 2 of them Lord skills.)

## Common rules

Stage 7's, 8's and 9's common rules hold unchanged:
- reveal to use;
- gender;
- Lord skills inactive;
- losing HP is not damage;
- "may" always asks;
- no elemental damage;
- synthetic `filler-<id>` Generals in the specs.

The skill text is the crawled data's standard edition, applied to Kingdom War.
In that text, "Escape" is Shan, "Barbarians" is the Barbarians Tool, "flip
character card" is turning the seat face down, or face up if it is already
down, and "hand" or "cards" mean hand cards unless a zone is named.

**Lord skills.** Violent Tyrant (Dong Zhuo) and Exaltation (Cao Pi) are Lord
skills, so they are inactive. The wiki shows them with "Not used in Kingdom
War".

## Rule text: the Forest Generals

### Wei

- **Xu Huang: Blockade** (conversion, Play Phase; compulsory part: range).
  - Any black Basic or Equipment hand card can be used as Starvation.
  - Your range for using Starvation is 1 more than usual (it reaches distance
    2, or 1 more with a Tool-range effect).
- **Cao Pi: Unnatural Death** (may). When another seat dies, you may take all
  its cards (hand, equipment and Judgment slot) into your hand instead of
  letting them be discarded.
- **Cao Pi: Exile** (may, once per damage event). After you take damage, you
  may choose any other living seat. It turns over (face down, or face up if it
  was down), then draws X cards, where X is your max HP minus your current HP
  after the damage (a face-down seat draws as well).
- **Cao Pi: Exaltation.** A Lord skill, so it is inactive.

### Shu

- **Meng Huo: Culprit** (compulsory).
  - Barbarians has no effect on you (it skips you).
  - Damage dealt by another seat's Barbarians counts as dealt by you.
- **Meng Huo: Resurgence** (may). In your Draw Phase, if you are below max HP,
  you may skip drawing. You reveal the top X cards of the draw pile, X being
  the HP you are missing. Each heart you recover 1 HP (at most your max HP),
  and the hearts are discarded. The other cards go into your hand.
- **Zhu Rong: Giant Elephant** (compulsory). Barbarians used by another seat
  has no effect on you. After it finishes resolving, you take that card into
  your hand.
- **Zhu Rong: Intense Edge** (may). When your Sha deals damage to another
  seat, you may compete with it (see Competing). If you win, you take one of
  its cards into your hand: a hidden hand card, or any worn or Judgment slot
  card (as Steal's pick). You need a hand card, and so does it.

### Wu

- **Sun Jian: Brave Spirit** (may). At the start of your Prepare Phase, if you
  are damaged, you may choose any seat (yourself included) and set X to the HP
  you are missing. It picks one:
  - draw X cards, then discard 1;
  - draw 1 card, then discard X.
- **Lu Su: Charity** (may). In your Draw Phase you may draw 2 extra cards.
  Afterwards, if you hold more than 5 hand cards, you give half of them
  (rounded down) to the seat with the fewest hand cards, other than you. If
  seats tie, you choose among them.
- **Lu Su: Alliance** (active, once per turn). Choose two other seats with
  different numbers of hand cards. You discard X cards (hand or equipment), X
  being the difference. They then swap their hands. Seats you can't pay for
  are not offered. Equal hands cost X = 0, so they are never offered (nothing
  would change).

### Qun

- **Dong Zhuo: Wine** (conversion, Play Phase and answering). Any spade hand
  card as Wine, including to rescue yourself.
- **Dong Zhuo: Garden of Lust** (compulsory). When your Sha targets a female
  seat, or a female seat's Sha targets you, the target needs two Shan to
  dodge it. A seat with no gender is not female.
- **Dong Zhuo: Collapse** (compulsory). At the end of your turn, if your HP is
  strictly higher than every other living seat's, you choose one: lose 1 HP, or
  reduce your max HP by 1 (HP above the new max drops to it; max HP at 0 or
  below eliminates you).
- **Dong Zhuo: Violent Tyrant.** A Lord skill, so it is inactive.
- **Jia Xu: Complete Kill** (compulsory). In your turn, only you and the dying
  seat can use Peach (cards or conversions into Peach). It applies to the
  dying round and to the Play Phase.
- **Jia Xu: Upheaval** (active, Play Phase, once per game). Every other living
  seat, in seat order from the one after you, may use a Sha on any seat within
  its own attack range (the Sha limit is ignored, and conversions work). A seat
  that doesn't, can't (no Sha, or no seat in range) or passes loses 1 HP. A seat
  that has died in the meantime is skipped.
- **Jia Xu: Curtain** (compulsory). You can't be targeted by black Tools: a
  Tool as used (a card, or a conversion whose cards are black) can't name you,
  and an area Tool of that kind skips you.

## Competing

The same helper as stage 9 (`shared/compete.ts`): the user picks a hand card
face down, the other picks one, both are shown and discarded, the user wins
with a strictly higher rank and a tie loses. Intense Edge's own step runs with
the winner.

## Engine design

Generic; the engine names no card or skill.

1. **Draw Phase replacement with a reveal.** Resurgence uses the same
   before-trigger replacement as Dueling Heroes. It needs one helper, a reveal
   of the top X cards of the draw pile into `processing` (logged to everyone),
   from which the skill's step moves hearts to the discard and the rest to the
   hand. If an equivalent top-N helper exists from Astrology, reuse it.
2. **Draw Phase count.** Charity is a before-trigger adding 2 to the
   `DrawPhaseEffect` count (as Brave Gesture does), plus a seat mark so that an
   after-trigger gives half of the hand afterwards.
3. **Death hook.** Unnatural Death needs a trigger point before the death
   discard of an eliminated seat's cards: `before:SeatEliminatedEffect` (or its
   current name), whose effect may move the cards instead. The moved cards must
   not also be discarded.
4. **Damage source rewrite.** A before-trigger on the damage effect may set its
   source (Culprit), as Bare the Chest rewrites a count. The rewritten source
   counts for everything that reads it.
5. **`ReduceMaxHpEffect { seatId, amount }`** (if not already present): lowers
   max HP, clamps HP, and eliminates the seat at 0 max HP.
6. **Modifiers** (read by content queries; the engine never reads them):
   - `rangeBonusFor?: Record<cardId, number>` (Blockade: `{ starvation: 1 }`);
   - `untargetableByBlackTools?: true` (Curtain);
   - `peachOnlyOwnerAndDying?: true` (Complete Kill, read on the turn owner);
   - `doubleAnswersWithFemale?: true` (Garden of Lust).
7. **A forced Sha window with a free target** (Upheaval). Built on Coerce's
   forced-Sha window, but with the seat choosing the target. If Coerce's window
   has the victim baked in, it is generalised to a set of eligible seats. Pass
   or no legal Sha loses 1 HP.

## Content design

- **Files:** `generals/forest.ts` (`FOREST_GENERALS`, `FOREST_GENERAL_IDS`).
- **Competing:** `shared/compete.ts`, as stage 9.
- **Peach lock:** a content query `peachBlockedFor(state, seatId, registry)`,
  read by Peach's `canPlay`, by the dying round's offer of Peach, and by
  conversions that make Peach.
- **Targeting:** Curtain's check lives in content's Tool targeting query, next
  to Wood Armor's `untargetableBy`.
- **Garden of Lust:** Sha's Shan count reads `doubleAnswersWithFemale` through a
  content query on both the user and the target, with `seatGender`.
- **Hooks:**

  | Skill | Hook |
  |---|---|
  | Blockade | a conversion (black Basic or Equipment, hand, as Starvation) plus `rangeBonusFor` |
  | Unnatural Death | before the death discard |
  | Exile | after damage, once per damage event |
  | Culprit | `untargetableBy: ['barbarians']` plus a before-damage source rewrite |
  | Resurgence | the Draw Phase step, with a reveal of the top cards |
  | Giant Elephant | `untargetableBy: ['barbarians']` plus an after-Tool trigger that takes the card |
  | Intense Edge | after damage dealt by her Sha; competing; a Steal-style pick |
  | Brave Spirit | the start of her Prepare Phase |
  | Charity | the Draw Phase count, then after the phase |
  | Alliance | active: two seats (cancellable), then the discard, then the swap |
  | Wine | a conversion, `when: 'both'` |
  | Collapse | the end of her turn |
  | Complete Kill, Curtain, Garden of Lust | modifiers |
  | Upheaval | active, once per game via `Seat.marks`; the forced Sha window per seat |

## Bots (rule-based)

- **Blockade:** as for the real Starvation, with black Basic or Equipment cards
  it would not need, never a Peach.
- **Unnatural Death:** always. **Exile:** always, on the non-ally with the
  fewest cards (an ally with a face-down turn is preferred if it is the only
  choice that helps).
- **Resurgence:** when missing 2 or more HP. **Intense Edge:** when it holds a
  card ranked 9 or higher.
- **Brave Spirit:** always; it picks an ally if one needs cards, else itself.
  As the target, it chooses "draw X, discard 1" if X is 2 or less, else "draw
  1, discard X" only when it holds spare cards.
- **Charity:** when it holds 3 or fewer cards. It gives to the lowest-hand seat,
  preferring an ally in a tie.
- **Alliance:** when it can swap a non-ally's larger hand into an ally's smaller
  one (or its own smaller hand with another seat's larger one) at a cost of 2 or
  less.
- **Wine (Dong Zhuo):** as the bot's Wine rule. **Collapse:** it loses 1 HP
  unless that would leave it at 1 HP or less, else it reduces max HP.
- **Upheaval:** when 3 or more other seats are non-allies. As a seat asked to
  Sha, it targets the weakest non-ally in range, else loses the HP (it never
  Shas an ally).

## UI

- **Resurgence:** the revealed cards are listed in the history.
- **Alliance:** two seat picks, then "Discard N cards" through the existing
  selection.
- **Charity:** the give-half step is a selection, then a seat choice if tied.
- **Upheaval:** the asked seat sees "Use a Sha on any seat in range" with a
  Pass button that costs HP, labelled "Pass (lose 1 HP)".
- **Collapse:** a choice of "Lose 1 HP" or "Reduce max HP".
- **History lines** for each skill, in the stage 9 style.
- **Wiki:** the Forest Generals show as in play, and the two Lord skills with
  "Not used in Kingdom War".
- **Text** follows CLAUDE.md's UI text style.

## Testing

- **Engine:** `ReduceMaxHpEffect`; the death hook order; the damage source
  rewrite; the top-N reveal; serialisation.
- **Content:** one test per rule bullet, including:
  - Blockade at distance 2 and not at 3;
  - Unnatural Death takes hand, equipment and Judgment cards;
  - Exile on a face-down seat turns it face up;
  - Culprit as the source, and Barbarians skipping Meng Huo;
  - Resurgence with all hearts, no hearts, and a full-HP seat (not offered);
  - Giant Elephant takes the card only after the Tool finishes;
  - Intense Edge's tie loses;
  - Brave Spirit both options;
  - Charity at exactly 5 cards (no give) and 7 cards (gives 3);
  - Alliance cost X and the affordable-only offer;
  - Garden of Lust both directions and a no-gender seat;
  - Collapse at a tie (no trigger);
  - Complete Kill in a dying round, and Jia Xu's own Peach;
  - Upheaval once per game, a seat with no Sha, a seat that dies mid-round;
  - Curtain against a black Tool, a red Tool and a black conversion.
- **Bots:** each rule above.
- **Simulator:**
  - Base, Wind, Fire and Forest Generals (49 Generals, so up to 8 seats at
    2, 5 and 8 seats);
  - a forced pairing per Forest General, with every skill that leaves a trace
    fired.
- **App:** the Upheaval prompt, Collapse choice, and the new history lines.

## Rulings to confirm in review

These are my best readings of ambiguous crawled text:

1. **Culprit's second half** follows the printed standard-edition rule:
   damage from another seat's Barbarians counts as Meng Huo's. The crawled
   wording ("any damage it causes") could also be read as no change.
2. **Brave Spirit's target** is any seat, Sun Jian included, as the crawled
   "any player" says.
3. **Exile** fires once per damage event, not once per point (unlike Eternal
   Loyalty, whose text says so).
4. **Alliance** takes two other seats, never Lu Su.
5. **Garden of Lust** covers Sha only, not Duel.
6. **Unnatural Death** takes the Judgment slot cards too.

## Rulings made while building

- **Upheaval asks the target first, then opens a Sha window.** Each seat picks a
  seat in its range (or "Pass (Lose 1 HP)"), then a response window asks for the
  Sha, real or converted. A seat with a target but no Sha presses Pass; only a
  seat with nothing in range loses the HP at once.
- **Unnatural Death is a before-trigger on the dead seat's `DiscardZoneEffect`**,
  not a new death hook (`DiscardZoneEffect.acted`).
- **Giant Elephant needs `ToolResolvedEffect`**, queued behind a played Tool,
  because a used card is in the discard pile at once.
- **Complete Kill filters the dying round's order**, not Peach plays.
- **Curtain is a modifier plus a backstop trigger** on `ToolOnTargetEffect`.
- **Blockade's +1 range counts only while Xu Huang is revealed.**
- **Resurgence's hearts are the printed suit** of the revealed card.
- **Culprit logs its rewrite** (`culprit`) so the history can say the damage
  counts as Meng Huo's.
- **Alliance logs two events** (`swap-first`, `swapped`) so the history reads
  "A and B swapped hands".
