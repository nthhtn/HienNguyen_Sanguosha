# Peach and the Dying State — Design Spec

Status: Approved in chat, 2026-10-05
Date: 2026-10-05

## Purpose

Let Peach save a seat at death's door, the way the real game works. Today a
seat whose HP reaches 0 is eliminated on the spot, and Peach can only heal its
own user in their Play phase. This is sub-project E on the card roadmap
([cards A spec](2026-10-05-cards-a-equipment-and-simple-cards-design.md)),
built ahead of the [Tools spec](2026-10-05-tools-design.md).

Decisions settled in chat:

- **Rescuers:** every living seat may save a dying seat, asked in turn order.
- **Below zero:** HP can drop below 0, and the seat needs Peaches until it is
  back to 1 or more.
- **UI:** the existing Response popup asks the question.

## Rule text

### Peach in the Play phase (unchanged)

In your own Play phase, while you are below your max HP, you may play a Peach
with no target. You recover 1 HP. Peach can't be played this way at full HP.

### HP below zero

Damage takes HP down by its full amount, past 0 if need be. For example, a
seat at 1 HP that takes 3 damage goes to −2.

### Dying

1. **Entering.** When damage leaves a seat at 0 HP or below, the seat is
   **dying**. (Superseded 2026-10-16: an HP drop reveals nothing; a death
   reveals both Generals, see the reveal rules spec.) The seat is not
   eliminated yet.
2. **The rescue round.** The living seats are asked one at a time, in turn
   order, **starting with the seat whose turn it is**.
   - The dying seat itself is always asked, even with no Peach. Its popup
     then offers only No Response.
   - Any other seat is asked only if it holds a Peach.
3. **Playing a Peach.** The dying seat recovers 1 HP. If it is still at 0 or
   below, the same seat is asked again, so it may play another, before the
   round moves on.
4. **Saved.** As soon as the dying seat is back to 1 HP or more, the round
   ends and the game carries on from where the damage happened.
5. **Eliminated.** If every seat has been asked and passed while the seat is
   still at 0 or below, it is eliminated.
6. A Peach played in a rescue is a response. It doesn't count as a Play-phase
   card play.
7. While a seat is dying it is still living. It counts toward every rule,
   including the win check, until it is eliminated.

## Engine design

- **`DamageEffect`** no longer clamps HP at 0.
- **`DyingEffect { seatId, order, entering? }`**, a new engine effect. It
  covers the whole round.
  - With `entering`, it logs `SeatDyingEvent { seatId }` first.
  - **Saved:** if the seat is above 0 HP, it logs `SeatSavedEvent { seatId }`.
  - **Next asker:** otherwise it walks `order` to the next seat that must be
    asked (the dying seat always, others only while holding a Peach). It opens
    a response window for that seat:
    - `allowedCardIds: ['peach']` and `reason: { kind: 'dying', seatId }`.
    - **Pass:** `context.effect` is `DyingEffect` with the rest of `order`.
    - **Answer:** `onAnswer` is `[HealEffect(dying seat, 1), DyingEffect(seatId,
      order from this seat)]`, so the same seat is asked again first.
  - **Eliminated:** if no one is left to ask, the seat is eliminated
    (`SeatEliminatedEvent`).
- **`PendingResponse`** gains `onAnswer?: Effect[]`, effects resolved after
  the answering card. It also gains `reason?: DecisionReason`, starting with
  `{ kind: 'dying'; seatId }`. Both are as planned in the Tools spec.
- **`CardPlayedEvent.inResponseTo`** gains `dyingSeatId` for a rescue Peach.
- **Peach's `play()`** does nothing when it is played as a response; the
  window's `onAnswer` heals the right seat.
- **Guozhan:** the "HP ≤ 0 → eliminate" trigger becomes "HP ≤ 0 →
  `DyingEffect(entering)`", with `order` set to the living seats in turn order
  from the turn owner.

## Bots

- **Saving:** a bot plays a Peach only to save itself or a revealed ally.
  Otherwise it passes.
- **Play phase:** unchanged. A bot eats a Peach in its Play phase when hurt.

## UI

- **Response popup**, driven by the window's reason:
  - **Source:** "Seat 1 is dying (HP −1)".
  - **Prompt:** "Play a Peach to save Seat 1?", or "Play a Peach to save
    yourself?" for the dying seat.
  - **Outcome:** "Seat 1 is eliminated" or "You are eliminated". While more
    than one Peach is still needed, it adds "needs 2 more Peaches".
- **Seat tile:** shows "Dying…" while the seat is dying, and shows negative
  HP as it is (for example "HP −1/4").
- **Action History:** "Seat 1 is dying", "Hing used Peach (Q ♥) to save Seat
  1", "Seat 1 was saved".

## Testing

- **Engine:**
  - Damage goes below 0.
  - The rescue order: starts at the turn owner, the dying seat is always
    asked, other seats only with a Peach.
  - The same seat is asked again after a Peach.
  - Saved and eliminated outcomes, with their events.
  - Several Peaches needed after a big hit.
- **Content:** the Guozhan trigger order (reveals, then dying), and
  Peach's response play.
- **Bots:** save self and allies, never an enemy.
- **App:** the popup's dying wording, "Dying…" and negative HP on the tile,
  and the Action History lines.
- **Simulator:** batches at 2, 5 and 10 seats. The invariant changes from "no
  negative HP" to "no living seat at 0 or below unless a dying round is
  pending".
