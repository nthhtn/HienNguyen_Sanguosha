# Goddess Luo Judgment Chain and Notice Clocks — Design

Status: Draft for review, 2026-11-23. Builds on `2026-10-20-judgment-popup-design.md` and `2026-10-26-judgment-compete-animation-design.md`. Where this document is silent, those stand.

## Intent

- **Goal:** Zhen Ji's Goddess Luo judges again and again. Today each judgment closes the popup and opens a new one, and the "Judge again?" ask is a separate dialog.
- **Why it matters:** The chain should read as one moment: One popup, the black cards gathering on the side, one ending.
- **Also:** The default notice clock becomes 3 s, and Harvest's notice lasts as long as it has participants (at most 5 s).

## Goals

1. **One popup for the whole chain.**
   - It stays open from Zhen Ji's first judgment until her chain ends.
   - It never closes and reopens between her judgments.
2. **A black card does not wait.**
   - Its verdict animation still plays (check, consequence line), about 2 s.
   - No notice countdown runs and nobody closes it.
3. **The "Judge again?" ask is inside the popup.**
   - It sits in the decision area, as a changer's ask does.
   - Its owner sees the question; every other seat sees "{Zhen Ji} may judge again".
   - A timeout counts as stop.
4. **Set-aside cards stay visible.**
   - Each black card moves into a "Set aside" row in the popup, face up, once its verdict has played.
   - The row stays until the chain ends.
5. **A 5 s wait at the end.**
   - It follows a red card or a stop.
   - The popup then closes, and she takes the set-aside cards.
6. **Clocks.**
   - The default notice clock is 3 s.
   - Harvest's notice clock is its number of participants, capped at 5 s.

## Non-goals

- **Other judgments:** Changers (Sima Yi, Zhang Jiao), cards and every other skill behave as today.
- **River Goddess:** The Identity version is unchanged: Its deck is disabled and it takes each card at once.
- **Other notices:** Their length is unchanged; only the default moves.
- **Docs drift:** The stale clocks table in `rules-engine.md` is fixed only for the values this change touches.

## Anti-goals

- **No stalls:** The chain must not hold a game longer than its clocks. A game with no human seat must not stall at all.
- **No rules in Angular:** What chains, what is set aside and when the chain ends come from the engine and content.
- **Replays:** Games without `judgmentNotice`, and stored games, replay exactly.

## Rules (Goddess Luo, as already implemented, plus the popup)

1. **Start Phase:** She may judge. Declining opens nothing.
2. **Each judgment:** The popup plays its animation. Changers may still change the card, as today.
3. **Black final card:**
   - The card is set aside (the existing stash move).
   - She is asked: judge again, or stop.
   - Judge again starts the next judgment in the same popup.
4. **Red final card, a stop, no card left to judge, or her death:**
   - The chain ends. Red or leftover cards are discarded as today.
   - She takes the set-aside cards (to the discard pile if she is out), as today.
5. **Colour** is read as today (`riverGoddessOutcome`), so a changer turning a black card red ends the chain.

## Approaches

1. **Chain in engine state (chosen):**
   - `judgmentView` stays alive across the chain and carries the set-aside cards.
   - A reader can say "this result does not wait".
   - It works locally, online and in replays, and a bot cannot run past it.
2. **UI-only (rejected):** The app would keep the dialog open between judgments. It has to guess when the chain ends, and online clients would drift.
3. **A new chain-judge effect (rejected):** It needs the same state as approach 1 plus a new effect kind, for no extra behaviour.

## Design

### Engine

- **A chain on the view:**
  - `JudgmentView` gains an optional chain: the set-aside cards (`CardInstance[]`, public) and a phase.
  - Phases: `judging`, `asking` (a black card's verdict is done and the ask is pending), `ending` (waiting out the 5 s).
- **A reader hook:** A skill or card definition may declare that a final card chains: Goddess Luo does when the card is black and she is living. The engine asks the hook when the judgment settles.
- **Settling a chaining judgment:**
  - It does not stop the pipeline for an acknowledgement.
  - It marks the view settled and carries on to the reader's `onJudged`, which sets the card aside and queues the ask.
  - The view is not cleared. It moves to `asking`.
- **The next judgment** replaces the card and resets `settled`, but keeps the chain's set-aside cards.
- **Ending:**
  - A red card, a stop, or an empty draw pile settles the view as `ending` and waits for the acknowledgement, as a normal settled judgment does.
  - Acknowledging, or the 5 s clock, then runs Goddess Luo's end step and clears the view.
- **Option and compatibility:** All of it sits behind `judgmentNotice`. With it off, nothing changes.
- **Server and local:** Neither needs a new mechanism: They already run `describeDecision`, `switchClock` and the acknowledgement. They treat `asking` like a changer's ask and `ending` like a settled judgment.

### Clocks

- **The continue ask** uses a judgment-change-style clock: a lead-in of the verdict animation (`JUDGMENT_LEAD_IN_MS.tail`), then the existing `ask` seconds. Its default is stop.
- **`notice`** becomes 3 s in the engine (`DECISION_SECONDS.notice`) and `NOTICE_SECONDS` becomes 3 in the Resolution Notice dialog.
- **Judgment result clock:** The countdown after a settled judgment's verdict is `DECISION_SECONDS.notice`, so it is 3 s too. It is a goal of its own, with a test, not a side effect.
- **A new kind for the chain's end** (name is the builder's call), 5 s, lead-in the tail animation. It does not count towards the away rule, as `notice` does not.
- **Harvest:** `seconds` is the number of participants (the picks in the span), at most 5.

### Application layer and UI

- **Description:** `judgmentDescription` gains the set-aside cards and, while `asking`, a decision of a new kind (the owner's "Judge again?", or the watching line naming her).
- **Dialog:** It stays open while the view exists. The set-aside row sits under the arena, small face-up cards with a "Set aside" label.
- **Decision area:** It reuses the changer's ask and watching panels. Unlike a changer's ask, the watching line names her: Her skill is public.
- **Pass and Play:** The gate shows before her ask if her view is not on screen, as for a changer.
- **Text:** New strings in English and Vietnamese (draft): the "Set aside" label, "Judge again?" and "{Seat} may judge again". English follows the casing rules in `CLAUDE.md`.
- **Reduced motion:** The set-aside move shows its end state at once.

## Constraints

- Engine and content stay framework-free; no rule logic in components.
- Existing tests, simulations and saved games are unaffected while `judgmentNotice` is false.
- Docs are updated for every changed value (`rules-engine.md`, `backend.md`, `frontend.md`).

## Left to the builder

- Names of types, files, message keys and the new clock kind.
- How the chain phase is stored and how `redact.ts`, bots and the sim treat it.
- The set-aside row's layout and motion; the Vietnamese draft wording.
- How to split the work into stages (suggested: engine and clocks; content hook and Goddess Luo; app popup; docs).

## Calls the designer made (not the user)

- Only Goddess Luo changes; River Goddess is left alone.
- A black card keeps its verdict animation, only the countdown goes.
- The 5 s wait follows both a red card and a stop.
- The ask's default on timeout is stop.
- The watching line names Zhen Ji.
- Harvest's "participants" are the seats that took a card.
