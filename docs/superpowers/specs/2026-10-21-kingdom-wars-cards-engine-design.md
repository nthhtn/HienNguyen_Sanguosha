# Kingdom Wars Cards in the Engine (Design)

Date: 2026-10-21. Status: draft for the user's approval. Builds on the
Kingdom Wars deck data (`2026-10-20-kingdom-wars-deck-crawl-design.md`), the deck
choice (`plans/2026-10-21-deck-choice.md`) and the Wiki text and art for these
cards (done 2026-10-21).

## Intent and why

The Kingdom Wars deck lists six cards Dynasty Wars does not have: Wuxie Kingdom,
Amass, Ascertain, Ally Far Attack Near (Tools) and Six Swords of Wu, Trident
Glaive (Weapons). Today the deal leaves them out (`undealtCardIds`), so an
Kingdom Wars game has 98 cards instead of the deck's 108 and the Wiki marks them
"Not in the game yet". This step gives each a definition and behaviour in the
engine/content, so they are dealt and playable. The user treats all six as
equally important.

## Goals

- All six cards have registered behaviour, are dealt in the Kingdom Wars deck, and
  are playable by humans and legal-action driven bots under the rules below.
- The Wiki marks them In game (it already derives that from the registry).
- Names show correctly in the game UI in English and Vietnamese, with the card
  art already in the assets.
- Dynasty Wars games are unchanged: none of the six is in the Dynasty Wars deck.

## Non-goals and anti-goals

- No new Generals, skills or Kingdom Wars skill effects.
- Bots need only to play legally and not crash on the new cards; smart use is
  not required (my call; the bots layer is not part of this request).
- Anti-goals: a central switch over card ids; rule logic in Angular
  components; Dynasty Wars' behaviour changing; Wuxie Kingdom cancelling what it
  may not.

## Names

Wuxie Kingdom (`wuxie-guo`, 无懈可击•国), Amass (`amass`, 以逸待劳), Ascertain
(`ascertain`, 知己知彼), Ally Far Attack Near (`ally-far-attack-near`, 远交近攻),
Six Swords of Wu (`wu-six-swords`, 吴六剑), Trident Glaive (`trident-glaive`,
三尖两刃刀). English text is in `decks/kingdom-wars/texts.en.json`, Vietnamese
names and drafts in `locales/vi/kingdom-wars-cards.json`.

## Rules (all confirmed by the user, 2026-10-21)

"Kingdom" is a seat's revealed force (Wei, Shu, Wu, Qun). A seat with both
Generals hidden has no Kingdom.

### Wuxie Kingdom (Tool, response only, like Wuxie)

When a Tool is about to take effect on a player whose General is exposed, a
Wuxie Kingdom player can cancel it for every player of that Kingdom that the
Tool has not yet affected (the player it is about to affect and the later
targets in the Tool's order who share the Kingdom). It cannot be used against
a player whose Generals are both hidden. It can be answered by another Wuxie
or Wuxie Kingdom, like a Wuxie, and it can itself be used to cancel another
Wuxie, which then acts as a plain Wuxie (a Wuxie has no Kingdom).
A plain Wuxie also answers a Wuxie Kingdom. *(The last two sentences are my
reading of "like a normal Wuxie"; flagged for checking.)*

### Amass (Tool, Play Phase)

Use it on yourself and every other player of your Kingdom. Each target in
turn order, starting with you, draws 2 cards and then discards 2 cards (from
hand or equipment). Each target finishes before the next starts. Each target
can be cancelled by a Wuxie on its own, as with Peach Garden. If the user has
no exposed General, Amass targets the user alone.

### Ascertain (Tool, Play Phase)

Use it on another player and choose one of two options:

1. Look at one of their hidden General cards (the user picks which if both are
   hidden).
2. Look at all of their hand cards.

If both their Generals are exposed, only option 2 is allowed, even with an
empty hand. A Wuxie cancels it. Only the user sees what they looked at; other
seats see only that Ascertain was used.

Recast: instead of using it, put it into the discard pile and draw 1 card.
This is neither using nor discarding, so skills reacting to either do not
trigger. It reuses Chains' existing Recast (`isRecast`, a play with no
target, no Wuxie check).

### Ally Far Attack Near (Tool, Play Phase)

Use it on one other player whose General is exposed and whose Kingdom differs
from the user's. The target draws 1 card, then the user draws 3. One Wuxie
cancels both draws (one target). If the user has no exposed General (no
Kingdom), any other player with an exposed General can be the target.

