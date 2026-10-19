# Stage 9: The Fire Generals — Design Spec

Status: Draft for review

> Superseded in part: its "no elemental damage" decision is replaced by [Elemental Damage and Chains](2026-10-16-elemental-damage-and-chains-design.md) (2026-10-16).

Date: 2026-10-09

## Purpose

Give the 8 Fire Generals their real skills: Dian Wei, Xun Yu, Pang Tong,
Fire Zhuge Liang, Taishi Ci, Pang De, Yan Liang and Wen Chou, Yuan Shao. It
is the second of four expansion stages (roadmap stages 8–11), built on the
stage 6 skill engine and the stage 7–8 helpers.

## Common rules

Stage 7's and stage 8's common rules hold unchanged:
- reveal to use;
- gender;
- Lord skills inactive;
- losing HP is not damage;
- "may" always asks;
- no elemental damage (a skill that deals elemental damage deals plain damage).

The skill text is the crawled data's standard edition, applied to Kingdom
War.

**Cards out of the deck.** Blaze and Chains stay out of the deck (roadmap).
Blaze joins the registry only so that Fire Strategy can make one. Chains is
not added at all: Shackle keeps only its recast.

## Competing

Rouse the Tiger and Heaven's Justice make two seats compete:

1. The skill's user picks one of its hand cards face down.
2. The other seat then picks one of its own.
3. Both cards are shown to everyone, then discarded.
4. The user wins only with a strictly higher rank (A is 1, K is 13). A tie
   loses.

A seat with no hand card can't be chosen to compete, and the user needs a
hand card too.

## Several equal targets: one window

An effect whose targets are all **equal** (each suffers the same effect: a Sha
at several seats, or Chains linking two seats) has all its targets chosen in
**one window**. An effect whose seats play different roles (Coerce: whose
weapon, and whom it attacks) keeps its two-step menu.

- **One window.** When a card, or a card made by a conversion, may take more
  than one target now, its Play button opens a **"Choose Targets"** window
  rather than the one-seat menu. It lists every eligible seat, says how many
  to pick ("Choose up to 3 targets"), and plays the card on Confirm. A card
  limited to one target keeps today's one-click seat menu.
- **The window is the ask.** Picking more than one seat uses the skills or
  equipment that allowed it. They don't ask a separate question.
- **A Sha's maximum targets:**
  - 1;
  - +2 with Sky Scorcher, when the Sha is the user's last hand card (for a
    conversion: when the cards it uses are all of the user's hand);
  - +1 after a won Heaven's Justice.

  They add up: Taishi Ci wearing Sky Scorcher may pick up to 4 targets.
- **Eligible seats:** living seats other than the user that a Sha may target
  (not Zhuge Liang with an empty hand under Empty City), within attack range,
  or at any distance after a won Heaven's Justice.
- **One Sha, several targets.** It counts once toward the limit, and Wine
  spent on it adds 1 to the damage at each target. It goes through every step
  at each target separately, in seat order from its user: armour, Shan (and
  Eight Trigrams), hit, damage. A target that dies before its turn comes is
  skipped. Skills that act per target (Iron Cavalry, Strong Bow, Black Shield,
  Sudden Attack) act at each target on their own.
- **Any Sha counts,** whether a real card or one made by a conversion
  (Fighting Saint, Bewilder, Serpent Spear).
- **A Sha a skill makes from a choice of seat** (Godspeed) offers the same
  window when its maximum is above 1.
- **Sky Scorcher changes:** it no longer asks at the Sha's first step. Its
  extra targets are picked in the window (the stage 5 ask is removed).

## Rule text: the 8 Fire Generals

### Wei

- **Dian Wei: Assault** (active, once per turn). You either discard a weapon
  card (from your hand or equipment) or lose 1 HP. Then you deal 1 damage to
  a seat within your attack range (worked out after the discard). If losing
  the HP leaves you dying, the dying round comes first, and you deal the
  damage only if you survive.
- **Xun Yu: Rouse the Tiger** (active, once per turn). You compete with a seat
  that has more HP than you.
  - Win: you choose a seat within that seat's attack range (not the seat
    itself), and that seat deals 1 damage to it.
  - Lose: that seat deals 1 damage to you.
- **Xun Yu: Eternal Loyalty** (may, once per point of damage you take). You
  choose any living seat, yourself included. It draws until its hand size
  equals its max HP.

### Shu

