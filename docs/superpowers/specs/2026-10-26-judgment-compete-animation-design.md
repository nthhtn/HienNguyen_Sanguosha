# Judgment and Compete Animations — Design

Status: draft for review, 2026-10-26. Amends `2026-10-20-judgment-popup-design.md`: its 10 s notice timer becomes 3 s, its non-goal "no animation beyond the existing dialog" is lifted, and skill decisions that can change a judgment move into the popup. Where this document is silent, that spec stands.

Mock (interactive, private to the author): https://claude.ai/artifact/F7Cc282unJ1xDuvoqsS9a7. This document is written so a builder never needs it.

## Intent

The Judgment popup and the Compete popup should be a fixed, readable moment, not a text dialog to be read and clicked away. A player should grasp the outcome (lose HP, skip a phase, win or lose a Compete) from motion and shape before reading a word. Both popups keep blocking: the player cannot advance until they end.

Today the judgment popup is text plus a 10 s timer, and a skill's Use or Don't Use question opens as a second dialog over it. Chained judgments produce a stack of modals. This design puts one fixed sequence in each popup and keeps decisions inside the Judgment popup.

## Goals

1. **Judgment popup plays a fixed sequence** (beats below) that ends on a check or cross and a visual consequence.
2. **A check or cross says how the judgment went for the judged seat.** Check: good for it. Cross: bad for it. A judgment with no good or bad reading shows no stamp (see "Verdict and consequence data").
3. **Skills that can change the judgment are decided inside the Judgment popup**, in a decision area under the card, not in a second modal. Several changers in turn are supported: the sequence repeats once per replacement and the verdict waits for the last round.
4. **Compete popup plays a fixed sequence**: two players face off, both cards turn together, the winner is lit and the loser dims.
5. **Both popups end on a 3 s countdown** that starts when Continue unlocks, then close on their own or on Continue.
6. **A judgment-change decision has a 10 s clock.** No answer counts as declining.
7. Respect `prefers-reduced-motion`: show each beat's end state immediately, in order, with no motion.

## Non-goals

- No tap-to-skip. The animation always plays in full.
- No new engine pause for Compete. Its popup stays a UI modal as today (each client shows its own). Only its content and timer change.
- No change to what skills can do to a judgment, to the order changers are asked (`nextToChange`), or to Action History.
- No sound design. Existing sounds are untouched.
- No change to the Compete rules text (`competeOutcomeText`).

## Anti-goals

- No rule logic in Angular. Which result is good or bad, and what the consequence is, come from content as data.
- A judgment must never be able to stall a game beyond its clocks: 10 s per judgment-change decision, 3 s notice. A game with no human seat must not stall at all.
- Stored games and replays must replay exactly. All new engine behaviour sits behind the existing `judgmentNotice` option.

## Judgment sequence

All times are from the popup opening, at normal speed. They are a starting point to tune in the browser, but the order of beats is fixed and the total before Continue unlocks with no decision should stay at or under 4.5 s.

| t (ms) | Beat |
|---|---|
| 0 | Source slides in (General and skill, or the card and the seat it sits on). |
| 500 | The rule line appears (what makes this judgment good or bad, one sentence). |
| 1000 | The card is laid face down, then turns face up (about 600 ms). |
| 2100 | Decision rounds, only if a changer is to be asked (below). |
| next | Check or cross is drawn over about 750 ms; the card gets a ring in the verdict colour. Skipped when the verdict is neutral. |
| +900 | The consequence plays in the area under the card (see below). |
| +1100 | Continue unlocks; the 3 s bar starts. |
| +3000 | The popup closes on its own, or on Continue. |

Without decisions, Continue unlocks at about 4.1 s.