### Six Swords of Wu (Weapon, range 2)

Compulsory. While it is equipped, the user and every other player of the
user's Kingdom have their attack range increased by 1. With no exposed
General, the user alone gets the +1 (range 3 with the weapon).

### Trident Glaive (Weapon, range 3)

After the user's Slash deals damage to a target, the user may discard a hand
card and choose another player at distance 1 from that target; that player
takes 1 damage with the user as the source. Distance is the ordinary
distance (seats and Mounts). If the user is at distance 1 from the target,
the user may choose themselves, and then takes 1 damage with themselves as the
source (their own damage skills can trigger). It is optional and asked each
time, and only after a Slash that dealt damage (not Duel or other damage).

## What the engine has and what is new (from reading the code)

- Wuxie is `COUNTER_CARD_IDS = ['wuxie']` in `shared/tools.ts`, applied per
  target by `ToolOnTargetEffect` → `WuxieCheckEffect` (`engine/.../toolLifecycle.ts`).
  A Wuxie Kingdom needs the engine to remember "this Tool is cancelled for
  these seats" so later targets of the same Tool are skipped without a new
  check. That is a new mechanic in the engine, not content only.
- Recast exists for Chains. Equipment is built with `makeEquipmentCard`;
  Ice Sword shows the optional after-damage ask pattern (`atStep`/`askAtStep`
  on `sha-damage`). `attackRange()` reads only the weapon's `weaponRange`, so
  Six Swords needs an attack-range modifier that other seats' equipment can
  grant (like `rangeBonusFor`/`distanceToOthers` on abilities).
- `cardDisplayData` and the Wiki know the six cards only by id from the
  Kingdom Wars files; the game UI must resolve their names too.

## Details settled while checking the design (my calls unless marked)

- Wuxie Kingdom is legal against any Tool that goes through the per-target
  Wuxie check (`toolOnTargets`): every Tool in the game, the four new ones
  included, uses it. It needs the target to have an exposed General.
- Amass: the Kingdom's members are fixed when it is used. A target cancelled
  by Wuxie or Wuxie Kingdom, or dead by its turn, is skipped and the rest
  continue. A target holding fewer than 2 cards after drawing discards what
  it has; the discard may be from hand or equipment.
- Ascertain's private look: the engine already redacts per viewer
  (`domain/redact.ts`: a pending choice or arrangement shows its cards only to
  the seat it belongs to), so the look is a choice shown only to the user,
  like Steal's hidden hand, not a broadcast event. The shared log records only
  that Ascertain was used. Hot-seat play must not show it to the next player.
- Decided by the user (2026-10-21): a seat that reveals mid-Tool and joins the
  cancelled Kingdom is cancelled too (the Kingdom is read live per later
  target). Six Swords of Wu bonuses would stack, but the Kingdom Wars deck has
  one copy, so it never comes up. Trident Glaive does nothing when the Slash
  killed its target.
- Trident Glaive: the chosen player is never the target (the user may be
  chosen, as the rule says). With an empty hand it is not offered.
- Six Swords of Wu also raises an unarmed Kingdom mate's range from 1 to 2.
  The Kingdom is read live at every attack range query.
- The Kingdom Wars deal becomes 107 cards: Fire Fan is the only card left
  undealt. Counts, suits and ranks of all six are already in the deck data.

## Constraints

- CLAUDE.md applies: rules text above is written before code; no central
  conditional over card ids; engine stays free of Angular and browser APIs;
  game state stays plain serializable data.
- UI text follows the UI text style; new Vietnamese text is draft and
  `review.json` is untouched.
- Dynasty Wars' tests and behaviour keep passing. The "seven cards not in the
  game" Wiki test and the 98-card deal tests change to match (only Fire Fan
  remains undealt).

## Left to the builder

How to store "cancelled for these seats" in the state, the exact effect and
event shapes for Amass's turn-order draw-then-discard, Ascertain's two
options and the private reveal, how the Six Swords modifier is expressed,
test layout, and any engine API work they need. The builder follows
`superpowers:test-driven-development`.

## My calls to check

1. Wuxie and Wuxie Kingdom answer each other (see Wuxie Kingdom).
2. Bots only need legality, not skill.
3. A Wuxie Kingdom used against a Wuxie acts as a plain Wuxie.
4. Everything under "Details settled while checking the design".