- **Pang Tong: Shackle** (active, any number of times). You discard a club
  hand card and draw 1 card (Chains' recast).
- **Pang Tong: Nirvana** (may, once per game). When you would enter the dying
  round, you may instead:
  - discard every card you hold (hand, equipment, Judgment slot);
  - draw 3 cards;
  - recover to 3 HP (at most your max HP);
  - turn face up, if you are face down.
- **Fire Zhuge Liang: Eight Arrays** (compulsory). While you wear no armour,
  you have Eight Trigrams' ability. Black Pommel ignores it, as it ignores
  armour.
- **Fire Zhuge Liang: Fire Strategy** (conversion, Play Phase). Any red hand
  card as a **Blaze** (a Tool, made only this way):
  - It targets any living seat holding a hand card, you included, with the
    usual Wuxie check.
  - The target shows one of its hand cards, of its choice, to everyone.
  - You may then discard a hand card of the same suit to deal 1 plain damage
    to the target.
- **Fire Zhuge Liang: See Through** (conversion, answering). Any black hand
  card as a Wuxie.

### Wu

- **Taishi Ci: Heaven's Justice** (active, once per turn). You compete with
  any seat.
  - Win: for the rest of this turn you may use 1 more Sha, your Sha ignore
    distance, and each of your Sha may take 1 extra target, picked in the same
    window as its first (see "Several equal targets: one window").
  - Lose: you can't use a Sha for the rest of this turn.

### Qun

- **Pang De: Horsemanship** (compulsory). Your distance to every other seat is
  1 smaller, never below 1 (as Ma Chao's).
- **Pang De: Sudden Attack** (may). After a seat dodges your Sha (with a Shan,
  or with Eight Trigrams), you may discard one of its cards: its hand, as one
  face-down option, or a worn card.
- **Yan Liang and Wen Chou: Dueling Heroes** (may). In your Draw Phase,
  instead of drawing, you judge and take the judged card into your hand. For
  the rest of the turn, any hand card of the opposite colour to it can be used
  as a Duel.
- **Yuan Shao: Random Strike** (conversion, Play Phase). Any 2 hand cards of
  the same suit as a Hail of Arrows.
- **Yuan Shao: Bloodline.** A Lord skill, so it is inactive.

## Engine design

Generic; the engine names no card or skill.

1. **Several targets in one pick.**
   - `CardDefinition.targetPick?(state, ctx, registry): { eligibleIds; min; max } | null`.
     When it allows more than one target, the legal actions offer a single
     play template carrying that pick (`PlayCardAction.pickTargets`), rather
     than one action per target. `UseConversionAction` gets the same template.
   - `resolve` checks the submitted targets: only listed seats, no repeats,
     between `min` and `max`.
2. **Pair conversions.**
   - `Conversion.sameSuit?: true`. It is offered only when the seat holds
     enough cards of one suit.
   - Its selection carries `sameSuit`, and `validateSelection` rejects picks
     of mixed suits.
3. **Cards out of the deck.** `CardDefinition.outOfDeck?: true`. Kingdom War's
   deck builder skips it.
4. **`TurnFaceUpEffect { seatId }`**, the mirror of `TurnFaceDownEffect`
   (logs `SeatTurnedEvent` with `faceDown: false`).

Nothing else is new. Competing, once-per-game marks (`Seat.marks`), the
turn-long Sha rules and the judgment-replaced draw are built from existing
pieces.

## Content design

- **Files:** `generals/fire.ts` (`FIRE_GENERALS`, `FIRE_GENERAL_IDS`) and
  `cards/blaze.ts`.
- **Competing:** `shared/compete.ts`, a helper both skills use. It runs the
  user's pick, then the target's, then shows and discards both, then queues
  the skill's own step with the winner.
- **Turn-long Sha rules:** turn flags named for what they change: one more
  Sha, no distance limit, one extra target, no Sha. Content's Sha queries read
  them: the limit, the eligible seats and the maximum targets. Heaven's
  Justice sets them; a later skill may reuse them.
- **Sha's `targetPick`** works out eligible seats and the maximum (Sky
  Scorcher's +2 is read as a modifier of the worn card, not an ask).
- **Eight Trigrams' ability is shared** between the armour and Eight Arrays.
  The judgment reader is the worn card for one and the skill for the other.
- **Hooks:**

  | Skill | Hook |
  |---|---|
  | Sudden Attack | Pang De's Sha step after a dodge (`sha-dodged`) |
  | Eternal Loyalty | after damage, once per point |
  | Nirvana | the dying round, like Refusing Death, with a once-per-game mark |
  | Dueling Heroes | the Draw Phase step; turn flags for the judged colour, read by its Duel conversion |
  | Assault | active; its first pick is a weapon to discard, or none to lose 1 HP (cancellable); then a target in range |
  | Rouse the Tiger, Heaven's Justice | active: pick a seat (cancellable), then compete |
  | Shackle | active |
  | See Through, Fire Strategy | conversions |
  | Random Strike | a `sameSuit` conversion |
  | Pang De's Horsemanship | reuses Ma Chao's skill definition |

- **Test fillers.** The specs stop using real Generals as skill-less fillers.
  A shared test helper adds test-only filler Generals (no skills, one per
  kingdom, gender and HP needed) to the registry the specs build. They never
  reach the real registry, and stages 10 and 11 need no further swaps.

## Bots (rule-based)

- **Assault:** when a non-ally is in range. It pays with a spare weapon (one
  in hand for a slot already filled), else with 1 HP if it has 3 HP or more.
  It aims at the non-ally with the least HP.
- **Rouse the Tiger:** when holding a card ranked 10 or higher, and a non-ally
  with more HP has another non-ally in its attack range.
- **Heaven's Justice:** when holding 2 or more Sha and a card ranked 10 or
  higher.
- **Choosing several targets:** non-allies, weakest first, up to the maximum.
- **Competing:** the user plays its highest card. A target plays its highest
  against a non-ally and its lowest against an ally.
- **Eternal Loyalty:** always. It picks itself, unless an ally is further short
  of its max HP in cards.
- **Shackle:** recasts clubs ranked below Shan, never a Peach.
- **Nirvana, Eight Arrays:** always. **Sudden Attack:** always, on a non-ally.
- **Fire Strategy:** Blaze at the non-ally with the least HP while holding 3 or
  more hand cards. It discards a matching card when it has one. As a Blaze
  target, it shows its least useful card.
- **See Through:** as the bot's Wuxie rule (cancel only harmful Tools aimed at
  itself), never spending a Peach.
- **Dueling Heroes:** when a non-ally exists and it holds 3 or more hand cards.
- **Random Strike:** as Hail of Arrows (non-allies at least as many as
  allies), with the two least useful same-suit cards, never a Peach.

## UI

- **Competing:**
  - The selection asks "Choose a hand card to compete with".
  - History: "Seat 1 competed with Seat 2: 9 ♠ against 7 ♥, Seat 1 won".
- **Blaze:**
  - The target is asked "Choose a hand card to show".
  - The user is asked "Discard a card of the same suit to deal 1 damage";
    Cancel means don't.
- **History lines** for Nirvana, Assault, Heaven's Justice's win or loss, and
  Dueling Heroes' colour.
- **Choose Targets window:** "Choose up to N targets", seat buttons, Confirm
  plays the card (Cancel goes back). Conversions ask for targets first, then
  the cards.
- **Wiki:** the Fire Generals show as in play.
- **Text** follows CLAUDE.md's UI text style.

## Testing

- **Engine:** same-suit selections; a card out of the deck; `TurnFaceUpEffect`;
  serialisation.
- **Content:** one test per rule bullet, including:
  - a competing tie loses;
  - Assault's range after the weapon is discarded;
  - Nirvana only once per game;
  - Heaven's Justice's win and loss;
  - Dueling Heroes' opposite colour;
  - Random Strike's same suit;
  - Blaze with and without a match;
  - See Through in a Wuxie check;
  - Eight Arrays off with armour worn, and ignored by Black Pommel.
- **Several targets:**
  - the one-target menu when the maximum is 1, the template when it is more;
  - submitted targets checked (unlisted, repeated, too many rejected);
  - Heaven's Justice's extra target at any distance;
  - Sky Scorcher and Heaven's Justice together (up to 4 targets);
  - a Sha made by a conversion taking extra targets;
  - each target dodging or not on its own;
  - one Sha counted once.
- **Fillers:** existing specs use the test-only fillers; a check that no filler
  is in the real registry.
- **Bots:** each rule above.
- **Simulator:**
  - Base, Wind and Fire Generals only (41 Generals, so up to 8 seats), at 2, 5
    and 8 seats.
  - A forced pairing per Fire General, with every skill that leaves a trace
    fired.
- **App:** the competing and Blaze prompts, the Choose Targets window, and the
  new history lines.

## Rulings made while building

- **Godspeed's Sha keeps its one-seat choice.** Its maximum is always 1
  (Xiahou Yuan can't pair with Taishi Ci, and it has no physical card to be a
  last hand card), so the window has nothing to offer.
- **Sky Scorcher's +2 for a conversion** applies only to a conversion taken
  from the hand alone, when the hand holds exactly the cards it takes (targets
  are picked before the cards).
- **Same suit is the printed suit** for Random Strike (the engine checks it;
  Yuan Shao can't pair with Beauty's holder).
- **Competing is content**, run as the owning skill's steps; its history is
  one line in place of the two "showed" lines.
- **Blaze is in the wiki's game cards** (usable via Fire Strategy), never
  dealt.
- **Bots** measure reach round the table plus a worn Weapon's range (they
  don't read content's distance rules); Heaven's Justice competes with the
  weakest non-ally holding a card; Sudden Attack takes a worn card before the
  hidden hand.
- **An untargeted conversion** (Random Strike's Hail of Arrows) is one button
  used at once.

