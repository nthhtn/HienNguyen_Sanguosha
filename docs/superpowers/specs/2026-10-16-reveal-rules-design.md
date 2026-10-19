# When a General Is Revealed — Rules Spec

Status: Approved by the user's list of four scenarios (2026-10-16)
Date: 2026-10-16

## Purpose

A play-test question: is a General revealed automatically when its seat loses
HP? Until now yes (Kingdom War's "forced reveals": the Main General at half max HP
or below, the Deputy at 0 or below). The user's rule is that a General is
revealed only in the four ways below, and any other way is removed.

## Rule

*A General is revealed only:*

1. *(Optional) at the start of its owner's turn, before anything else happens
   (the Start window).*
2. *(Optional) in its owner's Play Phase, by revealing it (the Reveal button) or by
   using its active skill or a conversion, which reveals it first.*
3. *(Optional) when an event happens that a skill of the hidden General answers (Cao
   Cao's Evil Hero on damage, Cao Pi's skill on a death, Sun Shangxiang's on her
   equipment leaving, and so on): the owner is asked, and Use reveals it first.*
4. *(Mandatory) when its seat dies: both its Generals are revealed.*

*Losing HP, taking damage and dropping to 0 HP reveal nothing. A seat that is
dying keeps its hidden Generals until it is saved or dies.*

## Decisions

- **Death reveal (my call on the details).** Both hidden Generals are revealed when
  the seat is eliminated, in the engine's elimination step (the dying round, an
  immediate elimination, and a max HP of 0), logged as `GeneralRevealedEvent` with
  `onDeath` before `SeatEliminatedEvent`. No reveal bonus follows it: the first
  reveal draw and the odd-HP draw ignore a death reveal, and a death reveal does not
  use up "the first reveal at the table". Revealed skills of a dead seat do not
  trigger.
- **Removed:** the two HP-drop triggers in Kingdom War's mode definition. The dying
  trigger stays.
- **Bots (my call).** The rule-based bot used to rely on the forced reveal to turn on
  a hidden General's compulsory skills. It now reveals every hidden General in its
  Play Phase. Bots never wait in the Start window.
- Not changed: the Start window, the Play Phase Reveal, reveal-to-use for skills and
  conversions, the reveal bonuses for living seats.

## Acceptance

- A seat at half HP, at 0 HP, or dying has no General revealed that was not already.
- A death reveals both Generals, once each, before the elimination in the log; no
  card is drawn for the dead seat; the redacted view of a dead seat shows both.
- Simulated games and leak checks pass; compulsory skills of bot Generals still fire.
