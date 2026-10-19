# Voluntary Reveal and Brave Spirit — Design Spec

Status: Approved (2026-10-16); bot rule amended after implementation review
Date: 2026-10-16

## Purpose

Fix three play-test findings:

1. **A player cannot reveal a General on purpose.** `RevealGeneralAction` exists
   in the engine (`pipeline/resolve.ts`) but nothing ever offers it, and the UI has
   no control for it. A hidden General reveals only when its optional or active
   skill is used.
2. **Zhang Fei's Roar never works.** It is compulsory, and compulsory skills of a
   hidden General are off (a spec pins this: "is off while Zhang Fei is hidden").
   With no way to reveal him, Roar can only turn on by accident. Fixing 1 fixes 2;
   no change to Roar itself.
3. **Sun Jian's Brave Spirit hands the choice to the wrong seat.** The stage 10
   spec has the picked seat choose between "draw X then discard 1" and "draw 1 then
   discard X". The user wants Sun Jian's player to choose (the original rule), so a
   human Sun Jian always gets the popup.

Fire and Thunder Sha (and dealing Blaze) are a separate project; see "Not in this
spec".

## Goals

- A player can reveal each of their hidden Generals, one at a time, at the two
  windows below, from the UI.
- Revealing turns the General's compulsory skills on at once (Roar).
- Brave Spirit's user chooses the mode; bots choose for a bot Sun Jian.

## Non-goals and anti-goals

- No reveal windows beyond the two below (not inside response windows, not when
  targeted). Those need their own rule text.
- No change to forced reveals, reveal bonuses (first reveal draw, odd max HP draw)
  or to reveal-to-use for optional and active skills; the existing "Reveal <skill>"
  buttons stay.
- Games with only bots must not gain extra decisions (determinism, sim speed).
- No change to Roar's definition.

## Decisions

Window choices are the user's (2026-10-16); the rest are my calls and marked so.

### Voluntary reveal

**Rule text.** *A player may reveal one hidden General of theirs, at no cost, at
two times: (a) as their own turn begins, before the Start Phase's effects happen; (b) at any
time in their own Play Phase when no decision is pending. Each General is revealed
separately. Revealing logs the usual `GeneralRevealedEvent`, so every existing
reveal rule and trigger applies (kingdom becomes known, reveal bonuses, skills
that trigger on reveal).*

**(b) Play Phase.** In `getLegalActions`, in the Play Phase for the turn owner with
nothing pending, add one `RevealGeneralAction { seatId, slot }` for each of the
seat's hidden slots (`generals[slot].revealed === false`), next to `EndPhaseAction`.

