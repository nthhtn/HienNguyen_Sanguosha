# Stage 8: The Wind Generals — Design Spec

Status: Draft for review

> Superseded in part: its "no elemental damage" decision is replaced by [Elemental Damage and Chains](2026-10-16-elemental-damage-and-chains-design.md) (2026-10-16).

Date: 2026-10-07

## Purpose

Give the 8 Wind Generals their real skills, on the stage 6 skill engine and
the stage 7 helpers. It is the first of four expansion stages, one per pack:

| # | Stage | Generals |
|---|---|---|
| 8 | Wind | Cao Ren, Xiahou Yuan, Huang Zhong, Wei Yan, Xiao Qiao, Zhou Tai, Zhang Jiao, Yu Ji |
| 9 | Fire | Dian Wei, Xun Yu, Pang Tong, Fire Zhuge Liang, Taishi Ci, Pang De, Yan Liang and Wen Chou, Yuan Shao |
| 10 | Forest | Xu Huang, Cao Pi, Meng Huo, Zhu Rong, Sun Jian, Lu Su, Dong Zhuo, Jia Xu |
| 11 | Mountain | Zhang He, Deng Ai, Jiang Wei, Liu Shan, Sun Ce, Zhang Zhao and Zhang Hong, Zuo Ci, Cai Wenji |

Each stage gets its own spec and plan, written just before it is built, and
builds only the engine pieces its own Generals need. Each ends green: all
tests pass, and seeded simulations run to completion.

## Common rules

Stage 7's common rules hold unchanged (General Skills spec, "Common rules"):
reveal to use, gender, Lord skills inactive, losing HP is not damage. The
roadmap's decisions hold too: "may" always asks; no elemental damage; the
term is Tool.

- **Source.** The crawled data's standard-edition skill text, applied to
  Kingdom War, as in stage 7. "You" is the seat holding the General.
- **No elemental damage.** A skill that deals lightning or fire damage deals
  plain damage instead (as the Lightning card did).
  Note: Lightning Strike now deals thunder damage, like the Lightning card's
  strike (see the elemental spec).

## Rule text: the 8 Wind Generals

### Wei

- **Cao Ren: Entrench** (may). At the start of your End Phase (after your
  Discard Phase), you may turn your seat face down and draw 3 cards.
  - **Face down.** When a face-down seat's turn would start, it turns face up
    instead and the turn passes to the next seat. Nothing else changes: a
    face-down seat can still be targeted and still answers and uses skills.
- **Xiahou Yuan: Godspeed** (may; each option at most once per turn; both may
  be used in one turn).
  1. As your Judgment Phase begins, you may skip your Judgment and Draw
     Phases. If you do, you use a Sha on any seat a Sha may target, ignoring
     distance.
  2. As your Play Phase begins, you may skip it and discard an Equipment card
     from your hand or equipment. If you do, you use a Sha the same way.

  These Sha have no physical card, don't count toward the Sha limit and don't
  spend Wine.

### Shu

- **Huang Zhong: Strong Bow** (may). In your turn, after your Sha targets a
  seat, if that seat's hand size is at least your HP, or at most your attack
  range, you may make the Sha unblockable: no Shan is asked for, and Eight
  Trigrams doesn't judge (as Iron Cavalry's red judgment).
- **Wei Yan: Violent Spirit** (compulsory). After you deal damage to a seat
  within your attack range (measured after the damage), you recover 1 HP for
  each point dealt.

### Wu

- **Xiao Qiao: Fantasy** (may). When damage would be dealt to you, you may
  discard a heart card to move the damage onto another living seat. It keeps
  its source, amount and cause. After it is dealt, that seat draws as many
  cards as it is missing HP.
- **Xiao Qiao: Beauty** (compulsory). Your spades count as hearts. That covers
  your hand, worn and judgment cards wherever a rule reads a suit: your
  judgments, Fantasy's cost, and conversions.
- **Zhou Tai: Refusing Death** (may).
  - When you would enter the dying round, you may turn the top card of the
    draw pile face up and put it under your General. Then, for each further
    point of HP the same drop took below 1, you may do so again.
  - If a card you put there matches the rank of one already there, you go
    through the dying round as normal.
  - Otherwise you stay alive below 0 HP, and no dying round starts.
  - Each time you recover HP, you may discard one of those cards.
  - The cards are public. They are discarded if you are eliminated.