**Consequence beats** (the area under the card, which is the same area the decision uses):
- **Damage:** the subject's HP hearts, with the lost ones popping and greying in turn, about 260 ms apart, and a "−N HP" tag.
- **Skip a phase:** the turn's phases as chips (Draw Phase, Play Phase, Discard Phase); the skipped one is struck through and red.
- **Phase kept:** the same chips; the phase that could have been skipped turns green.
- **Passes on (Lightning):** two seat chips with an arrow sliding from the judged seat to the next.
- **Anything else:** only the one-line sentence (`judgmentOutcomeText`).
- Every consequence also shows its existing one-line sentence, so nothing is icon-only.

### Decision rounds

A round happens whenever the engine asks a seat whether to change the judgment card (`judgmentView.settled === false` with a pending choice or selection belonging to a changer).

1. The decision area replaces the consequence area (they share one grid cell, so the dialog does not change size). It fades in.
2. **The deciding seat's own player** sees the question ("{Skill}: change this judgment?"), the choices the existing dialogs would offer (the hand cards it may use, then Use and Don't Use), and a 10 s bar.
3. **Everyone else** sees "Waiting for {seat} to decide whether to change the judgment" with a spinner and the same 10 s bar.
4. On Use with a card: the decision area fades out, the current card is struck out and moves left, and the replacement is laid in and turned face up (about 1300 ms in all).
5. On Don't Use (or the 10 s running out): the area fades out and the card stands.
6. If the engine then asks another changer, step 1 repeats. Replaced cards fan out to the left, each struck out, the older ones smaller and fainter (at most the three most recent are drawn; earlier ones are dropped from view, never from the log).
7. When no changer is left, the verdict beat runs on the final card.

The existing separate Ask and Selection dialogs must **not** open for a judgment-change decision while the Judgment popup is on screen. They open as before for every other decision. (If the existing flow is two steps, a "use?" ask and then a card selection, the decision area shows them in sequence in the same space; it need not merge them.)

**Pass and Play.** The decision needs private hand cards, so the existing "Pass the device to …" gate shows first, as for any private decision. The Judgment popup stays open underneath, and once the gate is passed the decision area opens and its 10 s clock runs. The existing popups are suppressed by the board while a judgment-change decision is pending and the Judgment popup is open, in every mode.

Minimize (`MinimizeButton`, `DecisionBanner`) keeps working on the Judgment popup, and a decision in progress survives minimizing as the existing dock does.

## Compete sequence

| t (ms) | Beat |
|---|---|
| 0 | Both players slide in from their sides, each tinted in their own Force colour; a VS badge pops between them. |
| 800 | Both cards are laid face down in their slots. |
| 1500 | Both cards turn face up together. |
| 2500 | **Winner** is lit: scales up, glows in its Force colour, a Winners tag appears. **Loser** dims, loses colour, tilts away. A line under them states the comparison ("K beats 8"). |
| 3400 | The outcome line appears (existing `competeOutcomeText`). |
| 4200 | Continue unlocks; the 3 s bar starts. |
| 7200 | The popup closes on its own, or on Continue. |