**(a) Start of turn (user's choice, 2026-10-16: before the Start effects).** Today only
the Play Phase waits for the turn owner; every other phase passes on its own
(`legality.ts`). A reveal window as the turn begins needs the engine to wait
*before* the Start Phase's effects: a skill revealed there must act this Start
(Jiang Wei's compulsory Follow the Master is the clearest case). So when a turn
begins for a seat that holds a hidden General and whose player is
`kind: 'human'` (my call, so bot-only games are unchanged), the engine enters the
turn in a waiting state: the turn is advanced, but the Start `PhaseChangedEvent`
and its after-triggers do **not** happen yet. While waiting, the owner's legal
actions are the `RevealGeneralAction`s for its hidden slots plus `EndPhaseAction`
("Continue"). `EndPhaseAction` closes the window and then logs the Start
`PhaseChangedEvent` and gathers its triggers exactly as today. A seat with no hidden
General, or a bot seat, never waits. The window applies at both entry points: every
later turn (`enterNextPhase` in `pipeline/resolve.ts`) and the very first turn
(after the last `ChooseGeneralsAction`). A face-down seat's turn (it turns face up
and passes) and skipped-phase handling are unchanged and happen before the window.
The cost: one extra click each turn for a human until both Generals are revealed.
A decision-clock timeout at the window submits `EndPhaseAction` (`defaultActionsFor`
already prefers it), so a stalled player cannot hang the game.
The plan makes the Start window its own task, so it can be dropped or reworked
without touching the Play Phase reveal.

**Repeatable.** Each General is revealed separately and the action is offered again
for the other one, so both can be revealed in one window; `EndPhaseAction` is always
offered alongside.

**Triggers.** A General revealed in the Start window takes part in that Start (its
triggers are gathered when the Start event happens, after the window). A General
revealed in the Play Phase takes part from the next event.

**UI.** Each of the viewer's own hidden Generals shows a **Reveal** button on its
half of the avatar, in the same place as the skill buttons (button: Title Case in
English; Vietnamese sentence case, a draft for native review). Enabled only when
the engine offers the matching `RevealGeneralAction` (the UI never decides). In the
Start window the existing "Continue" control ends the phase. The decision clock,
history and Wiki need no new rules; Action History already prints reveal lines.

**Bots.** The rule-based bot never reveals on purpose (it picks specific actions and
ends the phase, so the new actions are ignored) and a bot owner never waits at Start.
The random fuzz bot picks any legal action, so it will now sometimes reveal; seeded
random-policy games change as a result, and specs that assert an exact legal-action
set are updated.

### Brave Spirit

**Rule text (replaces the stage 10 wording).** *Sun Jian (may): at the start of
your Start Phase, if damaged (X = missing HP), pick any seat, yourself included.
You choose: it draws X cards then discards 1, or it draws 1 card then discards X.
The picked seat discards its own cards (it chooses which).* Only the chooser of the
mode changes: from the picked seat to Sun Jian's player. The pick of the seat, the
draw, and the discard (by the picked seat, at most what it holds) are as before.

**UI text.** The owner's mode popup gets a prompt that names the picked seat (for
example "Choose how {seat} draws", sentence case); the option labels stay as they
are. New English and Vietnamese strings; the Vietnamese is a draft for native review.

**Bots.** The decision moves to the owner's bot. When the picked seat is an ally
other than the bot, it always chooses draw X then discard 1 (it never makes an ally
draw 1 and discard X: the bot cannot see an ally's spare cards, so the other option
could cost the ally cards). When the bot picks itself, the earlier heuristic applies:
draw X then discard 1 when X is 2 or less or when it has too few spare cards to
discard X; otherwise draw 1 then discard X.

## Not in this spec

Fire Sha, Thunder Sha and dealing Blaze: a separate brainstorm and spec (the user
reversed the 2026-10-05 "no elemental damage" decision on 2026-10-16).

## Constraints

- The engine names no card or skill; the new window is generic (turn owner, hidden
  slot). The UI holds no rules: it shows what `getLegalActions` offers.
- Redaction: another seat's hidden General id must stay hidden. `RevealGeneralAction`
  carries only the slot, and a seat's own hidden Generals are already visible to it.
- CLAUDE.md UI text style and Vietnamese rules apply to every new label.
- Games in progress at deploy may stop as `outdated` on replay: the existing hash
  check already stops them that way (accepted for the earlier engine work; the Start
  window and the Brave Spirit choice both change the action sequence).
- Rule text above is written before code; the plan restates it per task.

## Acceptance

- Zhang Fei hidden: reveal him in the Play Phase; a second Sha is then playable.
- A human whose turn begins with a hidden General waits before the Start effects;
  revealing Follow-the-Master's General there lets it fire this Start; Continue then
  runs the Start effects; a bot or a fully revealed seat does not wait.
- Seeded bot-only games that contain no Sun Jian replay to identical hashes before
  and after (a bot never waits). Games containing Sun Jian are expected to differ
  (the mode decision moves); the random-policy games change too (it may reveal).
- A human Sun Jian gets the mode popup whatever seat he picked; the picked seat gets
  the discard selection only.

## Left to the builder

How the waiting turn-start state is represented (a flag on the turn, or a legality
rule), where in `enterNextPhase` / the first-turn path / `autoAdvance` the wait lives, the Reveal button layout in `seat-avatar`,
the exact Vietnamese wording for Reveal (check the terminology section of
`2026-10-15-vietnamese-localization-design.md`), and whether Brave Spirit's popup
needs a new prompt text so it reads as the user choosing for the picked seat.