### Qun

- **Zhang Jiao: Lightning Strike** (may). After you play or use a Shan, you
  may choose any living seat. It judges: on a spade it takes 2 thunder damage
  with no source (it passes along a chain).
- **Zhang Jiao: Dark Magic** (may). When any seat's judgment card is turned
  up, before it takes effect, you may replace it with a black card from your
  hand or equipment. The old judgment card goes into your hand. Judgment
  changers (Devil, Dark Magic) are asked in seat order from the judged seat;
  after a replacement, from the seat after the one that replaced it.
- **Zhang Jiao: Amber Sky.** A Lord skill, so it is inactive.
- **Yu Ji: Bewilder** (in your Play Phase, and to answer a window).
  1. You pick any card from your hand face down and name a Basic or
     non-delayed Tool card it stands for (with its targets, for a play). You
     can only name a card you could legally use now.
  2. Every other living seat, in turn order from you, says Believe or Doubt.
  3. The card is turned face up.
     - **Nobody doubted:** it takes effect as the card named.
     - **Someone doubted, and you lied** (it isn't the card named): each
       doubter draws 1 card. The card is discarded.
     - **Someone doubted, and you told the truth:** each doubter loses 1 HP.
       The card takes effect only if it is a heart; otherwise it is discarded.

  A Bewilder card that takes effect counts as the card named in every way:
  the Sha limit, Wuxie checks, answering.

## Engine design

Generic; the engine names no card or skill.

1. **Face-down seats.** `Seat.faceDown?: boolean`, set by
   `TurnFaceDownEffect { seatId }`. When a face-down seat's turn would start,
   it turns face up (`SeatTurnedEvent { seatId, faceDown: false }`) and the
   turn passes to the next seat.
2. **A pile under each seat.** A face-up zone kind `pile`, one per seat
   (`${seatId}:pile`), created by the mode. Kingdom War discards it with the
   rest when a seat is eliminated.
3. **A Play Phase skipped mid-phase ends at once**, as a Discard Phase does
   (`discardOwed`): `phaseWaitsForPlayer` is false for a phase whose skip flag
   is set.
4. **Dying round.**
   - `DyingEffect.acted?: string[]`: abilities that had their say on entering.
   - `DyingEffect.pointsBelowOne?: number`: how many points of HP the drop
     took below 1, set by the mode on entering.
5. **Replacing a judgment.** `ReplaceJudgmentEffect.oldTo?: string`: the zone
   the replaced card goes to (default the discard pile).
6. **Deferred conversions.**
   - `Conversion.deferred?: true`: the picked card isn't used at once. It goes
     to a `SkillStepEffect` of the owning skill, whose data holds the picked
     id, the card it counts as, the targets and the window it answers.
   - `UseCardEffect.respondTo?: string`: uses the card as the answer to that
     window.
7. **Wuxie through a conversion.** A Wuxie check asks a seat holding no Wuxie
   when one of its conversions could make one.
8. **Conversion filters see their seat.** `Conversion.accepts(card, state,
   seatId)`.

## Content design

- **File:** `generals/wind.ts`, exporting `WIND_GENERALS`.
- **Suits.** `suitOf(state, seatId, card, registry)` applies suit modifiers
  (`AbilityModifiers.suitAs?: Partial<Record<Suit, Suit>>`; Beauty is
  `{ spade: 'heart' }`). Every rule that reads the suit of a seat's own card
  or judgment uses it: delayed Tools' and skills' judgment readers, Eight
  Trigrams, Fantasy, conversions.
- **Bewilder** is a deferred conversion per Basic and non-delayed Tool card.
  Its step runs the doubt choices, reveals the card (`ShowCardEffect`), then
  uses it (`UseCardEffect`) or discards it.
- **Godspeed** is two asks, at the Judgment Phase's and the Play Phase's
  start. Each sets skip flags and uses a Sha with no physical card at a seat
  the Sha may target, ignoring distance.
- **Dark Magic** joins `JUDGMENT_CHANGERS`.
- **The rest use existing hooks:**
  - Strong Bow: `atStep('sha-targeted')`;
  - Violent Spirit: `after:DamageDealtEvent`;
  - Fantasy: `before:DamageEffect` (move the damage, then draw);
  - Entrench: `after:PhaseChangedEvent` End;
  - Refusing Death: `before:DyingEffect`.

## Bots (rule-based)

- **Entrench:** with 2 or fewer cards in hand, at 3 HP or more, and no hurt
  revealed ally.
- **Godspeed:**
  - Option 1 when no delayed Tool waits in its Judgment slot and a non-ally
    within any distance has 2 HP or less.
  - Option 2 when it holds an Equipment card it can spare (one that would
    replace nothing it wants, or a duplicate slot) and no other card play is
    left.
  - Target: the non-ally with the least HP.
- **Strong Bow:** always, on a non-ally.
- **Fantasy:** when holding a heart other than a Peach (spades count) and the
  damage would leave it at 2 HP or less. The damage goes to the non-ally with
  the least HP.
- **Refusing Death:** always.
- **Lightning Strike:** at the non-ally with the least HP.
- **Dark Magic:** by Devil's rule (save itself or an ally from Lightning,
  Capture or Starvation, or hurt a non-ally), with the least useful black card
  that flips the outcome.