- **Tie:** the equal-ranks rule is unchanged (the challenger loses). The comparison line says so: "9 ties 9. A tie counts as a loss for {challenger}". The challenged player is lit as the winner.
- The popup keeps its source General, skill and Force theme (the dialog frame is themed by the source General's Force; the two player sides use their own).
- Several Competes still queue and open one at a time.
- The popup is derived from the log after the Compete has resolved, so both cards, the winner and the tie flag are already known when it opens (`CompeteResult` has them). The comparison line reads the two cards' ranks, which the popup already holds. No new engine fields.

## Verdict and consequence data

Content gains, per judgment outcome key, a small typed description, beside the existing text. The text stays the fallback for any outcome with no description.

```ts
type OutcomeVerdict = 'good' | 'bad' | 'neutral';        // for the judged seat
type OutcomeEffect =
  | { kind: 'damage'; amount: number; subject: 'seat' | 'owner' | 'source' }
  | { kind: 'skip-phase'; phase: 'Draw' | 'Play' }
  | { kind: 'keep-phase'; phase: 'Draw' | 'Play' }
  | { kind: 'pass-on' }
  | { kind: 'none' };                                      // text only

// content: beside judgmentOutcome
judgmentOutcome(state, view, registry): { readerId, key, seats, verdict, effect } | null
```

- `verdict` and `effect` are fixed per reader and key, in the same table as the text, and are produced by the same function that already decides `key`, so they cannot disagree with the rule.
- The check or cross is read from `verdict`: `good` draws a check, `bad` a cross, `neutral` draws no stamp.
- The "rule line" shown at the start (beat at 500 ms) is hand-written per reader, English and Vietnamese (draft), kept beside the outcome text.
- Dying seats: if a damage `subject` is not alive when the consequence plays, the damage sequence still plays from the HP shown in state at that moment, never negative. The popup opens before the effect resolves, so the HP in state is the pre-damage value. Hearts are drawn from the seat's public `combinedHp` and `maxCombinedHp`; the builder confirms they are public for a seat with hidden Generals, and if the maximum is hidden, draws only the current HP.
- **Whose point of view:** the verdict is how the judgment went for the judged seat as its player would feel it, whoever the effect lands on. Unyielding's damage to its source is `good` for the judged seat (the owner). Lament's effects on the killer are `good` for the judged seat (the victim).
- **Keys come from code:** the keys in `JUDGMENT_OUTCOMES` in `content/src/lib/display.ts` are the truth, and the table below follows them. The older popup spec's table is out of date for Unyielding and Lament. The builder lists the final table in the plan for the user's review before implementing it, since a wrong stamp is visible.

**Proposed table** (the designer's call, per reader; the builder confirms each row against the reader's code and corrects the verdict or effect, never the rule). Judged seat is the viewpoint.

| Reader | Key | Verdict | Effect |
|---|---|---|---|
| Lightning | struck | bad | damage 3, seat |
| Lightning | moves, stays | good | pass-on, none |
| Capture | skip | bad | skip-phase Play |
| Capture | spared | good | keep-phase Play |
| Starvation | skip | bad | skip-phase Draw |
| Starvation | spared | good | keep-phase Draw |
| Eight Trigrams, Eight Arrays | shan | good | none |
| Eight Trigrams, Eight Arrays | none | bad | none |
| Unyielding | discard-or-damage, damage | good | damage 1, source (damage only) |
| Unyielding | spared | bad | none |
| River Goddess, Goddess Luo | again | good | none |
| River Goddess, Goddess Luo | ends | bad | none |
| Iron Cavalry | unblockable | good | none |
| Iron Cavalry | none | bad | none |
| Lightning Strike (both) | damage | bad | damage 2, seat |
| Lightning Strike (both) | none | good | none |
| Dueling Heroes | red, black | neutral | none |
| Military Farm | farm | good | none |
| Military Farm | discard | bad | none |
| Lament | heal, draw, discard2, discard1, face-down, face-up | good | none |
| Lament | none | bad | none |

## Clocks

**Principle: a clock starts when the thing it times is on screen.** The beats before a decision or before Continue are fixed in length, so each clock gets a lead-in equal to the beats that must finish first. Clocks are plain data in `decisionClock.ts` and are not engine state, so stored games and replays are unaffected.

- `DECISION_SECONDS.notice`: 10 becomes 3. It runs from Continue unlock.
- New decision kind for a judgment-change decision: 10 s, the default being the decline action (`defaultActionsFor` returns Don't Use, or the cancel of the selection). **Which decisions:** only a pending choice or selection that a judgment changer asked for (a seat listed in `JUDGMENT_CHANGERS` acting on `before:JudgmentShownEffect`) while `judgmentView.settled` is false. Any other pending decision under an unsettled judgment keeps its own kind and clock. **Two-step asks:** a "use?" step followed by a card selection share one clock and one 10 s budget (same key per ask).
- **Lead-in.** `DecisionSpec` (or the clock) gains a lead-in in ms, and `switchClock` starts the countdown at `now + leadIn`. App `DecisionTimer` and the server `reschedule` both honour it, and `RemoteDecisionClock` displays it. The lead-ins come from one shared constants module read by the app and the server:

| Clock | Lead-in |
|---|---|
| Judgment change, first ask of a judgment | HEAD, 2100 ms (source, rule, card flip) |
| Judgment change, every later ask | REPLACE, 1300 ms (the swap; also used after a decline) |
| Notice, when no changer was ever asked | HEAD + TAIL, 2100 + 2000 ms |
| Notice, after at least one ask | TAIL, 2000 ms (verdict, consequence, unlock) |

- **State needed:** `judgmentView` gains a counter `rounds` (how many changer asks have happened so far), counted when the ask opens. It tells the first ask from later ones, and a notice that follows asks from one that does not. There is no separate "after a decline" lead-in: a later ask after a decline waits REPLACE too, up to 0.8 s longer than a 500 ms gap would. It is public, additive, and only exists with `judgmentNotice` on.
- **No UI, no lead-in.** When no seat is controlled by a person (all-bot or fully taken-over games) every lead-in is zero, and a bot's changer decision uses no animation delay, so such games do not stall.
- Compete popup: its 15 s auto-close becomes 3 s, started when Continue unlocks (UI only).
- Online: the server owns the clocks and `RemoteDecisionClock` only displays them. Every client reaches each beat at the same moment because the sequence is fixed.
- **Protocol:** `GameClockView` gains `startsAt` and the new kind, and `PROTOCOL_VERSION` is bumped (the Victory Window change bumps it too; ship them in one release if they land together).
- Away takeover: a judgment-change timeout counts as a timeout like any other decision (it is a real decision). The notice timeout still does not (existing rule).

## Constraints

- Engine and content stay framework-free. Components only play beats and render the data content hands them (CLAUDE.md).
- Rules before code: the verdict and effect table above is the rule text; each row is confirmed against its reader before that reader is changed.
- UI text follows the casing rules in CLAUDE.md. New strings (the rule lines, "Winners", "Don't Use" and so on) go through the catalogs, English and Vietnamese (draft).
- Everything animated is CSS or Web Animations, no new dependency. `prefers-reduced-motion` is honoured.
- The existing `judgmentNotice` option still gates the whole judgment wait. With it off, judgments are not shown at all, as today.

## Decisions made by the user

- Both popups stay blocking, with a fixed animation.
- Judgment: a check or cross shows whether the judgment passes (read from the judged seat's point of view, confirmed).
- Compete: a "versus" display, and the prevailing player is highlighted.
- A judgment result can be followed by a decision popup for skills that may change it; several changers repeat the round; the replaced cards stay in view.
- No skipping the animation. Both countdowns are 3 s. A judgment-change decision has 10 s.
- The decision popup lives inside the Judgment popup (delegated to the designer, no objection).
- The verdict is judged from the judged seat's player's point of view, whoever the effect lands on (the user said to follow the rule already confirmed).

## Left to the builder

Component and file names; how to split the work (suggested order: content data for verdict and effect; the decision-area host and the new decision kind; the Judgment sequence; the Compete sequence; clocks and the online delay); exact easing and durations inside the beats; the Vietnamese wording; how the HP shown in the damage animation is read (the popup has the public state); how a seat's own judgment-change question and a spectator's waiting line are chosen.

## Calls the designer made (not the user)

- The beat times above, and the 4.5 s ceiling.
- A neutral verdict (no stamp) for Dueling Heroes, and the whole verdict table.
- The Compete tie shows the challenged player as the winner, as the rules already say.
- At most three replaced cards are drawn.
- The rule line (the one-sentence reminder of the condition) is new, hand-written content.
- Compete stays a UI modal rather than an engine pause.
- The lead-in design (clocks start when their content is on screen), its constants and the `rounds` counter.
- A judgment-change decision is only a changer's ask; the Pass and Play gate comes before the decision area.
- The verdict viewpoint rule (the judged seat's player), including effects that land on a third seat.
