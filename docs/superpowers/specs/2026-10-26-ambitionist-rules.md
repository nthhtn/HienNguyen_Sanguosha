# Ambitionist — Rules Spec

Status: Drafted from the user's rule and answers (2026-10-26); marked *(my call)* where I filled a gap
Date: 2026-10-26

Closes the gap noted in `2026-09-30-general-selection-design.md` ("the real-game
Ambition rule ... the existing win condition is unchanged").

## Purpose

A Kingdom cannot hold more than half the table. A seat that reveals into a full
Kingdom plays alone as an Ambitionist and wins only as the last survivor.

## Rules

1. **Cap.** Each Kingdom (Wei, Shu, Wu, Qun) holds at most `floor(total / 2)`
   seats, where `total` is the number of seats at game start. Example: 7 seats,
   cap 3.
2. **Counting.** The cap counts every seat that has been exposed as that Kingdom,
   living or dead. A freed slot is never reopened. Ambitionists count toward no Kingdom.
3. **Becoming an Ambitionist.** A seat's first reveal (either General) exposes its
   Kingdom. If that Kingdom is already at the cap, the seat becomes an Ambitionist
   instead of exposing it. *(my call)* Revealing both Generals at once is one
   reveal. A reveal on death follows the same rule.
4. **Permanent.** The status is decided once, at that first reveal, and never
   changes: hiding a General again, or a Kingdom member dying, does not undo it.
5. **Alone.** Every Ambitionist is its own one-seat group. Nobody shares a Kingdom
   with them, not even another Ambitionist, so everyone is its enemy and it is
   everyone's enemy ("same Kingdom" effects and the Wuxie Kingdom cancel never include
   them beyond themselves).
6. **Kill reward.** A seat that kills an Ambitionist draws 3 cards. An Ambitionist
   that kills anyone draws as for a different Kingdom. The same-Kingdom discard
   penalty never applies to it.
7. **Winning.**
   - The last living seat wins. This is how an Ambitionist wins (no winning Kingdom).
   - A Kingdom wins when every living seat is exposed and shares that Kingdom
     (Qun included; today it can only win as the sole survivor).
   - No Kingdom wins while any living seat is still hidden. The check runs after
     each elimination and after each reveal. If the last hidden seat reveals and fits
     under the cap, the game ends at that reveal and its Kingdom wins. If it would
     exceed the cap it becomes an Ambitionist, and the game continues.
   - If a hidden seat dies, the remaining exposed seats are checked again.
8. **No forced reveal** (user's call). Nothing forces a hidden seat to reveal; players
   reveal only by the rules of `2026-10-20-reveal-conditions-design.md`. A table whose
   hidden survivor never reveals does not end by Kingdom. Accepted risk; the
   simulator's turn cap still ends such a game.

## Worked example (7 seats, cap 3)

Three Wei are exposed, a fourth Wei is hidden. The fourth reveals: Wei is full, so
they are an Ambitionist. Killing them draws 3. If the three Wei and the Ambitionist
are the last four alive, the game goes on until one group is gone: Wei wins if the
Ambitionist dies first, the Ambitionist wins only by outliving all three Wei.

## Design

- **Seat**: a new optional public flag `ambitionist: true`, set in the reveal effect
  (and the death reveal). `Seat.kingdom` keeps the General's printed Kingdom for the
  seat's own record. The flag is visible only once a General is revealed (redaction
  follows `isKingdomRevealed`).
- **Content**: `exposedKingdom` returns null for an Ambitionist (so
  `sameKingdomSeatIds` returns just the seat). `exposedKingdomCounts` skips them.
  The kill-reward trigger and `checkWinCondition` in `kingdomWar.ts` change as in
  rules 6 and 7.
- **GameResult** keeps `winningKingdom` absent for an Ambitionist win.
- **Bots, UI, i18n**: bots treat Ambitionists as enemies via the same helpers; the
  seat shows an "Ambitionist" label in place of the Kingdom badge, with matching en and vi
  texts and a game-over line (vi text starts as a draft).
- **Server/protocol**: `Seat` is already serialised plain data. Check that the new
  field passes the protocol's schema.

## Tests

Engine/content specs for: the cap boundary (cap-th seat is Wei, the next is an
Ambitionist), dead seats still counting, death reveal, same-Kingdom helpers, kill reward,
and win checks (Ambitionist sole survivor, Kingdom win only when all exposed, the
final reveal ending the game, over-cap reveal not ending it, Qun group win). Then a
headless simulator run to check no crash on full games.