- **Bewilder, as Yu Ji:** names only what the card truly is, unless it holds
  more than 4 cards, when it may bluff with its least useful card. Prefers
  true claims on hearts.
- **Believe or Doubt:** an ally believes. A non-ally doubts when it holds
  3 HP or more and the named card is a Sha, Peach or Wuxie; otherwise it
  believes.

## UI

- **Seat tile:** a "Face Down" badge with dimmed portraits; the pile as a row
  of small face-up cards under the avatar.
- **Doubt:** the choice window, titled "Bewilder": "Seat 2 claims Sha. Believe
  or doubt?", with **Believe** and **Doubt** buttons.
- **Naming:** for Yu Ji, a choice of card names, then targets.
- **Action History:**
  - "Seat 1 turned face down" / "Seat 1 turned face up and passed the turn"
  - "Seat 1's Refusing Death: 7 ♠ (no match)" / "… 7 ♠ matched"
  - "Seat 2 doubted Seat 1's Sha: it was true"
  - "Seat 1's Fantasy moved the damage to Seat 3"
- **Wiki:** the Wind Generals show as in play.
- **Text** follows CLAUDE.md's UI text style.

## Testing

- **Engine:**
  - face-down turn skipping;
  - the pile zone, and its discard on elimination;
  - a Play Phase skipped mid-phase;
  - `DyingEffect.acted` and `pointsBelowOne`;
  - `ReplaceJudgmentEffect.oldTo`;
  - deferred conversions, answering included;
  - Wuxie through a conversion;
  - serialisation of every new piece.
- **Content:** one test per rule bullet per skill, including:
  - Zhou Tai: a duplicate rank; two points below 1 turning two cards; a heal
    discarding one;
  - Beauty on her judgments and on Fantasy's cost;
  - Bewilder believed; doubted and true on a heart; doubted and true on a
    non-heart; doubted and false; used as an answer;
  - Godspeed with both options in one turn;
  - Dark Magic ordered with Devil.
- **Bots:** each rule above.
- **Simulator:**
  - Seeded batches with base and Wind Generals only, at 2, 4 and 6 seats
    (33 Generals seat at most 6).
  - A forced pairing per Wind General, with every skill that leaves a trace
    fired.
  - The existing invariants; "living at 0 HP or below" allows a seat kept
    alive by Refusing Death.
- **App:** the face-down badge, the pile row, the doubt and naming dialogs, and
  the new Action History lines.

## Stage 8 rulings

- Godspeed's first option is asked as the Start Phase begins: Kingdom War judges delayed Tools on entering the Judgment Phase. Its second option ends the Play Phase with its own flag (`endFlagOf('Play')`), so a skip flag keeps meaning "skip on entry".
- Bewilder has no naming dialog: each nameable card is a conversion button ("As Sha · Bewilder"), with its targets.
- While Bewilder answers a window, the window is set aside and then answered or re-opened.
- Every suit rule reads `suitOf`, so Beauty reaches the delayed Tools and Eight Trigrams. A used card's colour (as armour sees it) is unchanged by Beauty.
- Refusing Death asks once per card; declining a later card lets the dying round go ahead.
- The Discard Phase owes what was over the limit as it began, so Linked Camps with Refusing Death at 0 HP doesn't loop.
- A seat kept alive below 1 HP by Refusing Death isn't shown as dying.
