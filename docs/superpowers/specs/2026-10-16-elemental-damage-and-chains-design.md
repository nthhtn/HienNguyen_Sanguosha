# Elemental Damage, Fire and Lightning Attack, Blaze and Chains — Design Spec

Status: Approved (2026-10-16)
Date: 2026-10-16

## Purpose

Today every point of damage is plain. The user wants fire and thunder damage in
the game, with the cards that use it:

- **Fire Attack** and **Lightning Attack** (the elemental Sha): in the card data,
  not yet in the registry or the deck, so they cannot be played.
- **Blaze**: implemented, but flagged `outOfDeck` ("made only by Fire Strategy"),
  so it is never dealt, and it deals plain damage.
- **Chains**: in the card data only. No behaviour, not dealt.
- **Wood Armor**: its fire weakness ("can't come up: no fire damage") is missing.
- **Lightning** (the delayed Tool): deals plain damage today.

This reverses the 2026-10-05 roadmap decision "no elemental damage"
(`all-cards-and-skills-roadmap`); the user asked for it on 2026-10-16.

## Goals

- Damage has a nature (plain, fire, thunder). The `Damage.nature` field already
  exists; nothing sets anything but `'normal'` yet.
- Fire Attack, Lightning Attack, Blaze and Chains are playable, dealt, and have
  the rules below.
- Wood Armor takes extra fire damage.
- Chains work in full, including propagation of fire and thunder damage.
- Lightning deals thunder damage.

## Non-goals and anti-goals

