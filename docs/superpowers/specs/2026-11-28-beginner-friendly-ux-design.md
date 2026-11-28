# Beginner-Friendly UX Design

Fewer dead-end windows, clearer verdicts and outcomes, and clocks that do not leave people waiting. Approved in conversation on 2026-11-28.

## Intent

- **Why.** New players are confused by windows they cannot act on, by vague outcomes ("Nothing happens") and by a verdict stamp that reads from the wrong seat.
- **Goals.** Concrete wording, verdicts from the affected seat, the Blaze card visible, and notice clocks that give time to read.
- **Non-goals.**
  - Decision clocks (response, Wuxie, ask, dying) stay as they are.
  - No engine change that hides or removes a window.
  - No feature-toggle system (see `docs/deferrals.md`, "Experiment flags are code constants, not feature toggles").
- **Anti-goal.** An online opponent must not be able to tell from the table that a seat holds no Shan.

## Approaches

- **Skip in the engine.** Rejected: It leaks a seat's hand, which is why `announcePass` exists.
- **Skip in the app (chosen).** The app submits the Pass itself when Pass is the only legal action, so the Pass plays out as an ordinary Pass.

## Design

1. **Skip windows with no answer (experiment flag, off).**
   - Covers Sha with no Shan, Arrows, Barbarians, Duel and Coerce.
   - A new `FEATURE_FLAGS` entry; when on, `responseDue` in `game-board.ts` submits the Pass instead of opening the dialog.
   - The Tutorial is excluded. The dialog code stays.
2. **Judgment verdict.**
   - Good or bad reads from the seat the effect lands on (for Iron Cavalry, the Sha target), not the judged seat.
   - Every reader in `judgmentOutcome.ts` is audited. Delayed Tools stay as they are.
3. **Outcome text.**
   - Every "Nothing happens" (Judgment outcomes, the Compete result, other resolution windows) becomes a concrete consequence, in English and Vietnamese.
   - Examples: "Player resumes the Play Phase normally" (Capture), "No damage", "The Sha can still be dodged".
   - The empty space in the Judgment outcome box is reduced.
   - New Vietnamese text is draft.
4. **Blaze (experiment flag, off).** The "Discard a card of the same suit" picker shows the revealed card.
5. **Clocks.** Engine constants, so app and server agree.
   - Notice popups: 5 s. Judgment final result: 5 s.
   - Harvest notice: 1.5 s × participants, minimum 3 s, maximum 7 s.
   - Zhen Ji (Identity and Kingdom Wars): The first use of the effect asks for 20 s; every "judge again" ask is 8 s.
6. **Tests.** Unit tests for the clocks and the verdict flip; a browser check of the real windows.

## Left to the builder

- The exact Vietnamese and English wording per outcome.
- Which readers need the perspective flip.
- The doc clock tables that are stale (`docs/architecture/rules-engine.md`, `backend.md`) are updated with the new values.
