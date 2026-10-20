# Reveal Conditions — Design Spec

Status: Drafted from the user's three rules (2026-10-20); the compulsory-skill choice is the user's, the rest are my calls and marked so
Date: 2026-10-20

Supersedes the voluntary parts of `2026-10-16-reveal-rules-design.md` and
`2026-10-16-voluntary-reveal-and-brave-spirit-design.md` (the Play Phase Reveal
button, the Reveal buttons on the avatar, the Start window's per-General buttons).

## Purpose

A General should be revealed only for a reason: at the start of its owner's
turn, or because something it can do is available. Revealing for nothing in the
Play Phase goes away. A hidden General whose skill's condition is met is
offered the reveal at that moment, in any phase of any turn.

## Rule

*A General is revealed only:*

1. *(Optional) at the start of its owner's turn, before anything else happens.
   A popup lists the owner's hidden Generals; the owner picks none, one or both
   and presses Confirm. Picked Generals are revealed, then the Start Phase begins.*
2. *(Optional) in its owner's Play Phase, only by using something of the General
   that is usable: an active skill, a conversion, or a card play that only its
   skill allows (Zhang Fei's Roar: a Sha beyond the first). Using it reveals the
   General first. There is no way to reveal "for no reason" in the Play Phase.*
3. *(Optional) in any phase of any turn, when the condition event of one of its
   skills happens (Xiahou Dun is damaged, Sun Shangxiang's equipment leaves,
   Zhang Jiao uses Shan, Zhou Tai is dying, Sun Jian's Start Phase begins). The
   owner is asked in a Response popup; Use reveals the General and the skill
   resolves, Don't leaves it hidden and nothing happens.*
4. *(Mandatory) when its seat dies: both its Generals are revealed (unchanged).*

*Losing HP, taking damage and dropping to 0 HP reveal nothing by themselves.*

## Decisions

- **Rule 3 covers compulsory skills too (user's choice, 2026-10-20).** Today a hidden
  General's compulsory skills are off (`skillsInPlay`), so Armed Consorts never
  fires while Sun Shangxiang is hidden. Now a hidden General's compulsory skill
  that has a *trigger* is gathered like an optional one: when its condition holds
  the owner is asked, Use reveals the General and the skill's effects resolve (it
  is compulsory once revealed: no second ask for it). Optional skills already ask
  and are unchanged.
- **Hidden trigger without its own ask (my call).** A hidden General's trigger that
  returns direct effects used to reveal silently before them. It is now wrapped in
  the same ask (Use: reveal then the effects; Don't: nothing), so every reveal by a
  condition event is a decision. Content that already asks is untouched.
- **Before-triggers of a hidden compulsory skill (user's choice, 2026-10-20).** Eight Arrays,
  Pleasure, Culprit, Giant Elephant, Passion and Curtain fire as before-triggers. They ask
  too: Use reveals and the effect runs again, rewritten by the now-revealed skill; Don't
  runs it unchanged by that skill. (Optional ones already ask, as before.)
- **Awakening skills (user's choice).** A hidden compulsory awakening skill asks like any
  Trigger once its condition holds.
- **Skill kinds (user's definitions).** *Trigger*: needs a condition event, so it asks the
  owner (this spec). *Ignition*: the player starts it (a skill button or a conversion), so it
  reveals the General on use and is never asked automatically.
- **Roar (user's choice: reveal on use).** While Zhang Fei is hidden, a Sha beyond the
  first of the turn is offered as playable; playing it reveals Zhang Fei first.
  Generic form: a hidden General's compulsory `shaLimit` modifier counts toward
  "may play a Sha" for legality; when the play only fits because of it, the play
  reveals that General, ahead of the Sha's own effects.
- **Other pure modifiers stay off while hidden (my call).** Distance, targetability,
  double-answer and similar compulsory modifiers have no event or action to hang a
  reveal on; they work once the General is revealed (Start popup, or another skill).
  Only Roar's Sha limit gets reveal-on-use, since it is the one the old Reveal button
  existed for.
- **Start popup (my call on details).** One popup per turn start, only for a human
  seat with a hidden General (unchanged: bots and fully revealed seats never wait).
  Each hidden General is a checkbox row (its name and, for the owner, its identity,
  which the owner can already see); both unchecked is allowed. Confirm submits one
  action carrying the picked slots. The decision clock runs as before; at zero it
  confirms with nothing picked.
- **One action for the window.** `RevealGeneralAction` and the Start window's
  `EndPhaseAction` are replaced by `ConfirmRevealsAction { seatId, slots }`, offered
  as a template with `slots` free. Its resolution reveals each picked, still hidden
  slot (one `GeneralRevealedEvent` each, so every existing reveal bonus and trigger
  applies), then enters Start exactly as before. A picked slot that is already
  revealed or repeated is an error.
- **Bots (my call).** Bots never wait at Start and no longer reveal for no reason; they
  answer the new asks through the existing "ask" policy (`mayReveal`) and reveal
  through Roar-style plays only if the play is chosen. The rule-based bot's "reveal
  every hidden General in the Play Phase" step is removed.
- **Removed from the UI:** the Reveal buttons on the avatar (`avatarReveals`) and the
  Start window's Continue button; the Start popup replaces both.

## Non-goals

- No change to reveal bonuses, the death reveal, or what a revealed General's skills do.
- No reveal-on-use for pure modifiers other than Roar's Sha limit.
- No new reveal windows beyond the popup, the trigger asks and use.

## Constraints

- The engine names no card or skill; the compulsory ask is generic over skills in
  play, and the Sha-limit reveal goes through the existing modifier, not an id.
- The UI holds no rules: the popup shows what `getLegalActions` offers (the template
  and the hidden slots of the viewer's own seat).
- CLAUDE.md UI text style: popup title and buttons Title Case in English ("Reveal
  Generals", "Confirm"); the explanatory line is a sentence. Vietnamese is sentence
  case and a draft for native review.
- Redaction: a slot is hidden to others, and the template carries no General id.
- Games in progress may stop as `outdated` on replay (the action sequence changes);
  accepted as in earlier engine work.

## Acceptance

- Start of a human's turn with a hidden General: the popup lists exactly the hidden
  Generals; Confirm with none picked starts the turn with nothing revealed; picking one
  or both reveals them first, and a revealed Sun Jian's Brave Spirit asks in that Start.
- Play Phase: no action reveals a General by itself; a hidden active skill, conversion
  and Roar's extra Sha still reveal on use.
- Sun Shangxiang hidden loses her equipment, in any phase of any turn: she is asked;
  Use reveals her and she draws 2; Don't leaves her hidden. The same for Xiahou Dun on
  damage, Zhang Jiao on using Shan, Zhou Tai when dying, Sun Jian at his Start Phase.
- Zhang Fei hidden, a Sha already played: another Sha is offered; playing it reveals him.
- Bot-only games still never wait at Start and run to completion; leak checks pass.

## Left to the builder

Where the popup's data comes from in the app (the viewer's own seat generals), the exact
Vietnamese wording (check `2026-10-15-vietnamese-localization-design.md`), and how the
Sha limit exposes "needs a reveal" (a query beside `shaLimit`).