- No new Generals and no change to Generals' skills other than those named below
  (Pang Tong's Shackle gets the Chains option).
- No other armor or weapon changes. (Ice Sword, Black Pommel and the rest keep
  their rules; the interactions with the new natures are in the Decisions.)
- The engine names no card (CLAUDE.md): chain state and propagation are generic
  engine rules over damage natures; "Chains" is a content card that sets and
  clears the state.
- No UI rule logic: the board shows what the engine's state and legal actions
  say.

## Decisions

Marked **(user)** when the user decided it on 2026-10-16, else **(my call)**.

### Damage nature

**Rule text.** *Every damage has a nature: plain, fire or thunder. Fire Attack,
Blaze deal fire damage. Lightning Attack and Lightning (the delayed Tool) deal
thunder damage. Every other damage is plain: Sha, Duel, Barbarians, Hail of
Arrows, Brave Spirit and the other skills' damage.* (user: Lightning is thunder.)
The history line says the nature ("took 1 fire damage"; plain damage reads as
today).

### Fire Attack and Lightning Attack

**Names (user):** the data names stay: "Fire Attack" and "Lightning Attack". Blaze
keeps "Blaze". Ids stay `fire-attack`, `lightning-attack`.

**Rule text.** *A Fire Attack and a Lightning Attack are Sha in every respect.
Wherever the rules or a skill say Sha they count: the one-Sha-per-turn limit,
Crossbow, Wine's +1, Zhang Fei's Roar, the Shan that answers them, targets within
attacking range, Sha-based skills and conversions, and Duel and Barbarians
accepting them as the Sha a seat plays. The only difference is the damage nature
(fire for Fire Attack, thunder for Lightning Attack).* (my call; the standard
rule.) Printings: Fire Attack 5, Lightning Attack 9, as in the data.

**Builder note.** Some content compares the physical card's `definitionId ===
'sha'` (for example Green Dragon Blade's `shasIn`, the Wiki's Sha group) or keys
a count by `'sha'`. Those must treat the elemental Sha as Sha; the plan lists the
sites (grep `'sha'` in content, bots and the app). A card played as a Sha keeps
`as: 'sha'`; the card's nature rides on its definition.

### Wood Armor

**Rule text.** *Wood Armor: a plain Sha has no effect on its wearer, and
Barbarians and Hail of Arrows skip it as a target (as today). Fire damage dealt to
its wearer is increased by 1. A Fire Attack or a Lightning Attack is not stopped
by Wood Armor (only a plain Sha is), so a Fire Attack that lands on a wearer
deals 2. A weapon or skill that ignores the target's armor (Black Pommel) ignores
this weakness as well.* (my call, the standard rule.) Thunder damage and plain
damage are unchanged.

### Blaze

**Rule text.** *As today, but its damage is 1 fire damage (not plain), and Blaze is
dealt: its 3 printings in the data (Q♦, 2♥, 3♥) go into the deck.* Fire Strategy
still converts a red hand card to Blaze.

### Chains

**Card (my call, from the data text and the standard rule).** *Tool. Use: choose
1 or 2 living seats at any distance as targets (no range check; a seat that
cannot be targeted by Tools stays out). After the Wuxie check, each target in turn
toggles: unchained becomes chained, chained becomes unchained. Or Recast: discard
Chains and draw 1 card, instead of using it. 6 printings, as in the data.*

**State.** A seat is chained or not. It starts not chained. The state is public
(everyone sees it; the redaction rules are unchanged), is part of game state, and
clears when the seat is eliminated.

**Propagation rule (generic, in the engine).** *When a seat that is chained takes
fire or thunder damage (the damage is actually dealt, amount above 0 after any
prevention), the seat becomes unchained. When that damage, including its after-
damage skills and any dying round, has fully resolved, every other living chained
seat takes the same damage in turn order starting after the damaged seat. Each of
those takes the original amount (the amount the first damage had before the first
seat's own armor or skill changed it), the same nature and the same source and
cause, and applies its own armor and skill effects (a Wood Armor seat adds 1 for
fire). Each such seat becomes unchained when it takes the damage; one finishes
completely (damage, after-damage skills, dying) before the next starts. Propagated
damage never propagates again.* (user: original amount.) The rest of the rule is my call
(the standard rule). Plain damage never propagates and never unchains. Damage
that is prevented (to 0) does not unchain the seat.

**Details of propagation (my calls, from the builder check).**

- The original amount is the damage's amount when it is created, including
  source-side bonuses (Wine's +1, Roar, and the like); only the target's own armor
  and skill changes are left out of it.
- A propagated hit applies the target's own effects only. Black Pommel's armor
  ignoring belongs to the first hit and does not follow the damage along the chain.
- A damage that is prevented (Ice Sword) or never created (a Sha that is dodged)
  starts no propagation.
- The seats that take the propagated damage are checked one at a time: each must
  still be living and still chained when its turn comes (a seat that died or was
  unchained meanwhile is skipped). If the game ends, propagation stops. A dead
  source does not stop it; the damage keeps its recorded source as other damage
  does today.
- A card's nature belongs to the card as played: a physical Fire Attack or
  Lightning Attack played as itself keeps its nature, and a card a skill converts
  to Sha (Wusheng, Serpent Spear, and the rest) is a plain Sha whatever it was. A
  plain card converted to Sha is plain.
- Chains may target any living seat, including one whose Generals are hidden.
  Shackle's Chains option follows the same reveal-to-use rule as other
  conversions.

**Pang Tong's Shackle (my call).** The skill's current text recasts a club hand
card ("Chains isn't in the game"). With Chains in the game it offers both: a club
hand card may be used as Chains (as the card above), or recast as today. Nothing
else changes.

### Dealing the cards (my call)

The deck gains: 5 Fire Attack, 9 Lightning Attack, 3 Blaze, 6 Chains (23 cards). The
`outOfDeck` flag leaves Blaze. Every seeded game changes (deck order and size), so
all recorded-hash specs and any spec that pins deck contents must be updated; games
in progress at deploy may stop as `outdated`, the accepted behaviour for earlier
engine changes.

### Bots (my call)

The rule-based bot plays a Fire Attack or Lightning Attack wherever it plays a Sha,
and answers with Shan as before. It never uses Chains (no card play), but counts
it as a discardable spare card; at most it recasts Chains when idle if that is
cheap in the code; otherwise it ignores it. A bot Blaze user is unchanged. The
fuzz bot picks from legal actions as before.

### UI and text

- Chained seats show a chain marker on the seat tile, with the text style rules
  of `CLAUDE.md`; an unchained seat shows nothing.
- History lines: one line per toggle ("Seat 1 chained Hing", "Seat 1 unchained
  Hing"), and a nature word in damage lines ("took 1 fire damage").
- Wiki: the Fire Attack and Lightning Attack entries sit beside Sha (they already
  do); Chains and Blaze entries state their rules; Wood Armor's text gains the fire
  weakness. New English text; Vietnamese is a draft for native review.

## Constraints

- `CLAUDE.md` layering and UI text style apply; rule text above is written before
  code; the plan restates it per task.
- Redaction: chain state is public and reveals nothing hidden.
- Determinism: all of it is plain serializable state and seeded RNG as before.

## Acceptance

- A Fire Attack on a Wood Armor wearer deals 2; a Lightning Attack deals 1; a plain
  Sha does nothing; Black Pommel's Sha deals the plain amount.
- Chains toggles 1 or 2 seats; Recast draws 1; Wuxie cancels one target's toggle.
- Two chained seats: fire damage to one damages the other, both end up
  unchained; plain damage does neither; the original amount propagates and a Wood
  Armor seat adds its own 1.
- Lightning's strike deals 3 thunder damage and propagates along a chain.
- Fire Attack and Lightning Attack count toward the one Sha per turn, work with
  Crossbow and Wine, and are accepted as the Sha a Duel or Barbarians asks for.
- The deck holds the 23 new cards; Blaze is dealt.
- Shackle can use a club as Chains.
- Property and leak checks still pass.

## Left to the builder

Where chain state lives (a seat field versus a mark), how nature-specific armor
and propagation hook into the damage pipeline (before/after triggers or a new
rewrite step), how the elemental Sha reuse Sha's code (one definition with a
nature parameter versus siblings), the exact marker design, and the Vietnamese
wording.
